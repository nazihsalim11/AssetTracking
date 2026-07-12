/**
 * Scheduled lifecycle and SLA checks.
 *
 * Every event carries a stable event_key, so a job that runs twice in a day — or a
 * server that restarts mid-run — cannot notify anyone twice. The key embeds the
 * reminder threshold, so changing warranty_reminder_days from 60 to 30 legitimately
 * produces a fresh reminder rather than being suppressed by the old one.
 *
 * The reminder fires on the first run where the asset is *within* the window, not
 * on the exact day. A run missed because the server was down would otherwise skip
 * the reminder permanently.
 */

const db = require('./../db');
const { notify, getSettings } = require('./index');
const slaEngine = require('../slaEngine');
const slaModel = require('../slaModel');

// Display names for escalation targets, mirrored in the frontend.
const TARGET_LABELS = {
  assignee: 'Assigned Technician', team_lead: 'Team Lead',
  department_manager: 'Department Manager', it_admin: 'IT Administrator', super_admin: 'Super Admin'
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const daysUntil = (date) => Math.ceil((new Date(date) - Date.now()) / MS_PER_DAY);
const hoursUntil = (date) => Math.ceil((new Date(date) - Date.now()) / MS_PER_HOUR);

/* ------------------------------------------------------- warranty expiry */

async function checkWarrantyExpiries() {
  const { warranty_reminder_days: window } = await getSettings();

  const { rows } = await db.query(
    `SELECT id, name, serial_number, warranty_expiry, assigned_employee, department
     FROM assets
     WHERE warranty_expiry IS NOT NULL
       AND status <> 'Disposed'
       AND warranty_expiry > CURRENT_DATE
       AND warranty_expiry <= CURRENT_DATE + ($1 || ' days')::interval`,
    [window]
  );

  for (const asset of rows) {
    await notify('asset.warranty_expiring', `warranty:${asset.id}:${window}`, {
      assetId: asset.id,
      assetName: asset.name,
      serialNumber: asset.serial_number,
      expiryDate: asset.warranty_expiry,
      daysRemaining: daysUntil(asset.warranty_expiry),
      assignedEmployee: asset.assigned_employee,
      department: asset.department
    });
  }
  return rows.length;
}

/* ------------------------------------------------------------ AMC expiry */

async function checkAmcExpiries() {
  const { amc_reminder_days: window } = await getSettings();

  const { rows } = await db.query(
    `SELECT m.id, m.vendor, m.end_date,
            COUNT(a.id)::int AS asset_count,
            COALESCE(STRING_AGG(a.id, ', ' ORDER BY a.id), '') AS asset_summary
     FROM amcs m
     LEFT JOIN assets a ON a.amc_id = m.id
     WHERE m.end_date > CURRENT_DATE
       AND m.end_date <= CURRENT_DATE + ($1 || ' days')::interval
     GROUP BY m.id, m.vendor, m.end_date`,
    [window]
  );

  for (const amc of rows) {
    await notify('amc.expiring', `amc:${amc.id}:${window}`, {
      amcId: amc.id,
      vendor: amc.vendor,
      expiryDate: amc.end_date,
      daysRemaining: daysUntil(amc.end_date),
      assetCount: amc.asset_count,
      assetSummary: amc.asset_summary
    });
  }
  return rows.length;
}

/* --------------------------------------------------- AMC service due */

// Periodic-service cadence in days, keyed off the AMC's service_schedule label.
const SCHEDULE_DAYS = {
  weekly: 7, 'bi-weekly': 14, fortnightly: 14, monthly: 30, 'bi-monthly': 60,
  quarterly: 90, 'half-yearly': 180, 'semi-annual': 180, 'semi-annually': 180,
  yearly: 365, annual: 365, annually: 365
};

const scheduleDays = (label) => SCHEDULE_DAYS[String(label || '').trim().toLowerCase()] || null;

/**
 * Reminders for the *next periodic service visit* of an active AMC (distinct from the
 * AMC-expiry reminder). The next-due date is derived from the most recent logged service
 * (or the contract start if none) plus the schedule cadence. Overdue services are reported
 * too. The event key embeds the computed due date, so once a visit is logged the cadence
 * advances and the next cycle produces a fresh reminder rather than being suppressed.
 */
async function checkServiceDue() {
  const { service_due_reminder_days: window } = await getSettings();

  const { rows } = await db.query(
    `SELECT m.id, m.vendor, m.service_schedule, m.start_date, m.end_date, m.service_history,
            COUNT(a.id)::int AS asset_count
     FROM amcs m
     LEFT JOIN assets a ON a.amc_id = m.id
     WHERE m.end_date >= CURRENT_DATE
     GROUP BY m.id, m.vendor, m.service_schedule, m.start_date, m.end_date, m.service_history`
  );

  let evaluated = 0;
  for (const amc of rows) {
    const cadence = scheduleDays(amc.service_schedule);
    if (!cadence) continue; // no recognised cadence → nothing periodic to remind about

    // Most recent service date from the history, else the contract start.
    const history = Array.isArray(amc.service_history) ? amc.service_history : [];
    const lastServiceMs = history
      .map((h) => new Date(h && h.date).getTime())
      .filter((t) => !Number.isNaN(t))
      .reduce((max, t) => Math.max(max, t), 0);
    const baseMs = lastServiceMs || new Date(amc.start_date).getTime();
    if (Number.isNaN(baseMs)) continue;

    const dueMs = baseMs + cadence * MS_PER_DAY;
    const daysRemaining = Math.ceil((dueMs - Date.now()) / MS_PER_DAY);

    // Fire when due within the reminder window, or already overdue.
    if (daysRemaining > window) continue;

    const dueDate = new Date(dueMs).toISOString().split('T')[0];
    evaluated++;
    await notify('asset.service_due', `service-due:${amc.id}:${dueDate}`, {
      amcId: amc.id,
      vendor: amc.vendor,
      schedule: amc.service_schedule,
      dueDate,
      daysRemaining,
      assetCount: amc.asset_count
    });
  }
  return evaluated;
}

/* ----------------------------------------------------- pending payments */

/**
 * Invoices that remain unpaid past a grace period after their invoice date. One reminder
 * per invoice (the event key is just the invoice id) so a long-unpaid invoice does not
 * nag daily; marking it paid and it later reverting is a rare enough case to accept.
 */
async function checkPendingPayments() {
  const { invoice_pending_grace_days: grace } = await getSettings();

  const { rows } = await db.query(
    `SELECT id, vendor, amount, gst, date, payment_status,
            (CURRENT_DATE - date)::int AS age_days
     FROM invoices
     WHERE payment_status IN ('Pending', 'Partially Paid', 'Overdue')
       AND date <= CURRENT_DATE - ($1 || ' days')::interval`,
    [grace]
  );

  for (const inv of rows) {
    await notify('finance.payment_pending', `payment-pending:${inv.id}`, {
      invoiceId: inv.id,
      vendor: inv.vendor,
      amount: inv.amount,
      status: inv.payment_status,
      date: inv.date,
      ageDays: inv.age_days
    });
  }
  return rows.length;
}

/* -------------------------------------------------------- returns due */

/**
 * Reminders for assigned assets whose expected_return_date is within the window (or past).
 * The event key embeds the window, mirroring the warranty reminder: changing the lead time
 * legitimately produces a fresh reminder rather than being suppressed by the old one.
 */
async function checkReturnsDue() {
  const { return_due_reminder_days: window } = await getSettings();

  const { rows } = await db.query(
    `SELECT ag.id, ag.asset_id, ag.employee_name, ag.department, ag.expected_return_date,
            a.name AS asset_name
     FROM asset_assignments ag
     LEFT JOIN assets a ON a.id = ag.asset_id
     WHERE ag.status = 'Assigned'
       AND ag.expected_return_date IS NOT NULL
       AND ag.expected_return_date <= CURRENT_DATE + ($1 || ' days')::interval`,
    [window]
  );

  for (const r of rows) {
    await notify('asset.return_due', `return-due:${r.id}:${window}`, {
      assignmentId: r.id,
      assetId: r.asset_id,
      assetName: r.asset_name || r.asset_id,
      employeeName: r.employee_name,
      department: r.department,
      dueDate: r.expected_return_date,
      daysRemaining: daysUntil(r.expected_return_date)
    });
  }
  return rows.length;
}

/* ------------------------------------------------------- low inventory */

/**
 * Low-stock alerts for assets tracked with a reorder level. The event key embeds the
 * current available quantity so a *further* drop re-notifies, while sitting at the same
 * level does not spam; replenishing above the threshold and dropping again yields a new key.
 */
async function checkLowInventory() {
  const { rows } = await db.query(
    `SELECT id, name, category::text AS category, location, available_quantity, reorder_level
     FROM assets
     WHERE status <> 'Disposed'
       AND reorder_level > 0
       AND available_quantity <= reorder_level`
  );

  for (const a of rows) {
    await notify('asset.low_inventory', `low-inventory:${a.id}:${a.available_quantity}`, {
      assetId: a.id,
      assetName: a.name,
      category: a.category,
      location: a.location,
      availableQuantity: a.available_quantity,
      reorderLevel: a.reorder_level
    });
  }
  return rows.length;
}

/* ------------------------------------------------------------------ SLA */

const OPEN_STATUSES = ['Resolved', 'Closed'];

async function checkSlaApproaching() {
  const { sla_warning_hours: warnHours } = await getSettings();

  const { rows } = await db.query(
    `SELECT id, ticket_id, subject, department, priority, assigned_to, assigned_to_name,
            created_by, sla_deadline
     FROM tickets
     WHERE status <> ALL($1::text[])
       AND sla_deadline > NOW()
       AND sla_deadline <= NOW() + ($2 || ' hours')::interval`,
    [OPEN_STATUSES, warnHours]
  );

  for (const t of rows) {
    await notify('ticket.sla_approaching', `sla-approaching:${t.id}:${warnHours}`, {
      ticketId: t.ticket_id,
      subject: t.subject,
      department: t.department,
      priority: t.priority,
      assignedTo: t.assigned_to,
      assignedToName: t.assigned_to_name,
      createdBy: t.created_by,
      slaDeadline: t.sla_deadline,
      hoursRemaining: Math.max(0, hoursUntil(t.sla_deadline))
    });
  }
  return rows.length;
}

/**
 * Breach + auto-escalation. Both derive from the same row, and the escalation flag
 * is flipped in the same transaction as the timeline entry so a crash between them
 * cannot leave a ticket marked escalated with no audit record.
 */
async function checkSlaBreaches() {
  const { rows } = await db.query(
    `SELECT id, ticket_id, subject, department, priority, assigned_to, assigned_to_name,
            created_by, sla_deadline, escalated, sla_policy_id
     FROM tickets
     WHERE status <> ALL($1::text[])
       AND sla_deadline < NOW()`,
    [OPEN_STATUSES]
  );

  let escalatedCount = 0;

  for (const t of rows) {
    const hoursOverdue = Math.max(1, Math.abs(hoursUntil(t.sla_deadline)));
    const ctx = {
      ticketId: t.ticket_id,
      subject: t.subject,
      department: t.department,
      priority: t.priority,
      assignedTo: t.assigned_to,
      assignedToName: t.assigned_to_name,
      createdBy: t.created_by,
      slaDeadline: t.sla_deadline,
      hoursOverdue
    };

    // The people working the ticket.
    await notify('ticket.sla_breached', `sla-breached:${t.id}`, ctx);

    // Policy-governed tickets escalate through their configured ladder
    // (checkSlaEscalations); only unpoliced tickets fall back to this single-level
    // "escalate to admins on breach" behaviour.
    if (t.sla_policy_id) continue;
    if (t.escalated) continue;

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Guard on escalated = FALSE so two overlapping runs cannot both escalate.
      const claimed = await client.query(
        `UPDATE tickets SET escalated = TRUE, escalated_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND escalated = FALSE
         RETURNING id`,
        [t.id]
      );
      if (claimed.rowCount === 0) {
        await client.query('ROLLBACK');
        continue;
      }
      await client.query(
        `INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
         VALUES ($1, 'System', 'Escalated', $2)`,
        [t.id, `SLA breached ${hoursOverdue} hour(s) ago. Escalated to administrators.`]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`[notifications] could not escalate ticket ${t.ticket_id}:`, err.message);
      client.release();
      continue;
    }
    client.release();

    escalatedCount++;
    // The people who must intervene.
    await notify('ticket.escalated', `escalated:${t.id}`, ctx);
  }

  return { breached: rows.length, escalated: escalatedCount };
}

/**
 * Multi-level escalation ladder execution for policy-governed tickets. For each open
 * ticket, the SLA engine decides which of its policy's escalation levels are now due
 * (based on elapsed business-hours percentage, remaining time, or a breach). The
 * ticket's escalation_level is advanced to the highest due level, and every newly
 * crossed level notifies its configured target. Idempotent: a level's stable event key
 * plus the escalation_level guard mean a level is never actioned twice.
 */
async function checkSlaEscalations() {
  const { rows: tickets } = await db.query(
    `SELECT id, ticket_id, subject, department, priority, assigned_to, assigned_to_name,
            created_by, created_at, first_response_due, resolution_due, first_response_at,
            escalation_level, sla_policy_id
     FROM tickets
     WHERE status <> ALL($1::text[]) AND sla_policy_id IS NOT NULL`,
    [OPEN_STATUSES]
  );
  if (!tickets.length) return { escalated: 0 };

  const policyIds = [...new Set(tickets.map((t) => t.sla_policy_id))];

  // Escalation levels grouped by policy, in one query.
  const { rows: levelRows } = await db.query(
    `SELECT policy_id, level, trigger_type, threshold, notify_target
     FROM sla_escalation_levels WHERE policy_id = ANY($1::int[]) ORDER BY level`,
    [policyIds]
  );
  const levelsByPolicy = {};
  for (const l of levelRows) (levelsByPolicy[l.policy_id] ||= []).push(l);

  // Calendar per policy (loaded once each), so the engine can measure business hours.
  const { rows: polRows } = await db.query(
    `SELECT id, calendar_id FROM sla_policies WHERE id = ANY($1::int[])`,
    [policyIds]
  );
  const calByPolicy = {};
  for (const p of polRows) calByPolicy[p.id] = await slaModel.getCalendarWithHolidays(p.calendar_id);

  let escalatedCount = 0;

  for (const t of tickets) {
    const levels = levelsByPolicy[t.sla_policy_id];
    if (!levels || !levels.length) continue;

    const due = slaEngine.dueEscalations(levels, {
      now: new Date(),
      createdAt: t.created_at,
      firstResponseDue: t.first_response_due,
      resolutionDue: t.resolution_due,
      firstResponseAt: t.first_response_at,
      calendar: calByPolicy[t.sla_policy_id]
    });
    if (!due.length) continue;

    const maxDueLevel = due[due.length - 1].level;
    if (maxDueLevel <= t.escalation_level) continue;

    // Claim the advance atomically so two overlapping runs cannot both escalate.
    const claimed = await db.query(
      `UPDATE tickets
       SET escalation_level = $1, escalated = TRUE, escalated_at = COALESCE(escalated_at, NOW()), updated_at = NOW()
       WHERE id = $2 AND escalation_level < $1
       RETURNING id`,
      [maxDueLevel, t.id]
    );
    if (!claimed.rowCount) continue;

    for (const lvl of due) {
      if (lvl.level <= t.escalation_level) continue; // only newly crossed levels
      const targetLabel = TARGET_LABELS[lvl.notify_target] || lvl.notify_target;
      await db.query(
        `INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail) VALUES ($1, 'System', 'Escalated', $2)`,
        [t.id, `Escalation level ${lvl.level}: notified ${targetLabel}`]
      );
      await notify('ticket.escalation_level', `escalation:${t.id}:${lvl.level}`, {
        ticketId: t.ticket_id,
        subject: t.subject,
        department: t.department,
        priority: t.priority,
        assignedTo: t.assigned_to,
        assignedToName: t.assigned_to_name,
        createdBy: t.created_by,
        resolutionDue: t.resolution_due,
        level: lvl.level,
        target: lvl.notify_target,
        targetLabel
      });
    }
    escalatedCount++;
  }

  return { escalated: escalatedCount };
}

/* ------------------------------------------------------------- entry points */

async function runDailyChecks() {
  console.log('[notifications] running daily lifecycle checks...');
  try {
    // Each check is independent, so one failing (e.g. a data-shape surprise) must not
    // stop the others from running.
    const results = await Promise.allSettled([
      checkWarrantyExpiries(),
      checkAmcExpiries(),
      checkServiceDue(),
      checkPendingPayments(),
      checkReturnsDue(),
      checkLowInventory()
    ]);
    const labels = ['warranty', 'AMC expiry', 'service due', 'pending payment', 'returns due', 'low inventory'];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        console.log(`[notifications] ${labels[i]}: ${r.value} reminder(s) evaluated`);
      } else {
        console.error(`[notifications] ${labels[i]} check failed:`, r.reason);
      }
    });
  } catch (err) {
    console.error('[notifications] daily checks failed:', err);
  }
}

async function runSlaChecks() {
  try {
    const approaching = await checkSlaApproaching();
    const { breached, escalated } = await checkSlaBreaches();
    const { escalated: laddered } = await checkSlaEscalations();
    if (approaching || breached || escalated || laddered) {
      console.log(`[notifications] SLA: ${approaching} approaching, ${breached} breached, ${escalated + laddered} newly escalated`);
    }
  } catch (err) {
    console.error('[notifications] SLA checks failed:', err);
  }
}

module.exports = {
  runDailyChecks,
  runSlaChecks,
  checkWarrantyExpiries,
  checkAmcExpiries,
  checkServiceDue,
  checkPendingPayments,
  checkReturnsDue,
  checkLowInventory,
  checkSlaApproaching,
  checkSlaBreaches,
  checkSlaEscalations
};

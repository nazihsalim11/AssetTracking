/**
 * Database bridge for the SLA engine. slaEngine.js is pure; this module loads policies,
 * calendars and holidays from Postgres and feeds them in, and exposes the couple of
 * operations the server needs: pick a ticket's policy + deadlines, and resolve which
 * business calendar applies.
 */

const db = require('./db');
const engine = require('./slaEngine');

/* ------------------------------------------------------------------ calendars */

/** A calendar row plus its holiday date strings, shaped for the engine. */
async function getCalendarWithHolidays(calendarId, client = db) {
  if (!calendarId) return await getDefaultCalendar(client);
  const { rows } = await client.query('SELECT * FROM business_calendars WHERE id = $1', [calendarId]);
  if (!rows.length) return await getDefaultCalendar(client);
  return attachHolidays(rows[0], client);
}

async function getDefaultCalendar(client = db) {
  const { rows } = await client.query(
    `SELECT * FROM business_calendars
     WHERE active = TRUE
     ORDER BY is_default DESC, id ASC
     LIMIT 1`
  );
  // No calendar configured at all: the engine's normalizeCalendar defaults (Mon–Fri,
  // 09:00–18:00, +05:30) still produce sane deadlines.
  if (!rows.length) return { is_24x7: false, working_days: [1, 2, 3, 4, 5], holidays: [] };
  return attachHolidays(rows[0], client);
}

async function attachHolidays(calendar, client = db) {
  const { rows } = await client.query(
    `SELECT to_char(holiday_date, 'YYYY-MM-DD') AS d FROM calendar_holidays WHERE calendar_id = $1`,
    [calendar.id]
  );
  return { ...calendar, holidays: rows.map((r) => r.d) };
}

/* ------------------------------------------------------------------ policies */

async function loadActivePolicies(client = db) {
  const { rows } = await client.query(
    `SELECT * FROM sla_policies WHERE active = TRUE AND archived = FALSE`
  );
  return rows;
}

async function loadEscalationLevels(policyId, client = db) {
  const { rows } = await client.query(
    `SELECT * FROM sla_escalation_levels WHERE policy_id = $1 ORDER BY level ASC`,
    [policyId]
  );
  return rows;
}

/* ------------------------------------------------ deadline computation */

/**
 * Match a ticket to a policy and compute its first-response and resolution deadlines
 * against that policy's business calendar. Returns nulls-safe defaults when no policy
 * applies, so ticket creation never fails for want of an SLA.
 *
 * @param ticket   { priority, category, department, assetType, branch }
 * @param createdAt Date the clock starts from (defaults to now)
 */
async function computeDeadlines(ticket, createdAt = new Date(), client = db) {
  const policies = await loadActivePolicies(client);
  const policy = engine.matchPolicy(policies, ticket);

  if (!policy) {
    // Nothing matched — fall back to a plain 24h wall-clock resolution so the ticket
    // still carries a deadline, and flag that no policy governs it.
    const resolutionDue = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);
    return { policy: null, policyId: null, calendarId: null, firstResponseDue: null, resolutionDue };
  }

  const calendar = await getCalendarWithHolidays(policy.calendar_id, client);
  const firstResponseDue = engine.addBusinessMinutes(createdAt, policy.first_response_minutes, calendar);
  const resolutionDue = engine.addBusinessMinutes(createdAt, policy.resolution_minutes, calendar);

  return {
    policy,
    policyId: policy.id,
    calendarId: policy.calendar_id,
    firstResponseDue,
    resolutionDue,
    calendar
  };
}

module.exports = {
  getCalendarWithHolidays,
  getDefaultCalendar,
  attachHolidays,
  loadActivePolicies,
  loadEscalationLevels,
  computeDeadlines
};

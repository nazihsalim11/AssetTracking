/**
 * SLA engine — pure, database-free logic for SLA policy matching and business-hours
 * deadline arithmetic. Everything here is deterministic and unit-tested; the server
 * loads policies/calendars from the database and feeds plain objects in.
 *
 * Two ideas do all the work:
 *
 *   1. Deadlines are measured in *business minutes*, not wall-clock. A calendar
 *      describes working days, working hours, holidays and a fixed UTC offset, and
 *      addBusinessMinutes walks that calendar forward. A 24x7 calendar degrades to
 *      plain wall-clock addition.
 *
 *   2. A ticket is matched to the *most specific* policy whose criteria it satisfies.
 *      Each policy criterion (priority, category, department, asset type, branch) is
 *      either a concrete value that must match, or NULL meaning "any". The policy that
 *      pins down the most criteria wins.
 *
 * Timezone note: calendars carry a fixed utc_offset_minutes (default 330 = Asia/Kolkata,
 * which has no DST). This keeps the arithmetic exact and testable. Regions with daylight
 * saving would need a real tz database; that is deliberately out of scope for this market.
 */

const MS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;

/* --------------------------------------------------------------- calendar shape */

// A calendar object as the engine expects it. The DB layer is responsible for
// producing this shape; defaults here mean a bare {} still behaves sanely (Mon–Fri,
// 09:00–18:00, +05:30, no holidays).
function normalizeCalendar(cal) {
  const c = cal || {};
  const workingDays = Array.isArray(c.working_days) && c.working_days.length
    ? c.working_days.map(Number).filter((d) => d >= 0 && d <= 6)
    : [1, 2, 3, 4, 5];
  return {
    is24x7: Boolean(c.is_24x7),
    offsetMin: Number.isFinite(Number(c.utc_offset_minutes)) ? Number(c.utc_offset_minutes) : 330,
    startMin: parseTimeToMinutes(c.work_start, 9 * 60),
    endMin: parseTimeToMinutes(c.work_end, 18 * 60),
    workingDays: new Set(workingDays),
    holidays: new Set(Array.isArray(c.holidays) ? c.holidays.map(String) : [])
  };
}

// "HH:MM" or "HH:MM:SS" -> minutes since local midnight. Falls back on malformed input.
function parseTimeToMinutes(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  const mins = Number(m[1]) * 60 + Number(m[2]);
  return mins >= 0 && mins <= MINUTES_PER_DAY ? mins : fallback;
}

/* ---------------------------------------------------- local-wall-clock helpers */

// We do all day/hour reasoning in the calendar's local wall clock. Shifting a UTC
// instant by the offset gives a Date whose UTC fields read as local wall time, so we
// use the getUTC* accessors on it throughout.
const toLocal = (date, offsetMin) => new Date(date.getTime() + offsetMin * MS_PER_MINUTE);
const fromLocal = (local, offsetMin) => new Date(local.getTime() - offsetMin * MS_PER_MINUTE);

const localDateKey = (local) =>
  `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;

const minutesIntoDay = (local) => local.getUTCHours() * 60 + local.getUTCMinutes() + local.getUTCSeconds() / 60;

const isWorkingDay = (local, cal) =>
  cal.workingDays.has(local.getUTCDay()) && !cal.holidays.has(localDateKey(local));

// Midnight (local) of the day `dayOffset` days after `local`.
const startOfLocalDay = (local, dayOffset = 0) =>
  new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + dayOffset, 0, 0, 0, 0));

// Guard against a misconfigured calendar (e.g. zero working days) spinning forever.
const MAX_DAY_HOPS = 366 * 10;

/* ------------------------------------------------------ addBusinessMinutes */

/**
 * The instant that is `minutes` business-minutes after `start`, per `calendar`.
 * 24x7 calendars add wall-clock minutes directly. A non-positive `minutes` returns
 * `start` unchanged.
 */
function addBusinessMinutes(start, minutes, calendar) {
  const startDate = start instanceof Date ? start : new Date(start);
  const cal = normalizeCalendar(calendar);
  if (minutes <= 0) return new Date(startDate.getTime());
  if (cal.is24x7 || cal.startMin >= cal.endMin) {
    return new Date(startDate.getTime() + minutes * MS_PER_MINUTE);
  }

  let cursor = toLocal(startDate, cal.offsetMin);
  let remaining = minutes;

  for (let hops = 0; hops < MAX_DAY_HOPS; hops++) {
    if (!isWorkingDay(cursor, cal)) {
      cursor = startOfLocalDay(cursor, 1);
      continue;
    }
    const nowMin = minutesIntoDay(cursor);
    if (nowMin < cal.startMin) {
      // Before opening: jump to the start of the working window.
      cursor = new Date(startOfLocalDay(cursor).getTime() + cal.startMin * MS_PER_MINUTE);
    } else if (nowMin >= cal.endMin) {
      // After closing: move to the next day and re-evaluate.
      cursor = startOfLocalDay(cursor, 1);
      continue;
    }
    const available = cal.endMin - minutesIntoDay(cursor);
    if (remaining <= available) {
      cursor = new Date(cursor.getTime() + remaining * MS_PER_MINUTE);
      return fromLocal(cursor, cal.offsetMin);
    }
    remaining -= available;
    cursor = startOfLocalDay(cursor, 1);
  }
  // Calendar could not consume the budget (no working time); fail safe to wall clock.
  return new Date(startDate.getTime() + minutes * MS_PER_MINUTE);
}

/* --------------------------------------------------- businessMinutesBetween */

/**
 * Business-minutes elapsed between two instants, per `calendar`. Used to derive the
 * "percent of SLA consumed" that percentage-based escalations trigger on. Negative or
 * reversed ranges clamp to 0.
 */
function businessMinutesBetween(start, end, calendar) {
  const startDate = start instanceof Date ? start : new Date(start);
  const endDate = end instanceof Date ? end : new Date(end);
  if (endDate <= startDate) return 0;
  const cal = normalizeCalendar(calendar);
  if (cal.is24x7 || cal.startMin >= cal.endMin) {
    return (endDate.getTime() - startDate.getTime()) / MS_PER_MINUTE;
  }

  let cursor = toLocal(startDate, cal.offsetMin);
  const localEnd = toLocal(endDate, cal.offsetMin);
  let total = 0;

  for (let hops = 0; hops < MAX_DAY_HOPS && cursor < localEnd; hops++) {
    if (!isWorkingDay(cursor, cal)) {
      cursor = startOfLocalDay(cursor, 1);
      continue;
    }
    const dayOpen = new Date(startOfLocalDay(cursor).getTime() + cal.startMin * MS_PER_MINUTE);
    const dayClose = new Date(startOfLocalDay(cursor).getTime() + cal.endMin * MS_PER_MINUTE);
    const from = cursor > dayOpen ? cursor : dayOpen;
    const to = localEnd < dayClose ? localEnd : dayClose;
    if (to > from) total += (to.getTime() - from.getTime()) / MS_PER_MINUTE;
    cursor = startOfLocalDay(cursor, 1);
  }
  return total;
}

/* --------------------------------------------------------------- policy match */

// The criteria a ticket is matched on, most-specific first. Each maps a policy column
// to the ticket field it constrains.
const MATCH_FIELDS = [
  ['branch', 'branch'],
  ['asset_type', 'assetType'],
  ['category', 'category'],
  ['department', 'department'],
  ['priority', 'priority']
];

const norm = (v) => (v == null ? null : String(v).trim().toLowerCase());

/**
 * The best policy for a ticket, or null if none apply. A policy applies only if every
 * criterion it pins down matches the ticket; among applicable policies the one pinning
 * down the most criteria wins, then higher priority_rank, then most recently created.
 *
 * @param policies array of policy rows (active, non-archived filtering is the caller's
 *                 job but is also enforced here defensively)
 * @param ticket   { priority, category, department, assetType, branch }
 */
function matchPolicy(policies, ticket) {
  if (!Array.isArray(policies) || !policies.length) return null;
  let best = null;
  let bestScore = -1;

  for (const policy of policies) {
    if (policy.active === false || policy.archived === true) continue;

    let applies = true;
    let score = 0;
    for (const [policyField, ticketField] of MATCH_FIELDS) {
      const criterion = norm(policy[policyField]);
      if (criterion === null) continue; // "any" — no constraint, no specificity
      if (criterion !== norm(ticket[ticketField])) { applies = false; break; }
      score += 1;
    }
    if (!applies) continue;

    const rank = Number(policy.priority_rank) || 0;
    const bestRank = best ? Number(best.priority_rank) || 0 : -Infinity;
    const bestId = best ? Number(best.id) || 0 : -Infinity;
    if (
      score > bestScore ||
      (score === bestScore && rank > bestRank) ||
      (score === bestScore && rank === bestRank && (Number(policy.id) || 0) > bestId)
    ) {
      best = policy;
      bestScore = score;
    }
  }
  return best;
}

/* ------------------------------------------------------------- escalations */

// Trigger types an escalation level can fire on.
const ESCALATION_TRIGGERS = new Set([
  'response_percent', 'resolution_percent',
  'response_remaining', 'resolution_remaining',
  'response_breach', 'resolution_breach'
]);

// Who an escalation level notifies.
const ESCALATION_TARGETS = ['assignee', 'team_lead', 'department_manager', 'it_admin', 'super_admin'];

/**
 * Given a ticket's SLA clock state, decide which escalation levels are now due.
 *
 * @param levels array of { level, trigger_type, threshold, notify_target }
 * @param clock  {
 *   now, createdAt,
 *   firstResponseDue, resolutionDue,   (Date|string|null)
 *   firstResponseAt,                    (null until first response logged)
 *   calendar
 * }
 * @returns levels that should fire, sorted by level ascending. The caller is expected
 *          to skip levels already actioned (tracked as escalation_level on the ticket).
 */
function dueEscalations(levels, clock) {
  if (!Array.isArray(levels) || !levels.length) return [];
  const now = clock.now instanceof Date ? clock.now : new Date(clock.now || Date.now());
  const created = clock.createdAt instanceof Date ? clock.createdAt : new Date(clock.createdAt);

  const pct = (due) => {
    if (!due) return null;
    const dueDate = due instanceof Date ? due : new Date(due);
    const total = businessMinutesBetween(created, dueDate, clock.calendar);
    if (total <= 0) return now >= dueDate ? 100 : 0;
    const used = businessMinutesBetween(created, now, clock.calendar);
    return Math.min(100, (used / total) * 100);
  };
  const remaining = (due) => {
    if (!due) return null;
    const dueDate = due instanceof Date ? due : new Date(due);
    if (now >= dueDate) return 0;
    return businessMinutesBetween(now, dueDate, clock.calendar);
  };

  const responded = Boolean(clock.firstResponseAt);
  const out = [];

  for (const lvl of levels) {
    if (!ESCALATION_TRIGGERS.has(lvl.trigger_type)) continue;
    const threshold = Number(lvl.threshold);
    let fire = false;

    switch (lvl.trigger_type) {
      // Response-based triggers stop mattering once the ticket has been responded to.
      case 'response_percent':
        fire = !responded && pct(clock.firstResponseDue) !== null && pct(clock.firstResponseDue) >= threshold;
        break;
      case 'response_remaining':
        fire = !responded && remaining(clock.firstResponseDue) !== null && remaining(clock.firstResponseDue) <= threshold;
        break;
      case 'response_breach':
        fire = !responded && clock.firstResponseDue != null && now >= new Date(clock.firstResponseDue);
        break;
      case 'resolution_percent':
        fire = pct(clock.resolutionDue) !== null && pct(clock.resolutionDue) >= threshold;
        break;
      case 'resolution_remaining':
        fire = remaining(clock.resolutionDue) !== null && remaining(clock.resolutionDue) <= threshold;
        break;
      case 'resolution_breach':
        fire = clock.resolutionDue != null && now >= new Date(clock.resolutionDue);
        break;
      default:
        fire = false;
    }
    if (fire) out.push(lvl);
  }
  return out.sort((a, b) => (a.level || 0) - (b.level || 0));
}

/* ---------------------------------------------------------------- SLA status */

/**
 * A compact, display-ready SLA status for a ticket, for the tracking panel and the
 * dashboards. Pure: it reads the stored due timestamps and the current clock.
 */
function slaStatus(ticket, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const isClosed = ticket.status === 'Resolved' || ticket.status === 'Closed';

  const responseDue = ticket.firstResponseDue ? new Date(ticket.firstResponseDue) : null;
  const resolutionDue = ticket.resolutionDue || ticket.slaDeadline
    ? new Date(ticket.resolutionDue || ticket.slaDeadline)
    : null;
  const respondedAt = ticket.firstResponseAt ? new Date(ticket.firstResponseAt) : null;
  const resolvedAt = ticket.resolvedAt ? new Date(ticket.resolvedAt) : null;

  const responseBreached = responseDue
    ? (respondedAt ? respondedAt > responseDue : (!isClosed && nowDate > responseDue))
    : false;
  const resolutionBreached = resolutionDue
    ? (resolvedAt ? resolvedAt > resolutionDue : (!isClosed && nowDate > resolutionDue))
    : false;

  let state;
  if (isClosed) state = (responseBreached || resolutionBreached) ? 'breached' : 'met';
  else if (resolutionBreached || responseBreached) state = 'breached';
  else state = 'on_track';

  return {
    state,
    responseBreached,
    resolutionBreached,
    responseDue,
    resolutionDue,
    responseRemainingMs: resolutionDue && !respondedAt && !isClosed ? responseDue - nowDate : null,
    resolutionRemainingMs: resolutionDue && !isClosed ? resolutionDue - nowDate : null
  };
}

module.exports = {
  normalizeCalendar,
  parseTimeToMinutes,
  addBusinessMinutes,
  businessMinutesBetween,
  matchPolicy,
  dueEscalations,
  slaStatus,
  ESCALATION_TRIGGERS,
  ESCALATION_TARGETS,
  MATCH_FIELDS
};

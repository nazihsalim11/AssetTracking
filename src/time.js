// The single source of truth for how a point in time is rendered anywhere in the
// app: notifications, system alerts, email alerts, activity logs, audit logs and
// any other timeline.
//
// Recent events read as relative ("5 minutes ago"); anything older than a week
// reads as an absolute date and time. Both are computed from the record's real
// creation timestamp, and both render in the viewer's local timezone — the value
// coming off the API is an ISO-8601 instant (Postgres `timestamptz`), so `Date`
// converts it to local time for us.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Beyond this age a relative label stops being useful and we show the date.
export const RELATIVE_CUTOFF_DAYS = 7;

// Clocks drift. A timestamp a little in the future is a skewed clock, not a
// scheduled event, so clamp it to "Just now" rather than printing "in 3 seconds".
const FUTURE_TOLERANCE_MS = 60 * SECOND;

/** Accepts a Date, an ISO string, or epoch millis. Returns null if unusable. */
export function parseTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Midnight, local time, for the day the given date falls on. */
function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole calendar days between two instants, in local time. Calendar-based rather
 * than `diff / 86400000`: an event at 23:00 yesterday is "Yesterday" even though
 * it is only two hours old, and an event 30 hours old is not "Yesterday" if two
 * midnights have passed.
 */
function calendarDaysBetween(then, now) {
  return Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / (24 * HOUR));
}

/** The app's standard absolute format, e.g. "6 Jul 2026, 9:15 am". */
export function formatAbsoluteTimestamp(value) {
  const date = parseTimestamp(value);
  if (!date) return '';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

/** Relative label for an instant, or null when it is too old to be useful. */
export function formatRelativeTimestamp(value, now = Date.now()) {
  const date = parseTimestamp(value);
  if (!date) return null;

  const diff = now - date.getTime();
  if (diff < -FUTURE_TOLERANCE_MS) return null;
  if (diff < 45 * SECOND) return 'Just now';

  if (diff < 90 * SECOND) return '1 minute ago';
  if (diff < HOUR) return `${Math.round(diff / MINUTE)} minutes ago`;

  if (diff < 90 * MINUTE) return '1 hour ago';

  const days = calendarDaysBetween(date, new Date(now));
  if (days === 0) return `${Math.round(diff / HOUR)} hours ago`;
  if (days === 1) return 'Yesterday';
  if (days < RELATIVE_CUTOFF_DAYS) return `${days} days ago`;

  return null;
}

/**
 * What every timeline should render: relative while the event is recent, the
 * absolute date and time once it is not. Returns '' for a missing timestamp so
 * callers never print "Invalid Date".
 */
export function formatTimestamp(value, now = Date.now()) {
  return formatRelativeTimestamp(value, now) ?? formatAbsoluteTimestamp(value);
}

/**
 * How long until the given timestamp's label would change. Lets a live-updating
 * clock tick exactly when it needs to instead of polling every second.
 */
export function msUntilLabelChanges(value, now = Date.now()) {
  const date = parseTimestamp(value);
  if (!date) return null;
  const diff = now - date.getTime();
  if (diff < 45 * SECOND) return 45 * SECOND - diff;
  if (diff < HOUR) return MINUTE - (diff % MINUTE);
  if (diff < 24 * HOUR) return HOUR - (diff % HOUR);
  return null; // day-granularity labels; the periodic tick is enough
}

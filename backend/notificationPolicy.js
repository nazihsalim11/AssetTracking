/**
 * Who gets told about what, and on which channel.
 *
 * Pure decision logic, deliberately separated from the dispatcher so it can be
 * tested without a database. Getting this wrong means either notifying nobody
 * about an SLA breach, or paging the whole company about a laptop warranty.
 *
 * Three independent gates, applied in order:
 *
 *   1. Priority   — a ticket event below the configured floor is dropped entirely.
 *   2. Channel    — a channel must be on globally AND for this event type.
 *   3. Recipients — configured roles/users replace the built-in audience for an
 *                   event, but only if some are configured. No rows means "use the
 *                   defaults", not "tell nobody" — an admin who has never opened the
 *                   settings page must keep receiving everything.
 */

const CHANNELS = ['in_app', 'email', 'sms'];

// Ascending severity. A floor of 'Medium' admits Medium and Critical, not Low.
const PRIORITY_ORDER = ['Low', 'Medium', 'Critical'];

/** Index a flat preference list as prefs[eventType][channel] = {enabled, minPriority}. */
function indexPreferences(rows = []) {
  const byEvent = {};
  for (const row of rows) {
    const event = row.event_type ?? row.eventType;
    const channel = row.channel;
    if (!event || !channel) continue;
    byEvent[event] = byEvent[event] || {};
    byEvent[event][channel] = {
      enabled: row.enabled !== false,
      minPriority: row.min_priority ?? row.minPriority ?? null
    };
  }
  return byEvent;
}

/**
 * The severity floor for an event, taken from whichever channel row carries one.
 * The floor is a property of the event, not of the channel — it is stored per row
 * only because that is the table we already have.
 */
function priorityFloor(prefsByEvent, eventType) {
  const perChannel = prefsByEvent[eventType];
  if (!perChannel) return null;
  for (const channel of CHANNELS) {
    const floor = perChannel[channel] && perChannel[channel].minPriority;
    if (floor) return floor;
  }
  return null;
}

/**
 * Does this occurrence clear the configured severity floor?
 * An unknown or absent priority always passes: a warranty expiry has no priority,
 * and silently dropping it because it does not compare would be a data-shaped bug.
 */
function meetsPriorityFloor(prefsByEvent, eventType, priority) {
  const floor = priorityFloor(prefsByEvent, eventType);
  if (!floor) return true;

  const floorIndex = PRIORITY_ORDER.indexOf(floor);
  const actualIndex = PRIORITY_ORDER.indexOf(priority);
  if (floorIndex === -1 || actualIndex === -1) return true;

  return actualIndex >= floorIndex;
}

/**
 * A channel is live only if the global switch is on, the provider is configured,
 * and this event type has not switched it off. An event with no preference row is
 * enabled — new event types must not be born silent.
 */
function isChannelEnabled(prefsByEvent, eventType, channel, globals) {
  const globallyOn = channel === 'in_app' ? Boolean(globals.inApp)
    : channel === 'email' ? Boolean(globals.email)
      : Boolean(globals.sms);
  if (!globallyOn) return false;

  const perChannel = prefsByEvent[eventType];
  if (!perChannel || !perChannel[channel]) return true;
  return perChannel[channel].enabled !== false;
}

/** Every channel currently live for an event, as the dispatcher's `enabled` shape. */
function enabledChannelsFor(prefsByEvent, eventType, globals) {
  return {
    inApp: isChannelEnabled(prefsByEvent, eventType, 'in_app', globals),
    email: isChannelEnabled(prefsByEvent, eventType, 'email', globals),
    sms: isChannelEnabled(prefsByEvent, eventType, 'sms', globals)
  };
}

/**
 * Resolves the audience.
 *
 * `configuredRows` are {event_type, role, user_id}. When an event has any, they
 * replace the built-in audience entirely — an admin who says "only Finance hears
 * about AMC expiry" means only Finance. When it has none, the defaults stand.
 *
 * Returns users from `allUsers`, deduplicated by id, never including inactive ones
 * (the caller passes only active users).
 */
function resolveAudience({ eventType, defaults = [], configuredRows = [], allUsers = [] }) {
  const rows = configuredRows.filter((r) => (r.event_type ?? r.eventType) === eventType);
  if (rows.length === 0) return dedupeById(defaults);

  const roles = new Set(rows.map((r) => r.role).filter(Boolean));
  const userIds = new Set(rows.map((r) => r.user_id ?? r.userId).filter((id) => id != null));

  const chosen = allUsers.filter((u) => roles.has(u.role) || userIds.has(u.id));
  return dedupeById(chosen);
}

function dedupeById(users) {
  const seen = new Map();
  for (const u of users) {
    if (u && !seen.has(u.id)) seen.set(u.id, u);
  }
  return [...seen.values()];
}

/** True when the event should not be dispatched at all. */
function isEventSuppressed(prefsByEvent, eventType, ctx = {}, globals = {}) {
  if (!meetsPriorityFloor(prefsByEvent, eventType, ctx.priority)) return true;
  const channels = enabledChannelsFor(prefsByEvent, eventType, globals);
  return !channels.inApp && !channels.email && !channels.sms;
}

module.exports = {
  CHANNELS,
  PRIORITY_ORDER,
  indexPreferences,
  priorityFloor,
  meetsPriorityFloor,
  isChannelEnabled,
  enabledChannelsFor,
  resolveAudience,
  isEventSuppressed
};

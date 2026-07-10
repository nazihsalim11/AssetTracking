import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const policy = require('./notificationPolicy.js');

const ALL_ON = { inApp: true, email: true, sms: true };

const users = [
  { id: 1, name: 'Ada', role: 'Super Admin' },
  { id: 2, name: 'Bo', role: 'IT Admin' },
  { id: 3, name: 'Cy', role: 'Finance Team' },
  { id: 4, name: 'Di', role: 'Employee' }
];

/* ------------------------------------------------------------- channels */

test('an event with no preference rows keeps every globally-enabled channel', () => {
  const prefs = policy.indexPreferences([]);
  assert.deepEqual(policy.enabledChannelsFor(prefs, 'ticket.created', ALL_ON), { inApp: true, email: true, sms: true });
});

test('a per-event switch can turn a channel off', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'email', enabled: false }
  ]);
  const ch = policy.enabledChannelsFor(prefs, 'ticket.created', ALL_ON);
  assert.equal(ch.email, false);
  assert.equal(ch.inApp, true, 'other channels are untouched');
});

test('a per-event switch cannot turn a channel ON when the global switch is off', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'sms', enabled: true }
  ]);
  const ch = policy.enabledChannelsFor(prefs, 'ticket.created', { inApp: true, email: true, sms: false });
  assert.equal(ch.sms, false, 'the global kill switch must win');
});

test('preferences for one event do not leak into another', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'email', enabled: false }
  ]);
  assert.equal(policy.enabledChannelsFor(prefs, 'amc.expiring', ALL_ON).email, true);
});

/* ------------------------------------------------------------- priority */

test('a priority floor admits its own level and above', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'email', enabled: true, min_priority: 'Medium' }
  ]);
  assert.equal(policy.meetsPriorityFloor(prefs, 'ticket.created', 'Low'), false);
  assert.equal(policy.meetsPriorityFloor(prefs, 'ticket.created', 'Medium'), true);
  assert.equal(policy.meetsPriorityFloor(prefs, 'ticket.created', 'Critical'), true);
});

test('no floor means everything passes', () => {
  const prefs = policy.indexPreferences([{ event_type: 'ticket.created', channel: 'email', enabled: true }]);
  assert.equal(policy.meetsPriorityFloor(prefs, 'ticket.created', 'Low'), true);
});

// An AMC expiry has no priority. Dropping it because it does not compare would be a
// data-shaped bug: silence where the user expects a reminder.
test('an event with no priority is never dropped by a floor', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'amc.expiring', channel: 'email', enabled: true, min_priority: 'Critical' }
  ]);
  assert.equal(policy.meetsPriorityFloor(prefs, 'amc.expiring', undefined), true);
  assert.equal(policy.meetsPriorityFloor(prefs, 'amc.expiring', 'Nonsense'), true);
});

/* ----------------------------------------------------------- recipients */

// The critical default: an admin who has never opened the settings page must keep
// receiving everything. No configured rows means "use the built-in audience".
test('no configured recipients falls back to the built-in audience', () => {
  const audience = policy.resolveAudience({
    eventType: 'ticket.created',
    defaults: [users[0], users[1]],
    configuredRows: [],
    allUsers: users
  });
  assert.deepEqual(audience.map((u) => u.id), [1, 2]);
});

test('configured roles replace the default audience entirely', () => {
  const audience = policy.resolveAudience({
    eventType: 'amc.expiring',
    defaults: [users[0], users[1]],
    configuredRows: [{ event_type: 'amc.expiring', role: 'Finance Team', user_id: null }],
    allUsers: users
  });
  assert.deepEqual(audience.map((u) => u.id), [3], 'only Finance, not the admin defaults');
});

test('roles and individual users are unioned and deduplicated', () => {
  const audience = policy.resolveAudience({
    eventType: 'ticket.created',
    defaults: [],
    configuredRows: [
      { event_type: 'ticket.created', role: 'IT Admin', user_id: null },
      { event_type: 'ticket.created', role: null, user_id: 2 },
      { event_type: 'ticket.created', role: null, user_id: 3 }
    ],
    allUsers: users
  });
  assert.deepEqual(audience.map((u) => u.id).sort(), [2, 3], 'Bo matched by both role and id, listed once');
});

test('rows for other events are ignored', () => {
  const audience = policy.resolveAudience({
    eventType: 'ticket.created',
    defaults: [users[0]],
    configuredRows: [{ event_type: 'amc.expiring', role: 'Finance Team', user_id: null }],
    allUsers: users
  });
  assert.deepEqual(audience.map((u) => u.id), [1], 'falls back to defaults');
});

test('a configured recipient who no longer exists yields nobody, not everybody', () => {
  const audience = policy.resolveAudience({
    eventType: 'ticket.created',
    defaults: [users[0]],
    configuredRows: [{ event_type: 'ticket.created', role: null, user_id: 999 }],
    allUsers: users
  });
  assert.deepEqual(audience, [], 'explicit configuration is honoured even when it selects nobody');
});

/* ----------------------------------------------------------- suppression */

test('an event is suppressed when every channel is off for it', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'in_app', enabled: false },
    { event_type: 'ticket.created', channel: 'email', enabled: false },
    { event_type: 'ticket.created', channel: 'sms', enabled: false }
  ]);
  assert.equal(policy.isEventSuppressed(prefs, 'ticket.created', {}, ALL_ON), true);
});

test('an event is suppressed when it falls below the priority floor', () => {
  const prefs = policy.indexPreferences([
    { event_type: 'ticket.created', channel: 'email', enabled: true, min_priority: 'Critical' }
  ]);
  assert.equal(policy.isEventSuppressed(prefs, 'ticket.created', { priority: 'Low' }, ALL_ON), true);
  assert.equal(policy.isEventSuppressed(prefs, 'ticket.created', { priority: 'Critical' }, ALL_ON), false);
});

test('an unconfigured event is never suppressed', () => {
  const prefs = policy.indexPreferences([]);
  assert.equal(policy.isEventSuppressed(prefs, 'ticket.sla_breached', { priority: 'Low' }, ALL_ON), false);
});

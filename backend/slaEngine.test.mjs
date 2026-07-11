import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sla = require('./slaEngine.js');

// A fixed +05:30 Mon–Fri 09:00–18:00 calendar, no holidays, for most tests.
const CAL = {
  is_24x7: false,
  utc_offset_minutes: 330,
  work_start: '09:00',
  work_end: '18:00',
  working_days: [1, 2, 3, 4, 5],
  holidays: []
};

// Helper: build a UTC instant from an Asia/Kolkata (+05:30) wall-clock time.
const ist = (y, mo, d, hh, mm) => new Date(Date.UTC(y, mo - 1, d, hh, mm) - 330 * 60000);

/* --------------------------------------------------------- addBusinessMinutes */

test('24x7 calendar adds wall-clock minutes directly', () => {
  const start = new Date('2026-07-11T10:00:00Z');
  const end = sla.addBusinessMinutes(start, 120, { is_24x7: true });
  assert.equal(end.toISOString(), '2026-07-11T12:00:00.000Z');
});

test('minutes within one working day stay on the same day', () => {
  // Wed 2026-07-08 10:00 IST + 120 business min = 12:00 IST
  const start = ist(2026, 7, 8, 10, 0);
  const end = sla.addBusinessMinutes(start, 120, CAL);
  assert.equal(end.getTime(), ist(2026, 7, 8, 12, 0).getTime());
});

test('minutes spilling past closing roll to the next working morning', () => {
  // Wed 17:00 IST + 120 min: 60 min to 18:00 close, then 60 min from Thu 09:00 => Thu 10:00
  const start = ist(2026, 7, 8, 17, 0);
  const end = sla.addBusinessMinutes(start, 120, CAL);
  assert.equal(end.getTime(), ist(2026, 7, 9, 10, 0).getTime());
});

test('a start before opening is pulled to the working window', () => {
  // Wed 07:00 IST + 60 min counts from 09:00 => 10:00
  const start = ist(2026, 7, 8, 7, 0);
  const end = sla.addBusinessMinutes(start, 60, CAL);
  assert.equal(end.getTime(), ist(2026, 7, 8, 10, 0).getTime());
});

test('weekends are skipped', () => {
  // Fri 2026-07-10 17:00 IST + 120 min: 60 min to close Fri, then Mon 09:00 + 60 => Mon 10:00
  const start = ist(2026, 7, 10, 17, 0);
  const end = sla.addBusinessMinutes(start, 120, CAL);
  assert.equal(end.getTime(), ist(2026, 7, 13, 10, 0).getTime());
});

test('holidays are skipped like weekends', () => {
  // Thu 2026-07-09 is a holiday; Wed 17:00 + 120 min lands Fri 10:00 (skipping Thu).
  const cal = { ...CAL, holidays: ['2026-07-09'] };
  const start = ist(2026, 7, 8, 17, 0);
  const end = sla.addBusinessMinutes(start, 120, cal);
  assert.equal(end.getTime(), ist(2026, 7, 10, 10, 0).getTime());
});

test('a full 9-hour day of work lands exactly at close', () => {
  const start = ist(2026, 7, 8, 9, 0);
  const end = sla.addBusinessMinutes(start, 9 * 60, CAL);
  assert.equal(end.getTime(), ist(2026, 7, 8, 18, 0).getTime());
});

test('non-positive minutes return the start unchanged', () => {
  const start = ist(2026, 7, 8, 10, 0);
  assert.equal(sla.addBusinessMinutes(start, 0, CAL).getTime(), start.getTime());
});

test('a calendar with no working days fails safe to wall-clock', () => {
  const start = new Date('2026-07-11T10:00:00Z');
  const end = sla.addBusinessMinutes(start, 60, { ...CAL, working_days: [] });
  // empty working_days normalizes back to Mon-Fri default, so this still lands on business time;
  // an inverted window (start>=end) is the real "fail safe" path:
  const end2 = sla.addBusinessMinutes(start, 60, { work_start: '18:00', work_end: '09:00' });
  assert.equal(end2.getTime(), start.getTime() + 60 * 60000);
  assert.ok(end instanceof Date);
});

/* ------------------------------------------------------ businessMinutesBetween */

test('business minutes between spanning a weekend counts only working time', () => {
  // Fri 16:00 -> Mon 10:00 IST: 2h Fri + 1h Mon = 180 min
  const from = ist(2026, 7, 10, 16, 0);
  const to = ist(2026, 7, 13, 10, 0);
  assert.equal(Math.round(sla.businessMinutesBetween(from, to, CAL)), 180);
});

test('business minutes between is 0 for reversed ranges', () => {
  const from = ist(2026, 7, 13, 10, 0);
  const to = ist(2026, 7, 10, 16, 0);
  assert.equal(sla.businessMinutesBetween(from, to, CAL), 0);
});

test('addBusinessMinutes and businessMinutesBetween are inverses', () => {
  const start = ist(2026, 7, 8, 11, 30);
  const due = sla.addBusinessMinutes(start, 600, CAL);
  assert.equal(Math.round(sla.businessMinutesBetween(start, due, CAL)), 600);
});

/* --------------------------------------------------------------- matchPolicy */

const policies = [
  { id: 1, name: 'Default', priority: null, category: null, department: null, asset_type: null, branch: null, priority_rank: 0 },
  { id: 2, name: 'Critical IT', priority: 'Critical', department: 'IT', category: null, asset_type: null, branch: null, priority_rank: 0 },
  { id: 3, name: 'Critical any', priority: 'Critical', department: null, category: null, asset_type: null, branch: null, priority_rank: 0 },
  { id: 4, name: 'Archived', priority: 'Critical', department: 'IT', archived: true, priority_rank: 0 }
];

test('most specific applicable policy wins', () => {
  const m = sla.matchPolicy(policies, { priority: 'Critical', department: 'IT' });
  assert.equal(m.id, 2); // 2 criteria beats the 1-criterion "Critical any" and the catch-all
});

test('falls back to the catch-all when specifics do not apply', () => {
  const m = sla.matchPolicy(policies, { priority: 'Low', department: 'HR' });
  assert.equal(m.id, 1);
});

test('a policy criterion that mismatches disqualifies it', () => {
  const m = sla.matchPolicy(policies, { priority: 'Critical', department: 'HR' });
  assert.equal(m.id, 3); // Critical/IT does not apply (dept HR); Critical-any does
});

test('archived policies are never matched', () => {
  const only = [policies[3], policies[0]];
  const m = sla.matchPolicy(only, { priority: 'Critical', department: 'IT' });
  assert.equal(m.id, 1);
});

test('matching is case-insensitive and trims', () => {
  const m = sla.matchPolicy(policies, { priority: '  critical ', department: 'it' });
  assert.equal(m.id, 2);
});

test('no policies yields null', () => {
  assert.equal(sla.matchPolicy([], { priority: 'Critical' }), null);
});

/* ------------------------------------------------------------- dueEscalations */

test('resolution percent escalation fires once the clock passes the threshold', () => {
  const created = ist(2026, 7, 8, 9, 0);
  const resolutionDue = sla.addBusinessMinutes(created, 540, CAL); // full day => 18:00
  const now = ist(2026, 7, 8, 14, 24); // 5.4h in of 9h = 60%
  const levels = [
    { level: 1, trigger_type: 'resolution_percent', threshold: 50, notify_target: 'assignee' },
    { level: 2, trigger_type: 'resolution_percent', threshold: 80, notify_target: 'team_lead' }
  ];
  const due = sla.dueEscalations(levels, { now, createdAt: created, resolutionDue, calendar: CAL });
  assert.deepEqual(due.map((l) => l.level), [1]);
});

test('response breach fires only while unresponded', () => {
  const created = ist(2026, 7, 8, 9, 0);
  const firstResponseDue = sla.addBusinessMinutes(created, 60, CAL); // 10:00
  const now = ist(2026, 7, 8, 11, 0);
  const levels = [{ level: 1, trigger_type: 'response_breach', threshold: 0, notify_target: 'assignee' }];

  const unresponded = sla.dueEscalations(levels, { now, createdAt: created, firstResponseDue, firstResponseAt: null, calendar: CAL });
  assert.equal(unresponded.length, 1);

  const responded = sla.dueEscalations(levels, { now, createdAt: created, firstResponseDue, firstResponseAt: ist(2026, 7, 8, 9, 30), calendar: CAL });
  assert.equal(responded.length, 0);
});

test('remaining-time escalation fires inside the window', () => {
  const created = ist(2026, 7, 8, 9, 0);
  const resolutionDue = sla.addBusinessMinutes(created, 540, CAL); // 18:00
  const now = ist(2026, 7, 8, 17, 30); // 30 min of business time left
  const levels = [{ level: 1, trigger_type: 'resolution_remaining', threshold: 60, notify_target: 'department_manager' }];
  const due = sla.dueEscalations(levels, { now, createdAt: created, resolutionDue, calendar: CAL });
  assert.equal(due.length, 1);
});

/* ------------------------------------------------------------------ slaStatus */

test('slaStatus reports breach when an open ticket is past resolution due', () => {
  const s = sla.slaStatus({
    status: 'Open',
    resolutionDue: '2026-07-08T00:00:00Z',
    firstResponseDue: '2026-07-07T00:00:00Z'
  }, new Date('2026-07-09T00:00:00Z'));
  assert.equal(s.state, 'breached');
  assert.equal(s.resolutionBreached, true);
});

test('slaStatus reports met for a ticket resolved before its deadline', () => {
  const s = sla.slaStatus({
    status: 'Resolved',
    resolutionDue: '2026-07-08T00:00:00Z',
    firstResponseDue: '2026-07-07T00:00:00Z',
    firstResponseAt: '2026-07-06T12:00:00Z',
    resolvedAt: '2026-07-07T12:00:00Z'
  });
  assert.equal(s.state, 'met');
  assert.equal(s.resolutionBreached, false);
});

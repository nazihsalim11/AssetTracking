import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimestamp,
  formatRelativeTimestamp,
  formatAbsoluteTimestamp,
  parseTimestamp,
  msUntilLabelChanges
} from './time.js';

const S = 1000;
const M = 60 * S;
const H = 60 * M;
const D = 24 * H;

// A fixed "now": Wednesday 8 July 2026, 14:30 local time.
const now = new Date(2026, 6, 8, 14, 30, 0).getTime();
const ago = (ms) => new Date(now - ms);

test('recent events read as "Just now"', () => {
  assert.equal(formatTimestamp(ago(0), now), 'Just now');
  assert.equal(formatTimestamp(ago(44 * S), now), 'Just now');
});

test('minutes and hours', () => {
  assert.equal(formatTimestamp(ago(46 * S), now), '1 minute ago');
  assert.equal(formatTimestamp(ago(89 * S), now), '1 minute ago');
  assert.equal(formatTimestamp(ago(5 * M), now), '5 minutes ago');
  assert.equal(formatTimestamp(ago(59 * M), now), '59 minutes ago');
  assert.equal(formatTimestamp(ago(60 * M), now), '1 hour ago');
  assert.equal(formatTimestamp(ago(89 * M), now), '1 hour ago');
  assert.equal(formatTimestamp(ago(2 * H), now), '2 hours ago');
  assert.equal(formatTimestamp(ago(13 * H), now), '13 hours ago');
});

// "Yesterday" is a calendar question, not a 24-hour one.
test('day boundaries follow the local calendar, not elapsed hours', () => {
  assert.equal(formatTimestamp(ago(15 * H), now), 'Yesterday'); // 23:30 prev day
  assert.equal(formatTimestamp(ago(30 * H), now), 'Yesterday'); // 08:30 prev day
  assert.equal(formatTimestamp(ago(40 * H), now), '2 days ago'); // two midnights
  assert.equal(formatTimestamp(new Date(2026, 6, 7, 23, 59), now), 'Yesterday');
  assert.equal(formatTimestamp(new Date(2026, 6, 8, 0, 1), now), '14 hours ago');
});

test('older than a week falls back to an absolute date', () => {
  const old = new Date(2026, 5, 20, 9, 15, 0);
  assert.equal(formatRelativeTimestamp(ago(8 * D), now), null);
  assert.equal(formatTimestamp(old, now), formatAbsoluteTimestamp(old));
  assert.equal(formatAbsoluteTimestamp(old), '20 Jun 2026, 9:15 am');
});

test('a slightly-future timestamp is clock skew, not a scheduled event', () => {
  assert.equal(formatTimestamp(new Date(now + 30 * S), now), 'Just now');
});

test('missing or unparseable values never render "Invalid Date"', () => {
  assert.equal(formatTimestamp(null, now), '');
  assert.equal(formatTimestamp(undefined, now), '');
  assert.equal(formatTimestamp('not a date', now), '');
  assert.equal(parseTimestamp(''), null);
});

test('accepts the ISO strings the API actually returns', () => {
  assert.equal(formatTimestamp(new Date(now - 2 * H).toISOString(), now), '2 hours ago');
});

test('schedules the next tick for when the label actually changes', () => {
  assert.equal(msUntilLabelChanges(ago(0), now), 45 * S);
  assert.equal(msUntilLabelChanges(ago(5 * M + 30 * S), now), 30 * S);
});

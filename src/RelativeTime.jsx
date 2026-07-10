import React, { useEffect, useState } from 'react';
import { formatTimestamp, formatAbsoluteTimestamp, parseTimestamp, msUntilLabelChanges } from './time';

/**
 * Renders a record's creation time and keeps it current, so "Just now" becomes
 * "1 minute ago" without a page refresh.
 *
 * Rather than every instance owning a timer, they share one module-level clock.
 * Subscribers are re-notified on the tightest deadline any of them needs (see
 * msUntilLabelChanges), capped at a minute, so a screenful of notifications costs
 * one timer instead of dozens.
 */

const subscribers = new Set();
let timerId = null;

const MAX_TICK_MS = 60 * 1000;
const MIN_TICK_MS = 1000;

function scheduleTick() {
  if (timerId !== null) clearTimeout(timerId);
  if (subscribers.size === 0) {
    timerId = null;
    return;
  }

  const now = Date.now();
  let soonest = MAX_TICK_MS;
  for (const sub of subscribers) {
    const due = msUntilLabelChanges(sub.value, now);
    if (due !== null && due < soonest) soonest = due;
  }

  timerId = setTimeout(() => {
    timerId = null;
    for (const sub of subscribers) sub.onTick(Date.now());
    scheduleTick();
  }, Math.max(MIN_TICK_MS, soonest));
}

function useLiveNow(value) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const sub = { value, onTick: setNow };
    subscribers.add(sub);
    scheduleTick();
    return () => {
      subscribers.delete(sub);
      scheduleTick();
    };
  }, [value]);

  return now;
}

const RelativeTime = ({ value, className, style, fallback = '—' }) => {
  const now = useLiveNow(value);
  const date = parseTimestamp(value);

  if (!date) {
    return <span className={className} style={style}>{fallback}</span>;
  }

  return (
    <time
      className={className}
      style={style}
      dateTime={date.toISOString()}
      // The exact instant stays one hover away once the label goes fuzzy.
      title={formatAbsoluteTimestamp(date)}
    >
      {formatTimestamp(date, now)}
    </time>
  );
};

export default RelativeTime;

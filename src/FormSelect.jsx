import React, { useState } from 'react';
import CustomSelect from './CustomSelect';

/**
 * A searchable, database-driven dropdown for master-data fields (department, location…).
 *
 * Wraps CustomSelect so it works in two modes:
 *   - Uncontrolled (default): seed with `defaultValue`; the selection participates in the
 *     surrounding <form>'s FormData via the `name` prop, so existing FormData-based submit
 *     handlers keep working with no extra wiring.
 *   - Controlled: pass `value` + `onChange` to drive it from parent state.
 *
 * `options` may be strings or { value, label }. The current value is always kept selectable
 * even if it is no longer in the master list (e.g. an archived department on an old record),
 * so editing a legacy row never silently drops its value.
 *
 * There is no hardcoded fallback list: when the master is empty the control shows an empty
 * state and (optionally) `emptyHint`, rather than substituting placeholder options.
 */
export default function FormSelect({
  name,
  options = [],
  defaultValue = '',
  value: controlledValue,
  onChange,
  required = false,
  placeholder,
  disabled = false,
  searchable = true,
  emptyHint,
  style
}) {
  const isControlled = controlledValue !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? '');
  const value = isControlled ? controlledValue : internal;

  const normalized = options.map((o) => (o && typeof o === 'object' ? { value: o.value, label: o.label ?? o.value } : { value: o, label: o }));
  if (value && !normalized.some((o) => String(o.value) === String(value))) {
    normalized.unshift({ value, label: value });
  }

  const handleChange = (e) => {
    if (!isControlled) setInternal(e.target.value);
    onChange?.(e);
  };

  return (
    <>
      <CustomSelect
        name={name}
        value={value}
        onChange={handleChange}
        options={normalized}
        required={required}
        disabled={disabled}
        searchable={searchable}
        placeholder={placeholder || (normalized.length ? 'Select…' : 'None available')}
        searchPlaceholder="Type to filter…"
        style={style}
      />
      {normalized.length === 0 && emptyHint && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emptyHint}</span>
      )}
    </>
  );
}

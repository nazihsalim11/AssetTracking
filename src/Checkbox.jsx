import React, { useEffect, useRef } from 'react';

/**
 * The one checkbox in the application.
 *
 * It wraps a real <input type="checkbox">, styled in index.css, rather than a
 * <button> holding a Square/CheckSquare icon. The icon version — which is what the
 * ticket and inbox tables used — is not announced as a checkbox, has no checked
 * state for assistive tech, cannot be reached by a form, and has no way to express
 * "some but not all rows are selected".
 *
 * `indeterminate` is a DOM property with no HTML attribute, so React cannot set it
 * declaratively; it has to be written to the node. That is the whole reason this is
 * a component and not just a class.
 */
const Checkbox = ({
  checked = false,
  indeterminate = false,
  onChange,
  disabled = false,
  label,
  id,
  className = '',
  'aria-label': ariaLabel,
  ...rest
}) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = Boolean(indeterminate) && !checked;
    }
  }, [indeterminate, checked]);

  const input = (
    <input
      ref={inputRef}
      type="checkbox"
      id={id}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label ? undefined : ariaLabel}
      // Screen readers announce "mixed" only when this is set alongside the
      // indeterminate property.
      aria-checked={indeterminate && !checked ? 'mixed' : undefined}
      {...rest}
    />
  );

  if (!label) {
    return React.cloneElement(input, { className: className || undefined });
  }

  return (
    <label className={`checkbox ${disabled ? 'is-disabled' : ''} ${className}`.trim()}>
      {input}
      <span className="checkbox-label">{label}</span>
    </label>
  );
};

export default Checkbox;

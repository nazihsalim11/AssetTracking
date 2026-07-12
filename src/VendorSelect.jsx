import React from 'react';
import FormSelect from './FormSelect';

/**
 * The single, consistent way to pick a vendor anywhere in the app.
 *
 * Populated from the Vendor Registry and emits the vendor *id* (stored as vendor_id),
 * while showing the vendor name. Works controlled (pass value + onChange) or uncontrolled
 * (pass defaultValue and let it participate in the surrounding form's FormData via `name`).
 *
 * When the registry is empty it shows an empty state; if the current user may manage
 * vendors and an `onManageVendors` handler is provided, it offers a shortcut to go create
 * one, otherwise it explains who can.
 */
export default function VendorSelect({
  vendors = [],
  value,
  onChange,
  defaultValue,
  name = 'vendorId',
  required = false,
  disabled = false,
  canManageVendors = false,
  onManageVendors,
}) {
  return (
    <>
      <FormSelect
        name={name}
        options={vendors.map((v) => ({ value: String(v.id), label: v.name }))}
        value={value}
        onChange={onChange}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        placeholder={vendors.length ? 'Select a vendor…' : 'No vendors in registry'}
      />
      {vendors.length === 0 && (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          No vendors yet.{' '}
          {canManageVendors && onManageVendors ? (
            <button
              type="button"
              onClick={onManageVendors}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
            >
              Add one in the Vendor Registry
            </button>
          ) : (
            'Ask an administrator to add vendors in the Vendor Registry.'
          )}
        </span>
      )}
    </>
  );
}

const db = require('../../db');

/**
 * Resolve a vendor reference for records that store a vendor_id foreign key into the
 * vendor master while also keeping a denormalised vendor *name* for display and history.
 *
 * Preferred input is `vendorId` (chosen from the searchable vendor dropdown); the name is
 * then read authoritatively from the master. A free-text `vendor` name is still accepted
 * as a fallback (bulk imports, legacy callers) so nothing that worked before breaks.
 *
 * Throws an Error with .statusCode = 400 when neither is usable, or the id is unknown.
 */
async function resolveVendor(body, { required = true } = {}) {
  const vendorId = body.vendorId != null && body.vendorId !== '' ? body.vendorId : null;
  const freeText = (body.vendor || '').trim();

  if (vendorId) {
    const { rows } = await db.query('SELECT id, name FROM vendors WHERE id = $1', [vendorId]);
    if (!rows.length) {
      throw Object.assign(new Error('Selected vendor no longer exists'), { statusCode: 400 });
    }
    // The master name wins over any stale text the client may have sent alongside the id.
    return { vendorId: rows[0].id, vendorName: rows[0].name };
  }

  if (freeText) {
    return { vendorId: null, vendorName: freeText };
  }

  if (required) {
    throw Object.assign(
      new Error('A vendor is required — pick one from the vendor registry.'),
      { statusCode: 400 }
    );
  }
  return { vendorId: null, vendorName: null };
}

module.exports = { resolveVendor };

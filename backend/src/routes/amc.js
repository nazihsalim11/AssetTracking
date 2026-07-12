const db = require('../../db');
const { resolveVendor } = require('../utils/vendor');

// AMC (annual maintenance contract) API — extracted verbatim from server.js.
function register(app, { requirePermission }) {
  app.get('/api/amcs', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM amcs ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });

  app.post('/api/amcs', async (req, res) => {
    const actingUser = await requirePermission(req, res, 'amc', 'create');
    if (!actingUser) return;
    const { id, cost, startDate, endDate, serviceSchedule, agreementFile, serviceHistory, poNumber } = req.body;

    // The PO number is the contract's business identifier, so it is required and
    // unique. Uniqueness is enforced case-insensitively by an index; the 23505 below
    // turns that into a readable message instead of a 500.
    if (!poNumber || !String(poNumber).trim()) {
      return res.status(400).json({ error: 'PO Number is required for an AMC contract.' });
    }

    // Vendor now comes from the registry (vendor_id); the name is snapshotted for display.
    let vendorId, vendorName;
    try {
      ({ vendorId, vendorName } = await resolveVendor(req.body));
    } catch (err) {
      return res.status(err.statusCode || 400).json({ error: err.message });
    }

    const query = `
      INSERT INTO amcs (id, vendor, vendor_id, cost, start_date, end_date, service_schedule, agreement_file, service_history, po_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      id, vendorName, vendorId, cost || 0, startDate, endDate, serviceSchedule || 'Quarterly', agreementFile || '',
      JSON.stringify(serviceHistory || []), String(poNumber).trim()
    ];

    try {
      const result = await db.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        const field = /po_number/.test(err.message) ? `PO Number "${poNumber}"` : `AMC ID "${id}"`;
        return res.status(409).json({ error: `${field} already exists.` });
      }
      console.error('POST /api/amcs failed:', err);
      res.status(500).json({ error: 'Database insertion failed: ' + err.message });
    }
  });

  app.patch('/api/amcs/:id', async (req, res) => {
    const { id } = req.params;
    const { serviceHistory } = req.body;
    try {
      const result = await db.query(
        'UPDATE amcs SET service_history = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [JSON.stringify(serviceHistory), id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'AMC not found' });
      res.json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database update failed: ' + err.message });
    }
  });
}

module.exports = { register };

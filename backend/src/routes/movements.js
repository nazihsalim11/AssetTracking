const db = require('../../db');

// Movements API — extracted verbatim from server.js. Movement history names assets
// and custodians, so it is scoped the same way the directory is: an employee sees
// only the history of assets they currently hold.
function register(app, { requireUser, requirePermission, isEmployee, EMPLOYEE_ASSET_IDS }) {
  app.get('/api/movements', async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    try {
      const result = isEmployee(user)
        ? await db.query(
            `SELECT * FROM movements WHERE asset_id IN (${EMPLOYEE_ASSET_IDS})
             ORDER BY date DESC, created_at DESC`,
            [user.id]
          )
        : await db.query('SELECT * FROM movements ORDER BY date DESC, created_at DESC');
      res.json(result.rows);
    } catch (err) {
      console.error('GET /api/movements failed:', err);
      res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  });

  app.post('/api/movements', async (req, res) => {
    const actingUser = await requirePermission(req, res, 'allocations', 'create');
    if (!actingUser) return;

    const { assetId, date, type, from, to, actor, notes } = req.body;
    const query = `
      INSERT INTO movements (asset_id, date, type, from_loc, to_loc, actor, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [assetId, date || new Date(), type, from || '', to || '', actor, notes || ''];

    try {
      const result = await db.query(query, values);
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database insertion failed: ' + err.message });
    }
  });
}

module.exports = { register };

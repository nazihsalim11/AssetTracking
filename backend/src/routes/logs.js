const db = require('../../db');

// System logs API — extracted verbatim from server.js.
function register(app) {
  app.get('/api/logs', async (req, res) => {
    try {
      const result = await db.query('SELECT * FROM system_logs ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Database query failed' });
    }
  });

  app.post('/api/logs', async (req, res) => {
    // A client-supplied timestamp is ignored: created_at is set by the database, so
    // a caller with a wrong clock cannot back-date a log entry.
    const { actor, action, detail } = req.body;
    const query = `
      INSERT INTO system_logs (actor, action, detail)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const values = [actor, action, detail || ''];

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

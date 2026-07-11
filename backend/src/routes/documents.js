const db = require('../../db');

// Documents API — extracted verbatim from server.js. Access is enforced server-side
// against the role_permissions matrix, so a role without viewDocuments cannot read
// the repository even by calling the API directly.
function register(app, { requireUser, roleAllows }) {
  app.get('/api/documents', async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    try {
      if (!(await roleAllows(user.role, 'documents', 'view'))) {
        return res.status(403).json({ error: 'Your role is not permitted to view the Document Repository.' });
      }
      const result = await db.query('SELECT * FROM documents ORDER BY created_at DESC');
      res.json(result.rows);
    } catch (err) {
      console.error('GET /api/documents failed:', err);
      res.status(500).json({ error: 'Database query failed: ' + err.message });
    }
  });

  app.post('/api/documents', async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    try {
      if (!(await roleAllows(user.role, 'documents', 'create'))) {
        return res.status(403).json({ error: 'Your role is not permitted to add documents.' });
      }
      const { name, type, size, uploadDate, association, fileUrl } = req.body;
      // The database issues the id from a sequence; any client-supplied id is ignored.
      const idRow = await db.query(`SELECT 'DOC-' || LPAD(nextval('documents_doc_seq')::text, 3, '0') AS id`);
      const id = idRow.rows[0].id;

      const result = await db.query(
        `INSERT INTO documents (id, name, type, file_size, upload_date, association, file_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, name, type, size || '', uploadDate, association || '', fileUrl || '']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('POST /api/documents failed:', err);
      res.status(500).json({ error: 'Database insertion failed: ' + err.message });
    }
  });
}

module.exports = { register };

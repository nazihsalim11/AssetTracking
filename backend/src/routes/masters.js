const db = require('../../db');

/**
 * Department & Location master data.
 *
 * These replace the old free-text-with-hardcoded-fallback approach: every module now
 * populates its department/location pickers from these endpoints, which are the single
 * source of truth. Records elsewhere (assets, users, tickets…) continue to store the
 * *name* for display and historical stability, but the name always originates here.
 *
 * List endpoints return active rows only by default; pass ?all=true (admin management
 * screens) to include archived ones. DELETE archives rather than destroys, so the
 * historical rows that reference a department by name stay meaningful.
 *
 * Departments are gated by the `departments` permission resource, locations by
 * `branches` (the pre-existing key for physical sites).
 */
function register(app, { requirePermission, requireUser }) {
  const mapRow = (r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? r.address ?? null,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  // Builds the four CRUD routes for one master table. `extraCol` is the optional second
  // text column (departments → description, locations → address).
  function crud({ base, table, resource, label, extraCol }) {
    const cols = extraCol ? `id, name, ${extraCol} AS description, is_active, created_at, updated_at`
                          : `id, name, NULL AS description, is_active, created_at, updated_at`;

    // LIST — active only unless ?all=true. Readable by any authenticated user: the
    // dropdowns that consume it appear in forms used across every role, so the read gate
    // is deliberately just authentication. Writes below stay permission-gated.
    app.get(`/api/${base}`, async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const includeArchived = req.query.all === 'true';
        const where = includeArchived ? '' : 'WHERE is_active = TRUE';
        const { rows } = await db.query(
          `SELECT ${cols} FROM ${table} ${where} ORDER BY LOWER(name)`
        );
        res.json(rows.map(mapRow));
      } catch (err) {
        console.error(`GET /api/${base} failed:`, err);
        res.status(500).json({ error: `Could not load ${label}: ${err.message}` });
      }
    });

    // CREATE
    app.post(`/api/${base}`, async (req, res) => {
      const user = await requirePermission(req, res, resource, 'create');
      if (!user) return;
      const name = (req.body.name || '').trim();
      const extra = extraCol ? (req.body.description ?? req.body.address ?? null) : null;
      if (!name) return res.status(400).json({ error: 'Name is required' });
      try {
        const insertCols = extraCol ? `name, ${extraCol}, created_by` : 'name, created_by';
        const insertVals = extraCol ? '$1, $2, $3' : '$1, $2';
        const params = extraCol ? [name, extra, user.name || user.username] : [name, user.name || user.username];
        const { rows } = await db.query(
          `INSERT INTO ${table} (${insertCols}) VALUES (${insertVals})
           RETURNING ${cols}`,
          params
        );
        res.status(201).json(mapRow(rows[0]));
      } catch (err) {
        if (err.code === '23505') {
          return res.status(409).json({ error: `"${name}" already exists.` });
        }
        console.error(`POST /api/${base} failed:`, err);
        res.status(500).json({ error: `Could not create: ${err.message}` });
      }
    });

    // UPDATE — rename, edit the extra column, or archive/restore via isActive.
    app.patch(`/api/${base}/:id`, async (req, res) => {
      const user = await requirePermission(req, res, resource, 'edit');
      if (!user) return;
      const sets = [];
      const params = [];
      let i = 1;
      if (req.body.name !== undefined) {
        const name = String(req.body.name).trim();
        if (!name) return res.status(400).json({ error: 'Name cannot be empty' });
        sets.push(`name = $${i++}`); params.push(name);
      }
      if (extraCol && (req.body.description !== undefined || req.body.address !== undefined)) {
        sets.push(`${extraCol} = $${i++}`); params.push(req.body.description ?? req.body.address ?? null);
      }
      if (req.body.isActive !== undefined) {
        sets.push(`is_active = $${i++}`); params.push(!!req.body.isActive);
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
      params.push(req.params.id);
      try {
        const { rows } = await db.query(
          `UPDATE ${table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING ${cols}`,
          params
        );
        if (!rows.length) return res.status(404).json({ error: `${label} not found` });
        res.json(mapRow(rows[0]));
      } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'That name is already in use.' });
        console.error(`PATCH /api/${base} failed:`, err);
        res.status(500).json({ error: `Could not update: ${err.message}` });
      }
    });

    // DELETE — archive (soft). Records that reference the name by value remain valid.
    app.delete(`/api/${base}/:id`, async (req, res) => {
      const user = await requirePermission(req, res, resource, 'delete');
      if (!user) return;
      try {
        const { rows } = await db.query(
          `UPDATE ${table} SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING ${cols}`,
          [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: `${label} not found` });
        res.json({ archived: true, ...mapRow(rows[0]) });
      } catch (err) {
        console.error(`DELETE /api/${base} failed:`, err);
        res.status(500).json({ error: `Could not archive: ${err.message}` });
      }
    });
  }

  crud({ base: 'departments', table: 'departments', resource: 'departments', label: 'department', extraCol: 'description' });
  crud({ base: 'locations', table: 'locations', resource: 'branches', label: 'location', extraCol: 'address' });
}

module.exports = { register };

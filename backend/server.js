const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cron = require('node-cron');
const { randomUUID } = require('crypto');
const db = require('./db');
const { runMigrations } = require('./migrations');
const storage = require('./storage');
const notifications = require('./notifications');
const scheduler = require('./notifications/scheduler');
const { registerCronRoutes } = require('./cronRoutes');
const permissionModel = require('./permissionModel');
const knowledgeBase = require('./knowledgeBase');
const purchaseOrders = require('./purchaseOrders');
const slaModel = require('./slaModel');
const slaEngine = require('./slaEngine');
const slaRoutes = require('./slaRoutes');
const slaAssignment = require('./slaAssignment');
const dashboards = require('./dashboards');
const reports = require('./reports');
const createAuth = require('./src/middleware/auth');
const assetsRoutes = require('./src/routes/assets');
const amcRoutes = require('./src/routes/amc');
const invoicesRoutes = require('./src/routes/invoices');
const movementsRoutes = require('./src/routes/movements');
const documentsRoutes = require('./src/routes/documents');
const logsRoutes = require('./src/routes/logs');
const notificationsRoutes = require('./src/routes/notifications');
const permissionsRoutes = require('./src/routes/permissions');
const importsRoutes = require('./src/routes/imports');
const assignmentsRoutes = require('./src/routes/assignments');
const validateAndFormatPhone = require('./src/utils/phone');
const createActorOf = require('./src/utils/actor');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const app = express();

// Wide-open CORS is fine for local development, but in production only the
// deployed frontend should be able to call this API. Set ALLOWED_ORIGINS to a
// comma-separated list, e.g. "https://assetflow.vercel.app".
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(cors({
    origin: (origin, callback) => {
      // Same-origin and server-to-server requests carry no Origin header.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      // Reply without the CORS header rather than throwing: the browser blocks the
      // read, and we avoid turning every stray cross-origin probe into a 500.
      callback(null, false);
    }
  }));
} else {
  if (IS_PRODUCTION) {
    console.warn('WARNING: ALLOWED_ORIGINS is not set — this API accepts requests from any origin.');
  }
  app.use(cors());
}

app.use(express.json());

// Liveness probe. Unauthenticated and touches no database, so it can serve as a
// health check for the host, a warm-up ping to wake a sleeping free-tier instance,
// and the frontend's connectivity test — none of which should need a token or log a
// 401. Kept before the auth middleware for exactly that reason.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'assetflow-api', time: new Date().toISOString() });
});

// Middleware to recursively map snake_case request body keys to camelCase
function normalizeSnakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(v => normalizeSnakeToCamel(v));
  } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const keys = Object.keys(obj);
    for (const key of keys) {
      const val = normalizeSnakeToCamel(obj[key]);
      obj[key] = val;
      if (key.includes('_')) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (obj[camelKey] === undefined) {
          obj[camelKey] = val;
        }
      }
    }
  }
  return obj;
}

app.use((req, res, next) => {
  if (req.body) {
    normalizeSnakeToCamel(req.body);
  }
  next();
});

// The development fallback below is committed to this repository, so anyone who
// reads it could forge a token for any user. Refuse to boot without a real secret
// once we are running for real.
if (IS_PRODUCTION && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production. Refusing to start with the public default.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_assetflow_token';

// --- CUSTOM AUTH / JWT USER EXTRACTOR HELPER ---
// Trusting `x-user-role`/`x-user-id` headers let any unauthenticated caller act as
// any user (e.g. create tickets as Super Admin id=1). The frontend never sends them,
// so the fallback is opt-in via env for local integration testing only.
const ALLOW_HEADER_AUTH = process.env.ALLOW_HEADER_AUTH === 'true';

// Authentication + the permission gate live in src/middleware/auth.js. Bound here once
// and destructured into locals so every route below (inline or in a route module) uses
// the same JWT wiring and short-lived role caches.
const auth = createAuth({ db, jwt, permissionModel, JWT_SECRET, ALLOW_HEADER_AUTH });
const {
  loadRolePermissions,
  roleAllows,
  authenticateRequest,
  requireUser,
  invalidateUserRole,
  requirePermission,
  roleCan,
  isEmployee,
  EMPLOYEE_ASSET_IDS,
  requireUserWithDepartment,
} = auth;

// Who performed the request, for notification payloads. Shared by the invoices and
// tickets routes; defined in src/utils/actor.js.
const actorOf = createActorOf(authenticateRequest);

// Files are buffered in memory, then handed to storage.js, which puts them in a
// private Supabase bucket (or on local disk when Supabase is not configured).
// Writing to the container's disk would not survive a redeploy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Serves files written by the local-disk fallback. In production nothing is
// written here — objects live in the private bucket and are reached via signed URLs.
if (!storage.isRemote) {
  app.use('/uploads', express.static(storage.uploadDir));
}

// --- ASSETS API ---
// Extracted verbatim to src/routes/assets.js. Registered here — not at the bottom with
// the other modules — to preserve the original route-registration order exactly.
assetsRoutes.register(app, { requireUser, requirePermission, isEmployee, EMPLOYEE_ASSET_IDS });

// --- AMCS API ---
// Extracted verbatim to src/routes/amc.js; registered in place to keep route order.
amcRoutes.register(app, { requirePermission });


// --- INVOICES API ---
// Extracted verbatim to src/routes/invoices.js (routes + the invoice⇆asset mapping
// helpers); registered in place to preserve route-registration order.
invoicesRoutes.register(app, { requirePermission, actorOf });

// --- MOVEMENTS / DOCUMENTS / LOGS APIs ---
// Extracted verbatim to src/routes/{movements,documents,logs}.js; registered in
// place to preserve route-registration order.
movementsRoutes.register(app, { requireUser, requirePermission, isEmployee, EMPLOYEE_ASSET_IDS });
documentsRoutes.register(app, { requireUser, roleAllows });
logsRoutes.register(app);


// --- NOTIFICATIONS + ROLE-PERMISSIONS APIs ---
// Extracted verbatim to src/routes/{notifications,permissions}.js; registered in
// place. notifications.js covers notifications, the email inbox, and notification
// administration (settings/preferences/history/retry).
notificationsRoutes.register(app, { requireUser, requirePermission, authenticateRequest });
permissionsRoutes.register(app, {
  requireUser,
  roleCan,
  loadRolePermissions,
  invalidateRolePermissions: auth.invalidateRolePermissions,
});

// Auth extractor, the role caches, the permission gate (requirePermission/roleCan),
// isEmployee/EMPLOYEE_ASSET_IDS and requireUserWithDepartment are defined in
// src/middleware/auth.js and bound into locals near the top via createAuth().

// validateAndFormatPhone now lives in src/utils/phone.js (required above).

// Reliable user creation helper used by both manual registration and bulk import
async function createSingleUser(client, { username, password, name, role, email, employeeId, phoneNumber, department, designation, status, resetRequired = false }) {
  // Validate duplicate username (case-insensitive)
  const usernameExists = await client.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
  if (usernameExists.rows.length > 0) {
    throw new Error(`Username '${username}' already exists. Please use a unique Username.`);
  }

  const emailExists = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
  if (emailExists.rows.length > 0) {
    throw new Error(`Email '${email}' is already registered.`);
  }

  if (employeeId) {
    const empIdExists = await client.query('SELECT 1 FROM users WHERE LOWER(employee_id) = LOWER($1)', [employeeId]);
    if (empIdExists.rows.length > 0) {
      throw new Error(`Employee ID '${employeeId}' already exists. Please use a unique Employee ID.`);
    }
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 1. Generate authId
  const { randomUUID } = require('crypto');
  const authId = randomUUID();

  // 2. Insert into auth.users
  const rawUserMetadata = JSON.stringify({ name, role, username });
  const authQuery = `
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, aud, role, 
      is_sso_user, is_anonymous, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES ($1, '00000000-0000-0000-0000-000000000000', $2, $3, 'authenticated', 'authenticated', 
              false, false, NOW(), 
              '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, NOW(), NOW())
  `;
  await client.query(authQuery, [authId, email, passwordHash, rawUserMetadata]);

  // 3. Insert into public.users
  const query = `
    INSERT INTO users (username, password_hash, name, role, email, employee_id, phone_number, department, designation, status, password_reset_required, auth_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id, username, name, role, email, employee_id, phone_number, department, designation, status, password_reset_required, created_at, auth_id;
  `;
  const values = [
    username,
    passwordHash,
    name,
    role,
    email,
    employeeId || null,
    phoneNumber || '',
    department || '',
    designation || '',
    status || 'Active',
    resetRequired,
    authId
  ];
  const result = await client.query(query, values);
  return result.rows[0];
}

// --- BULK IMPORT APIS ---
// Extracted verbatim to src/routes/imports.js (employee + asset import, the
// background-job runner, and multi-row insert batching). No auth gate, as before.
importsRoutes.register(app);

// --- QUANTITY BASED ASSIGNMENT APIS ---
// Extracted verbatim to src/routes/assignments.js; registered in place.
assignmentsRoutes.register(app, { requireUser, requirePermission, isEmployee });

// --- DEPARTMENTAL TICKETING SYSTEM APIS ---

// Map snake_case DB rows to camelCase for the frontend
const mapTicket = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  subject: row.subject,
  description: row.description,
  department: row.department,
  priority: row.priority,
  status: row.status,
  category: row.category || 'Software',
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  assignedTo: row.assigned_to,
  assignedToName: row.assigned_to_name,
  ticketType: row.ticket_type || 'Incident',
  slaDeadline: row.sla_deadline,
  resolvedAt: row.resolved_at,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  escalated: row.escalated || false,
  escalatedAt: row.escalated_at,
  // Wall-clock hours from creation to resolution, for the tracking panel.
  resolutionHours: row.resolved_at
    ? Math.max(0, Math.round((new Date(row.resolved_at) - new Date(row.created_at)) / 36e5 * 10) / 10)
    : null,
  // Database-driven SLA tracking.
  slaPolicyId: row.sla_policy_id || null,
  branch: row.branch || null,
  assetType: row.asset_type || null,
  firstResponseDue: row.first_response_due || null,
  resolutionDue: row.resolution_due || row.sla_deadline || null,
  firstResponseAt: row.first_response_at || null,
  responseBreached: row.response_breached || false,
  resolutionBreached: row.resolution_breached || false,
  escalationLevel: row.escalation_level || 0,
  slaStatus: slaEngine.slaStatus({
    status: row.status,
    resolutionDue: row.resolution_due || row.sla_deadline,
    firstResponseDue: row.first_response_due,
    firstResponseAt: row.first_response_at,
    resolvedAt: row.resolved_at
  }).state
});

const mapComment = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  authorName: row.author_name,
  authorId: row.author_id,
  commentText: row.comment_text,
  text: row.comment_text,
  isInternal: row.is_internal,
  createdAt: row.created_at
});

const mapTimeline = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  actorName: row.actor_name,
  action: row.action,
  detail: row.detail,
  createdAt: row.created_at
});

const mapAttachment = (row) => ({
  id: row.id,
  ticketId: row.ticket_id,
  name: row.file_name,
  fileName: row.file_name,
  fileUrl: row.file_url,
  fileType: row.file_type,
  fileSize: row.file_size,
  uploadedBy: row.uploaded_by,
  createdAt: row.created_at
});

app.get('/api/tickets', async (req, res) => {
  const user = await requireUserWithDepartment(req, res);
  if (!user) return;

  let query = 'SELECT * FROM tickets';
  const params = [];

  if (user.role === 'Super Admin') {
    query += ' ORDER BY created_at DESC';
  } else if (user.role === 'Employee') {
    query += ' WHERE created_by = $1 ORDER BY created_at DESC';
    params.push(user.id);
  } else {
    query += ' WHERE department = $1 ORDER BY created_at DESC';
    params.push(user.department || '');
  }

  try {
    const result = await db.query(query, params);
    res.json(result.rows.map(mapTicket));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// --- BULK TICKET OPERATIONS (must be defined before /:id routes) ---
app.post('/api/tickets/bulk/status', async (req, res) => {
  const { ticketIds, status } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to bulk-edit tickets.' });

  const validStatuses = ['Open', 'In Progress', 'Pending', 'On Hold', 'Resolved', 'Closed', 'Reopened', 'Waiting for Employee'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const tid of ticketIds) {
      const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1', [tid]);
      if (ticketRes.rows.length > 0) {
        const ticket = ticketRes.rows[0];
        const prev = ticket.status;
        const now = new Date();
        let resolvedAt = ticket.resolved_at;
        let closedAt = ticket.closed_at;
        if (status === 'Resolved') resolvedAt = now;
        else if (status === 'Closed') closedAt = now;

        await client.query('UPDATE tickets SET status = $1, resolved_at = $2, closed_at = $3, updated_at = NOW() WHERE id = $4', [status, resolvedAt, closedAt, tid]);
        await client.query(`
          INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
          VALUES ($1, $2, 'Status Changed', $3)
        `, [tid, user.name || user.username, `Bulk status changed from ${prev} to ${status}`]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk status updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk status update' });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/bulk/priority', async (req, res) => {
  const { ticketIds, priority } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to bulk-edit tickets.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const tid of ticketIds) {
      const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1', [tid]);
      if (ticketRes.rows.length > 0) {
        const ticket = ticketRes.rows[0];
        const prev = ticket.priority;
        await client.query('UPDATE tickets SET priority = $1, updated_at = NOW() WHERE id = $2', [priority, tid]);
        await client.query(`
          INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
          VALUES ($1, $2, 'Priority Changed', $3)
        `, [tid, user.name || user.username, `Bulk priority changed from ${prev} to ${priority}`]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk priority updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk priority update' });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/bulk/category', async (req, res) => {
  const { ticketIds, category } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to bulk-edit tickets.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const tid of ticketIds) {
      const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1', [tid]);
      if (ticketRes.rows.length > 0) {
        const ticket = ticketRes.rows[0];
        const prev = ticket.category || 'Software';
        await client.query('UPDATE tickets SET category = $1, updated_at = NOW() WHERE id = $2', [category, tid]);
        await client.query(`
          INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
          VALUES ($1, $2, 'Category Changed', $3)
        `, [tid, user.name || user.username, `Bulk category changed from ${prev} to ${category}`]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk category updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk category update' });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/bulk/department', async (req, res) => {
  const { ticketIds, department } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'manage'))) return res.status(403).json({ error: 'Your role is not permitted to reassign ticket departments.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const tid of ticketIds) {
      const ticketRes = await client.query('SELECT * FROM tickets WHERE id = $1', [tid]);
      if (ticketRes.rows.length > 0) {
        const ticket = ticketRes.rows[0];
        const prev = ticket.department;
        await client.query('UPDATE tickets SET department = $1, updated_at = NOW() WHERE id = $2', [department, tid]);
        await client.query(`
          INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
          VALUES ($1, $2, 'Department Changed', $3)
        `, [tid, user.name || user.username, `Bulk department reassigned from ${prev} to ${department}`]);
      }
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk department reassigned successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk department reassignment' });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/bulk/assign', async (req, res) => {
  const ticketIds = req.body.ticketIds || req.body.ticket_ids;
  const assignToUserId = req.body.assignToUserId || req.body.assign_to_user_id;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to assign tickets.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    let targetName = null;
    let targetId = null;

    if (assignToUserId) {
      const targetUserRes = await client.query('SELECT id, name, username FROM users WHERE id = $1', [assignToUserId]);
      if (targetUserRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Target user not found.' });
      }
      targetName = targetUserRes.rows[0].name || targetUserRes.rows[0].username;
      targetId = targetUserRes.rows[0].id;
    } else {
      targetName = user.name || user.username;
      targetId = user.id;
    }

    for (const tid of ticketIds) {
      await client.query('UPDATE tickets SET assigned_to = $1, assigned_to_name = $2, status = \'In Progress\', updated_at = NOW() WHERE id = $3', [targetId, targetName, tid]);
      await client.query(`
        INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
        VALUES ($1, $2, 'Assigned', $3)
      `, [tid, user.name || user.username, `Bulk assigned ticket to ${targetName}`]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk assignment updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk assignment' });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/bulk/delete', async (req, res) => {
  const { ticketIds } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'delete'))) return res.status(403).json({ error: 'Your role is not permitted to delete tickets.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const tid of ticketIds) {
      await client.query('DELETE FROM tickets WHERE id = $1', [tid]);
    }
    await client.query('COMMIT');
    res.json({ message: 'Bulk deletion successfully executed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed bulk deletion' });
  } finally {
    client.release();
  }
});
// --- END BULK TICKET OPERATIONS ---

app.get('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  const user = await requireUserWithDepartment(req, res);
  if (!user) return;

  try {
    let ticketRes;
    const isInteger = /^\d+$/.test(id);
    if (isInteger) {
      ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1 OR ticket_id = $2::text', [parseInt(id), String(id)]);
    } else {
      ticketRes = await db.query('SELECT * FROM tickets WHERE ticket_id = $1', [id]);
    }
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    if (user.role !== 'Super Admin' && user.role !== 'Employee' && ticket.department !== user.department) {
      return res.status(403).json({ error: 'Access denied to this ticket queue.' });
    }
    if (user.role === 'Employee' && ticket.created_by !== user.id) {
      return res.status(403).json({ error: 'Access denied: You can only view your own tickets.' });
    }

    let commentsQuery = 'SELECT * FROM ticket_comments WHERE ticket_id = $1';
    const commentsParams = [ticket.id];
    if (user.role === 'Employee') {
      commentsQuery += ' AND is_internal = FALSE';
    }
    commentsQuery += ' ORDER BY created_at ASC';
    const commentsRes = await db.query(commentsQuery, commentsParams);

    const timelineRes = await db.query('SELECT * FROM ticket_timeline WHERE ticket_id = $1 ORDER BY created_at ASC', [ticket.id]);
    const attachmentsRes = await db.query('SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at ASC', [ticket.id]);

    // SLA policy detail for the tracking panel — the governing policy's name and its
    // escalation ladder, so the ticket workspace can show what SLA is in force.
    let slaPolicy = null;
    if (ticket.sla_policy_id) {
      const polRes = await db.query(
        `SELECT p.id, p.name, p.first_response_minutes, p.resolution_minutes, c.name AS calendar_name,
                COALESCE((SELECT json_agg(e ORDER BY e.level) FROM sla_escalation_levels e WHERE e.policy_id = p.id), '[]') AS escalation_levels
         FROM sla_policies p LEFT JOIN business_calendars c ON c.id = p.calendar_id
         WHERE p.id = $1`,
        [ticket.sla_policy_id]
      );
      if (polRes.rows.length) {
        const p = polRes.rows[0];
        slaPolicy = {
          id: p.id, name: p.name, calendarName: p.calendar_name,
          firstResponseMinutes: p.first_response_minutes, resolutionMinutes: p.resolution_minutes,
          escalationLevels: (p.escalation_levels || []).map((e) => ({
            level: e.level, triggerType: e.trigger_type, threshold: Number(e.threshold), notifyTarget: e.notify_target
          }))
        };
      }
    }

    res.json({
      ...mapTicket(ticket),
      slaPolicy,
      comments: commentsRes.rows.map(mapComment),
      timeline: timelineRes.rows.map(mapTimeline),
      attachments: attachmentsRes.rows.map(mapAttachment)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/tickets', async (req, res) => {
  const { subject, description, department, priority, attachments, category } = req.body;
  const user = requireUser(req, res);
  if (!user) return;

  if (!subject || !description || !department || !priority) {
    return res.status(400).json({ error: 'Subject, description, department, and priority are required.' });
  }

  // Defaults keep older clients — which send neither field — working unchanged.
  const ticketType = req.body.ticketType || 'Incident';
  if (!knowledgeBase.TICKET_TYPES.includes(ticketType)) {
    return res.status(400).json({ error: `Ticket type must be one of: ${knowledgeBase.TICKET_TYPES.join(', ')}` });
  }
  // Existing tickets carry departments outside the helpdesk queues (e.g. Finance),
  // so this only constrains new ones.
  if (!knowledgeBase.HELPDESK_DEPARTMENTS.includes(department)) {
    return res.status(400).json({ error: `Department must be one of: ${knowledgeBase.HELPDESK_DEPARTMENTS.join(', ')}` });
  }

  // SLA deadlines are now database-driven: match the ticket to the most specific
  // active policy and walk that policy's business calendar. computeDeadlines never
  // throws — an unmatched ticket falls back to a 24h wall-clock resolution — so ticket
  // creation cannot be blocked by SLA configuration.
  // createTicket() snake-cases its body, so assetType arrives as asset_type; accept both.
  const branch = req.body.branch || null;
  const assetType = req.body.assetType || req.body.asset_type || null;
  const createdAt = new Date();
  let sla;
  try {
    sla = await slaModel.computeDeadlines(
      { priority, category: category || 'Software', department, assetType, branch },
      createdAt
    );
  } catch (slaErr) {
    console.error('[sla] deadline computation failed, defaulting to 24h:', slaErr.message);
    sla = { policyId: null, firstResponseDue: null, resolutionDue: new Date(createdAt.getTime() + 24 * 3600 * 1000) };
  }
  // sla_deadline is kept in sync with resolution_due so the existing analytics and
  // breach scheduler (which read sla_deadline) keep working unchanged.
  const slaDeadline = sla.resolutionDue;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // `category` was previously accepted from the client and then silently dropped
    // from the INSERT, so every ticket fell back to the column default.
    const insertQuery = `
      INSERT INTO tickets (subject, description, department, priority, status, created_by, created_by_name, sla_deadline, ticket_id, category, ticket_type,
                           sla_policy_id, first_response_due, resolution_due, branch, asset_type)
      VALUES ($1, $2, $3, $4, 'Open', $5, $6, $7, '', $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const result = await client.query(insertQuery, [
      subject, description, department, priority, user.id, user.name || user.username, slaDeadline,
      category || 'Software', ticketType,
      sla.policyId, sla.firstResponseDue, sla.resolutionDue, branch, assetType
    ]);
    const ticket = result.rows[0];

    const deptCode = department === 'IT' ? 'IT'
      : department === 'HR' ? 'HR'
      : department === 'Administration' ? 'ADM'
      : department === 'Finance' ? 'FIN'
      : department.substring(0, 3).toUpperCase();
    const ticketId = `${deptCode}-${String(ticket.id).padStart(6, '0')}`;
    await client.query('UPDATE tickets SET ticket_id = $1 WHERE id = $2', [ticketId, ticket.id]);
    ticket.ticket_id = ticketId;

    await client.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Created', 'Ticket created by employee')
    `, [ticket.id, user.name || user.username]);

    // Automatic technician assignment, if the governing policy asks for it. Done inside
    // the same transaction so a created ticket is never briefly unassigned; the
    // notification is fired after COMMIT. Failure here must not fail ticket creation.
    let autoAssigned = null;
    if (sla.policy && sla.policy.auto_assign_enabled) {
      try {
        const agent = await slaAssignment.pickAgent(
          { department }, sla.policy.auto_assign_strategy, client
        );
        if (agent) {
          const agentName = agent.name || agent.username;
          await client.query(
            `UPDATE tickets SET assigned_to = $1, assigned_to_name = $2, status = 'In Progress', updated_at = NOW() WHERE id = $3`,
            [agent.id, agentName, ticket.id]
          );
          ticket.assigned_to = agent.id;
          ticket.assigned_to_name = agentName;
          ticket.status = 'In Progress';
          await client.query(
            `INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail) VALUES ($1, 'System', 'Assigned', $2)`,
            [ticket.id, `Auto-assigned to ${agentName} (${sla.policy.auto_assign_strategy.replace('_', ' ')}, ${agent.workload} open ticket(s))`]
          );
          autoAssigned = { id: agent.id, name: agentName };
        }
      } catch (assignErr) {
        console.error('[sla] auto-assignment failed:', assignErr.message);
      }
    }

    if (Array.isArray(attachments)) {
      for (const att of attachments) {
        await client.query(`
          INSERT INTO ticket_attachments (ticket_id, file_name, file_url, file_type, file_size, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [ticket.id, att.name, att.fileUrl, att.fileType, att.fileSize, user.name || user.username]);
      }
    }

    await client.query(`
      INSERT INTO system_logs (actor, action, detail)
      VALUES ($1, 'Ticket Creation', $2)
    `, [user.name || user.username, `Created Ticket ${ticketId} in ${department} department`]);

    await client.query('COMMIT');

    // Dispatched after COMMIT: the dispatcher reads through the pool, and email/SMS
    // must not hold a transaction open. Deliberately not awaited — a slow SMTP server
    // should not delay the response, and a notification failure must not fail the request.
    notifications.notify('ticket.created', `ticket-created:${ticket.id}`, {
      ticketId, subject, description, department, priority,
      createdBy: user.id,
      createdByName: user.name || user.username,
      slaDeadline
    });

    // Tell the auto-assigned technician (and the requester) about the assignment.
    if (autoAssigned) {
      notifications.notify('ticket.assigned', `ticket-assigned:${ticket.id}:${autoAssigned.id}`, {
        ticketId, subject, department, priority, slaDeadline,
        assignedTo: autoAssigned.id, assignedToName: autoAssigned.name, createdBy: user.id
      });
    }

    res.status(201).json(mapTicket(ticket));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Ticket creation failed: ' + err.message });
  } finally {
    client.release();
  }
});

app.post('/api/tickets/:id/comments', async (req, res) => {
  const { id } = req.params;
  const commentText = req.body.commentText || req.body.comment_text;
  const isInternal = req.body.isInternal !== undefined ? req.body.isInternal : req.body.is_internal;
  const user = requireUser(req, res);
  if (!user) return;

  if (!commentText) {
    return res.status(400).json({ error: 'Comment text is required.' });
  }

  const isInt = !!isInternal;
  if (isInt && !(await roleCan(user, 'tickets', 'edit'))) {
    return res.status(403).json({ error: 'Your role is not permitted to post internal comments.' });
  }

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    const commentRes = await db.query(`
      INSERT INTO ticket_comments (ticket_id, author_name, author_id, comment_text, is_internal)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [ticket.id, user.name || user.username, user.id, commentText, isInt]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Comment Added', $3)
    `, [ticket.id, user.name || user.username, isInt ? 'Added internal comment' : 'Added public comment']);

    // First response: the earliest public reply from someone other than the requester
    // stops the response-SLA clock. Internal notes and the requester's own comments do
    // not count. Recorded once.
    if (!ticket.first_response_at && !isInt && user.id !== ticket.created_by) {
      await db.query(
        `UPDATE tickets
         SET first_response_at = NOW(),
             response_breached = (first_response_due IS NOT NULL AND NOW() > first_response_due)
         WHERE id = $1 AND first_response_at IS NULL`,
        [ticket.id]
      );
    }

    const notifId = `NTF-CMT-${ticket.ticket_id}-${Date.now()}`;
    const notifText = `${user.name || user.username} commented on ticket ${ticket.ticket_id}`;
    await db.query(`
      INSERT INTO notifications (id, text, type, read)
      VALUES ($1, $2, 'info', FALSE)
    `, [notifId, notifText]);

    res.status(201).json(commentRes.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

app.post('/api/tickets/:id/assign', async (req, res) => {
  const { id } = req.params;
  const assignToUserId = req.body.assignToUserId || req.body.assign_to_user_id;
  const user = requireUser(req, res);
  if (!user) return;

  if (!(await roleCan(user, 'tickets', 'edit'))) {
    return res.status(403).json({ error: 'Your role is not permitted to assign tickets.' });
  }

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    let targetName = null;
    let targetId = null;

    if (assignToUserId) {
      const targetUserRes = await db.query('SELECT id, name, username FROM users WHERE id = $1', [assignToUserId]);
      if (targetUserRes.rows.length === 0) {
        return res.status(400).json({ error: 'Target user not found.' });
      }
      targetName = targetUserRes.rows[0].name || targetUserRes.rows[0].username;
      targetId = targetUserRes.rows[0].id;
    } else {
      targetName = user.name || user.username;
      targetId = user.id;
    }

    // A reassignment is moving an already-assigned ticket to a different agent, as
    // opposed to a first assignment. The previous assignee should hear that it left them.
    const previousAssignee = ticket.assigned_to;
    const isReassignment = previousAssignee && previousAssignee !== targetId;

    await db.query(`
      UPDATE tickets
      SET assigned_to = $1, assigned_to_name = $2, status = 'In Progress', updated_at = NOW()
      WHERE id = $3
    `, [targetId, targetName, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Assigned', $3)
    `, [ticket.id, user.name || user.username, isReassignment ? `Reassigned ticket from ${ticket.assigned_to_name || 'previous agent'} to ${targetName}` : `Assigned ticket to ${targetName}`]);

    await db.query(`
      INSERT INTO system_logs (actor, action, detail)
      VALUES ($1, 'Ticket Assignment', $2)
    `, [user.name || user.username, `Assigned Ticket ${ticket.ticket_id} to ${targetName}`]);

    // Keyed on the assignee so a reassignment notifies afresh, but assigning the
    // same person twice does not.
    notifications.notify('ticket.assigned', `ticket-assigned:${ticket.id}:${targetId}`, {
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      department: ticket.department,
      priority: ticket.priority,
      slaDeadline: ticket.sla_deadline,
      assignedTo: targetId,
      assignedToName: targetName,
      createdBy: ticket.created_by
    });

    if (isReassignment) {
      // Keyed on the pair so each distinct hand-off notifies once.
      notifications.notify('ticket.reassigned', `ticket-reassigned:${ticket.id}:${previousAssignee}:${targetId}`, {
        ticketId: ticket.ticket_id,
        subject: ticket.subject,
        department: ticket.department,
        priority: ticket.priority,
        previousAssignee,
        previousAssigneeName: ticket.assigned_to_name,
        assignedTo: targetId,
        assignedToName: targetName,
        actorName: user.name || user.username
      });
    }

    res.json({ message: 'Ticket assigned successfully', assignedToName: targetName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Assignment failed' });
  }
});

app.patch('/api/tickets/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = requireUser(req, res);
  if (!user) return;

  const validStatuses = ['Open', 'In Progress', 'Waiting for Employee', 'Resolved', 'Closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketRes.rows[0];

    if (user.role === 'Employee' && ticket.created_by !== user.id) {
      return res.status(403).json({ error: 'Employees can only close their own tickets.' });
    }

    const prevStatus = ticket.status;
    const now = new Date();
    let resolvedAt = ticket.resolved_at;
    let closedAt = ticket.closed_at;

    if (status === 'Resolved') {
      resolvedAt = now;
    } else if (status === 'Closed') {
      closedAt = now;
    }

    const updated = await db.query(`
      UPDATE tickets
      SET status = $1, resolved_at = $2, closed_at = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING updated_at
    `, [status, resolvedAt, closedAt, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Status Changed', $3)
    `, [ticket.id, user.name || user.username, `Status changed from ${prevStatus} to ${status}`]);

    await db.query(`
      INSERT INTO system_logs (actor, action, detail)
      VALUES ($1, 'Ticket Status Update', $2)
    `, [user.name || user.username, `Updated Ticket ${ticket.ticket_id} status from ${prevStatus} to ${status}`]);

    // Resolved and Closed are distinct events with their own wording; moving *out* of
    // either back into an active state is a reopen. Everything else is a plain status
    // change. The event key includes the new status so each transition announces once,
    // and a genuine reopen after a previous reopen is keyed by its own timestamp.
    const isReopen = ['Resolved', 'Closed'].includes(prevStatus) && !['Resolved', 'Closed'].includes(status);
    const eventType =
      isReopen ? 'ticket.reopened' :
      status === 'Resolved' ? 'ticket.resolved' :
      status === 'Closed' ? 'ticket.closed' :
      'ticket.status_changed';

    // Keyed on the transition's own timestamp. Keying on the status alone would
    // suppress a legitimate re-resolve after a reopen, while a retried request lands
    // on the same updated_at and is still deduplicated.
    const eventKey = `ticket-status:${ticket.id}:${status}:${updated.rows[0].updated_at.toISOString()}`;

    notifications.notify(eventType, eventKey, {
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      department: ticket.department,
      priority: ticket.priority,
      status,
      previousStatus: prevStatus,
      actorName: user.name || user.username,
      createdBy: ticket.created_by,
      assignedTo: ticket.assigned_to,
      assignedToName: ticket.assigned_to_name
    });

    res.json({ message: 'Ticket status updated successfully', status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

app.patch('/api/tickets/:id/priority', async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to change ticket priority.' });

  const validPriorities = ['Critical', 'Medium', 'Low'];
  if (!validPriorities.includes(priority)) return res.status(400).json({ error: 'Invalid priority.' });

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = ticketRes.rows[0];

    const prevPriority = ticket.priority;
    await db.query('UPDATE tickets SET priority = $1, updated_at = NOW() WHERE id = $2', [priority, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Priority Changed', $3)
    `, [ticket.id, user.name || user.username, `Priority changed from ${prevPriority} to ${priority}`]);

    notifications.notify('ticket.priority_changed', `ticket-priority:${ticket.id}:${priority}:${Date.now()}`, {
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      department: ticket.department,
      priority,
      previousPriority: prevPriority,
      actorName: user.name || user.username,
      createdBy: ticket.created_by,
      assignedTo: ticket.assigned_to,
      assignedToName: ticket.assigned_to_name
    });

    res.json({ message: 'Priority updated successfully', priority });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

app.patch('/api/tickets/:id/category', async (req, res) => {
  const { id } = req.params;
  const { category } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to change ticket category.' });

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = ticketRes.rows[0];

    const prevCategory = ticket.category || 'Software';
    await db.query('UPDATE tickets SET category = $1, updated_at = NOW() WHERE id = $2', [category, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Category Changed', $3)
    `, [ticket.id, user.name || user.username, `Category changed from ${prevCategory} to ${category}`]);

    res.json({ message: 'Category updated successfully', category });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

app.patch('/api/tickets/:id/department', async (req, res) => {
  const { id } = req.params;
  const { department } = req.body;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'manage'))) return res.status(403).json({ error: 'Your role is not permitted to reassign ticket departments.' });

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = ticketRes.rows[0];

    const prevDept = ticket.department;
    await db.query('UPDATE tickets SET department = $1, updated_at = NOW() WHERE id = $2', [department, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Department Changed', $3)
    `, [ticket.id, user.name || user.username, `Department reassigned from ${prevDept} to ${department}`]);

    res.json({ message: 'Department updated successfully', department });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update department' });
  }
});


app.post('/api/tickets/:id/auto-assign', async (req, res) => {
  const { id } = req.params;
  const user = requireUser(req, res);
  if (!user) return;
  if (!(await roleCan(user, 'tickets', 'edit'))) return res.status(403).json({ error: 'Your role is not permitted to auto-assign tickets.' });

  try {
    const ticketRes = await db.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Ticket not found' });
    const ticket = ticketRes.rows[0];

    // Honour the governing policy's strategy if it has one (e.g. round robin); default
    // to least-loaded, which is what the "Auto-Assign (Workload)" button implies.
    let strategy = 'least_loaded';
    if (ticket.sla_policy_id) {
      const polRes = await db.query('SELECT auto_assign_strategy FROM sla_policies WHERE id = $1', [ticket.sla_policy_id]);
      if (polRes.rows.length && polRes.rows[0].auto_assign_strategy) strategy = polRes.rows[0].auto_assign_strategy;
    }

    const chosenAgent = await slaAssignment.pickAgent({ department: ticket.department }, strategy);
    if (!chosenAgent) {
      return res.status(400).json({ error: 'No eligible agents found for auto-assignment.' });
    }

    const targetName = chosenAgent.name || chosenAgent.username;
    const targetId = chosenAgent.id;

    await db.query(`
      UPDATE tickets
      SET assigned_to = $1, assigned_to_name = $2, status = 'In Progress', updated_at = NOW()
      WHERE id = $3
    `, [targetId, targetName, ticket.id]);

    await db.query(`
      INSERT INTO ticket_timeline (ticket_id, actor_name, action, detail)
      VALUES ($1, $2, 'Assigned', $3)
    `, [ticket.id, user.name || user.username, `Auto-assigned ticket to ${targetName} (${strategy.replace('_', ' ')}, ${chosenAgent.workload} active ticket(s))`]);

    notifications.notify('ticket.assigned', `ticket-assigned:${ticket.id}:${targetId}`, {
      ticketId: ticket.ticket_id,
      subject: ticket.subject,
      department: ticket.department,
      priority: ticket.priority,
      slaDeadline: ticket.sla_deadline,
      assignedTo: targetId,
      assignedToName: targetName,
      createdBy: ticket.created_by
    });

    res.json({ message: 'Ticket auto-assigned successfully', assignedToName: targetName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Auto-assignment failed' });
  }
});

app.get('/api/tickets-analytics', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  let scopeQuery = '';
  const params = [];

  if (user.role !== 'Super Admin') {
    scopeQuery = ' WHERE department = $1';
    params.push(user.department);
  }

  try {
    const statusCounts = await db.query(
      `SELECT status, COUNT(*) as count FROM tickets${scopeQuery} GROUP BY status`,
      params
    );

    const overdueRes = await db.query(
      `SELECT COUNT(*) as count FROM tickets
       WHERE sla_deadline < CURRENT_TIMESTAMP 
         AND status NOT IN ('Resolved', 'Closed')
         ${scopeQuery ? 'AND department = $1' : ''}`,
      params
    );

    const priorityCounts = await db.query(
      `SELECT priority, COUNT(*) as count FROM tickets${scopeQuery} GROUP BY priority`,
      params
    );

    const deptCounts = await db.query(
      `SELECT department, COUNT(*) as count FROM tickets${scopeQuery} GROUP BY department`,
      params
    );

    const avgResTimeRes = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours 
       FROM tickets 
       WHERE resolved_at IS NOT NULL 
         ${scopeQuery ? 'AND department = $1' : ''}`,
      params
    );

    const counts = {
      total: 0,
      open: 0,
      inProgress: 0,
      waiting: 0,
      resolved: 0,
      closed: 0,
      overdue: parseInt(overdueRes.rows[0].count) || 0,
      avgResolutionTimeHours: avgResTimeRes.rows[0].avg_hours ? parseFloat(parseFloat(avgResTimeRes.rows[0].avg_hours).toFixed(1)) : 0
    };

    statusCounts.rows.forEach(row => {
      const cnt = parseInt(row.count);
      counts.total += cnt;
      if (row.status === 'Open') counts.open = cnt;
      else if (row.status === 'In Progress') counts.inProgress = cnt;
      else if (row.status === 'Waiting for Employee') counts.waiting = cnt;
      else if (row.status === 'Resolved') counts.resolved = cnt;
      else if (row.status === 'Closed') counts.closed = cnt;
    });

    res.json({
      counts,
      byPriority: priorityCounts.rows.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {}),
      byDepartment: deptCounts.rows.reduce((acc, row) => {
        acc[row.department] = parseInt(row.count);
        return acc;
      }, {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// --- AUTHENTICATION API ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both username and password.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // `department` and `name` are signed in because the ticket queue routes on them.
    // Without department, non-admin agents matched `WHERE department = ''` and saw an
    // empty queue.
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.name, department: user.department },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      session: {
        id: user.id,
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email,
        employeeId: user.employee_id,
        phoneNumber: user.phone_number,
        department: user.department,
        designation: user.designation,
        status: user.status,
        passwordResetRequired: user.password_reset_required
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !newPassword) {
    return res.status(400).json({ error: 'Username and new password are required.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    if (currentPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1, password_reset_required = FALSE WHERE id = $2',
      [passwordHash, user.id]
    );

    res.json({ message: 'Password updated successfully.' });

    // Timestamped key: a second password change is a second event, not a duplicate.
    notifications.notify('security.password_changed', `password-changed:${user.id}:${Date.now()}`, {
      username: user.username,
      at: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// --- USER MANAGEMENT API ---
// Department options, derived from the directory rather than a hardcoded list, so the
// dropdowns reflect the departments that actually exist. Unioned with a small seed set
// so a brand-new database still offers sensible defaults.
app.get('/api/departments', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT TRIM(department) AS department FROM users
       WHERE department IS NOT NULL AND TRIM(department) <> ''
       ORDER BY 1`
    );
    const seeds = ['IT', 'HR', 'Finance', 'Operations', 'Administration'];
    const merged = [...new Set([...rows.map((r) => r.department), ...seeds])].sort();
    res.json(merged);
  } catch (err) {
    console.error('GET /api/departments failed:', err);
    res.status(500).json({ error: 'Could not load departments: ' + err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, role, email, employee_id, phone_number, department, designation, status, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, name, role, email, employeeId, phoneNumber, department, designation, status } = req.body;
  if (!username || !password || !name || !role || !email) {
    return res.status(400).json({ error: 'All fields are required (username, password, name, role, email).' });
  }

  // Validate phone number format
  let formattedPhone = '';
  if (phoneNumber) {
    const phoneValidation = validateAndFormatPhone(phoneNumber);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    formattedPhone = phoneValidation.value;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const createdUser = await createSingleUser(client, {
      username,
      password,
      name,
      role,
      email,
      employeeId,
      phoneNumber: formattedPhone,
      department,
      designation,
      status,
      resetRequired: false
    });
    await client.query('COMMIT');
    res.status(201).json(createdUser);

    notifications.notify('user.created', `user-created:${createdUser.id}`, {
      name: createdUser.name || createdUser.username,
      username: createdUser.username,
      role: createdUser.role,
      department: createdUser.department,
      actor: actorOf(req)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during manual user creation:', err);
    res.status(400).json({ error: err.message || 'Database insertion failed.' });
  } finally {
    client.release();
  }
});

// PATCH /api/users/:id - Edit User Details
app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, role, email, employeeId, phoneNumber, department, designation, status, password } = req.body;

  let formattedPhone = '';
  if (phoneNumber) {
    const phoneValidation = validateAndFormatPhone(phoneNumber);
    if (!phoneValidation.isValid) {
      return res.status(400).json({ error: phoneValidation.error });
    }
    formattedPhone = phoneValidation.value;
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user exists
    const userResult = await client.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Check duplicate email
    let finalUsername = user.username;
    if (email && email.toLowerCase() !== user.email?.toLowerCase()) {
      const emailExists = await client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2', [email, id]);
      if (emailExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Email address is already registered by another user.' });
      }

      const emailParts = email.split('@');
      finalUsername = emailParts[0];

      // Check duplicate username
      const usernameExists = await client.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2', [finalUsername, id]);
      if (usernameExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Username '${finalUsername}' already exists. Please use a unique Email address.` });
      }
    }

    // Check duplicate employee ID
    if (employeeId && (user.employee_id === null || employeeId.toLowerCase() !== user.employee_id.toLowerCase())) {
      const empIdExists = await client.query('SELECT 1 FROM users WHERE LOWER(employee_id) = LOWER($1) AND id <> $2', [employeeId, id]);
      if (empIdExists.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Employee ID '${employeeId}' already exists. Please use a unique Employee ID.` });
      }
    }

    let passwordHash = user.password_hash;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    }

    // Update auth.users if auth_id exists
    if (user.auth_id) {
      const authUpdateQuery = `
        UPDATE auth.users
        SET email = COALESCE($1, email),
            encrypted_password = COALESCE($2, encrypted_password),
            raw_user_meta_data = raw_user_meta_data || $3::jsonb,
            updated_at = NOW()
        WHERE id = $4
      `;
      const metadata = JSON.stringify({
        name: name || user.name,
        role: role || user.role,
        username: finalUsername || user.username
      });
      await client.query(authUpdateQuery, [email || null, password ? passwordHash : null, metadata, user.auth_id]);
    }

    const query = `
      UPDATE users 
      SET name = COALESCE($1, name),
          role = COALESCE($2, role),
          email = COALESCE($3, email),
          employee_id = COALESCE($4, employee_id),
          phone_number = COALESCE($5, phone_number),
          department = COALESCE($6, department),
          designation = COALESCE($7, designation),
          status = COALESCE($8, status),
          password_hash = $9,
          username = COALESCE($11, username)
      WHERE id = $10
      RETURNING id, username, name, role, email, employee_id, phone_number, department, designation, status, password_reset_required, created_at;
    `;
    const values = [
      name,
      role,
      email,
      employeeId,
      formattedPhone || phoneNumber || '',
      department,
      designation,
      status,
      passwordHash,
      id,
      finalUsername
    ];
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    const updated = result.rows[0];
    res.json(updated);

    // Roles grant permissions, so a change is worth telling the admins about. Keyed
    // on the destination role: setting the same role twice is not a second event.
    if (role && role !== user.role) {
      // Immediacy: the next request from this user resolves the new role rather than
      // the one baked into their JWT, so the change takes effect without a re-login.
      invalidateUserRole(updated.id);
      notifications.notify('user.role_changed', `user-role:${updated.id}:${role}`, {
        name: updated.name || updated.username,
        username: updated.username,
        previousRole: user.role,
        newRole: role,
        actor: actorOf(req)
      });
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database update failed: ' + (err.detail || err.message) });
  } finally {
    client.release();
  }
});

// DELETE /api/users/:id - Delete User
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT username, name, role, auth_id FROM users WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const { username, auth_id } = check.rows[0];
    const deletedUser = check.rows[0];
    
    // Find affected assets before deleting assignments
    const affectedAssets = await client.query('SELECT DISTINCT asset_id FROM asset_assignments WHERE user_id = $1', [id]);
    const affectedAssetIds = affectedAssets.rows.map(r => r.asset_id);

    await client.query('DELETE FROM asset_assignments WHERE user_id = $1', [id]);
    if (auth_id) {
      await client.query('DELETE FROM auth.users WHERE id = $1', [auth_id]);
    } else {
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    }

    // Recalculate quantities for each affected asset
    for (const assetId of affectedAssetIds) {
      const activeAssignmentsRes = await client.query(`
        SELECT employee_name, SUM(quantity) as qty
        FROM asset_assignments
        WHERE asset_id = $1 AND status = 'Assigned'
        GROUP BY employee_name
      `, [assetId]);
      
      const newAssignedQty = activeAssignmentsRes.rows.reduce((sum, row) => sum + parseInt(row.qty), 0);
      const summaryStr = activeAssignmentsRes.rows.map(row => `${row.employee_name} (${row.qty})`).join(', ') || '';
      
      const assetInfo = await client.query('SELECT total_quantity FROM assets WHERE id = $1', [assetId]);
      if (assetInfo.rows.length > 0) {
        const newAvailableQty = Math.max(0, assetInfo.rows[0].total_quantity - newAssignedQty);
        const newStatus = newAvailableQty > 0 ? 'Available' : 'Assigned';
        
        await client.query(`
          UPDATE assets
          SET 
            assigned_quantity = $1, 
            available_quantity = $2,
            status = $3,
            assigned_employee = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [newAssignedQty, newAvailableQty, newStatus, summaryStr || null, assetId]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: `User "${username}" deleted successfully` });

    notifications.notify('user.deleted', `user-deleted:${id}`, {
      name: deletedUser.name || deletedUser.username,
      username: deletedUser.username,
      role: deletedUser.role,
      actor: actorOf(req)
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Database deletion failed' });
  } finally {
    client.release();
  }
});

// POST /api/users/bulk/delete - Bulk Delete Users
app.post('/api/users/bulk/delete', async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Payload must contain a userIds array' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const check = await client.query('SELECT auth_id, id FROM users WHERE id = ANY($1::int[])', [userIds]);
    const authIds = check.rows.map(r => r.auth_id).filter(Boolean);
    const foundIds = check.rows.map(r => r.id);
    
    // Find affected assets before deleting assignments
    const affectedAssets = await client.query('SELECT DISTINCT asset_id FROM asset_assignments WHERE user_id = ANY($1::int[])', [foundIds]);
    const affectedAssetIds = affectedAssets.rows.map(r => r.asset_id);

    await client.query('DELETE FROM asset_assignments WHERE user_id = ANY($1::int[])', [foundIds]);
    if (authIds.length > 0) {
      await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [authIds]);
    }
    await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [foundIds]);
    
    // Recalculate quantities for each affected asset
    for (const assetId of affectedAssetIds) {
      const activeAssignmentsRes = await client.query(`
        SELECT employee_name, SUM(quantity) as qty
        FROM asset_assignments
        WHERE asset_id = $1 AND status = 'Assigned'
        GROUP BY employee_name
      `, [assetId]);
      
      const newAssignedQty = activeAssignmentsRes.rows.reduce((sum, row) => sum + parseInt(row.qty), 0);
      const summaryStr = activeAssignmentsRes.rows.map(row => `${row.employee_name} (${row.qty})`).join(', ') || '';
      
      const assetInfo = await client.query('SELECT total_quantity FROM assets WHERE id = $1', [assetId]);
      if (assetInfo.rows.length > 0) {
        const newAvailableQty = Math.max(0, assetInfo.rows[0].total_quantity - newAssignedQty);
        const newStatus = newAvailableQty > 0 ? 'Available' : 'Assigned';
        
        await client.query(`
          UPDATE assets
          SET 
            assigned_quantity = $1, 
            available_quantity = $2,
            status = $3,
            assigned_employee = $4,
            updated_at = NOW()
          WHERE id = $5
        `, [newAssignedQty, newAvailableQty, newStatus, summaryStr || null, assetId]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: `${userIds.length} users deleted successfully` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Bulk deletion failed' });
  } finally {
    client.release();
  }
});

// POST /api/users/bulk/status - Bulk Change Status (Activate/Deactivate)
app.post('/api/users/bulk/status', async (req, res) => {
  const { userIds, status } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0 || !status) {
    return res.status(400).json({ error: 'Payload must contain userIds array and status' });
  }
  try {
    await db.query('UPDATE users SET status = $1 WHERE id = ANY($2::int[])', [status, userIds]);
    res.json({ message: `Status updated to "${status}" for ${userIds.length} users` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk status update failed' });
  }
});

// POST /api/users/bulk/reset-password - Bulk Reset Password
app.post('/api/users/bulk/reset-password', async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.status(400).json({ error: 'Payload must contain a userIds array' });
  }
  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('Welcome@123', salt);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = ANY($2::int[])', [passwordHash, userIds]);
    res.json({ message: `Password reset to "Welcome@123" for ${userIds.length} users` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk password reset failed' });
  }
});

// POST /api/users/bulk/department - Bulk Change Department
app.post('/api/users/bulk/department', async (req, res) => {
  const { userIds, department } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0 || !department) {
    return res.status(400).json({ error: 'Payload must contain userIds array and department' });
  }
  try {
    await db.query('UPDATE users SET department = $1 WHERE id = ANY($2::int[])', [department, userIds]);
    res.json({ message: `Department updated to "${department}" for ${userIds.length} users` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk department update failed' });
  }
});

// POST /api/users/bulk/role - Bulk Change Role
app.post('/api/users/bulk/role', async (req, res) => {
  const { userIds, role } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0 || !role) {
    return res.status(400).json({ error: 'Payload must contain userIds array and role' });
  }
  try {
    await db.query('UPDATE users SET role = $1 WHERE id = ANY($2::int[])', [role, userIds]);
    res.json({ message: `Role updated to "${role}" for ${userIds.length} users` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Bulk role update failed' });
  }
});

// --- FILE UPLOAD API ---
// Uploads write into your storage bucket, so they require a signed-in user.
// `fileUrl` is kept as the response key for compatibility, but it now carries a
// durable storage *path* rather than a URL. Resolve it via /api/files/signed-url.
app.post('/api/upload', upload.single('file'), async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const filePath = await storage.saveFile(req.file.buffer, req.file.originalname, req.file.mimetype);
    res.json({
      name: req.file.originalname,
      fileName: filePath.split('/').pop(),
      fileSize: `${(req.file.size / 1024).toFixed(1)} KB`,
      fileUrl: filePath
    });
  } catch (err) {
    console.error('File upload failed:', err);
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// Mints a short-lived link to a stored file. Because the bucket is private, this
// is the only way to read one — and it requires authentication.
app.post('/api/files/signed-url', async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;

  const filePath = req.body?.path;
  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'A file path is required' });
  }

  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const url = await storage.getSignedUrl(filePath, baseUrl);
    res.json({ url, expiresIn: storage.SIGNED_URL_TTL_SECONDS });
  } catch (err) {
    console.error('Could not sign file URL:', err);
    res.status(404).json({ error: err.message || 'File is not available' });
  }
});

// --- SCHEDULED NOTIFICATION JOBS ---
//
// Expiry reminders change once a day, so a daily sweep is enough. SLA deadlines are
// measured in hours, so a daily job would report most breaches long after the fact —
// that check runs hourly. Failed email/SMS deliveries are retried on their own timer.
//
// node-cron only fires while this process is alive. On a host that sleeps an idle
// web service (Render's free tier, for one) the schedules simply stop, silently —
// no notifications, no SLA escalations, and nothing in the logs to say so. There
// the jobs are driven over HTTP instead, by Supabase pg_cron or GitHub Actions:
// set DISABLE_INTERNAL_CRON=true and CRON_SECRET, and see backend/sql/supabase_cron.sql.
const INTERNAL_CRON_ENABLED = process.env.DISABLE_INTERNAL_CRON !== 'true';
const CRON_SECRET = process.env.CRON_SECRET || '';

registerCronRoutes(app, { scheduler, notifications, reports, secret: CRON_SECRET });

if (INTERNAL_CRON_ENABLED) {
  const runStartupChecks = async () => {
    await scheduler.runDailyChecks();
    await scheduler.runSlaChecks();
  };

  runStartupChecks().catch((err) => console.error('Startup notification checks failed:', err));

  cron.schedule('0 0 * * *', () => scheduler.runDailyChecks());   // 00:00 daily
  cron.schedule('0 * * * *', () => scheduler.runSlaChecks());     // hourly, on the hour
  cron.schedule('*/15 * * * *', () => {                            // retry failed sends
    notifications.retryFailed().catch((err) => console.error('Notification retry failed:', err));
  });
  cron.schedule('0 6 * * *', () => {                               // 06:00 daily: email due reports
    reports.runDueScheduledReports().catch((err) => console.error('Scheduled reports failed:', err));
  });
} else if (!CRON_SECRET) {
  // Loud, because the alternative is a deployment where nothing is scheduled at all
  // and the first anyone hears of it is a missed SLA.
  console.error('[cron] DISABLE_INTERNAL_CRON=true but CRON_SECRET is unset: no job can run, in-process or over HTTP.');
} else {
  console.log('[cron] in-process scheduler disabled; expecting external triggers on /api/internal/cron/*');
}

// --- KNOWLEDGE BASE + HELPDESK OPTIONS ---
// Registered before the catch-all so its routes are reachable.
knowledgeBase.register(app, { requireUser });
purchaseOrders.register(app, { requirePermission, requireUser, roleCan });
slaRoutes.register(app, { requireUser, requirePermission });
dashboards.register(app, { requirePermission });
reports.register(app, { requireUser, requirePermission });

// --- 404 handler for unmatched API routes (JSON, not Express's default HTML page) ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// --- Global error handler (safety net; JSON, not HTML) ---
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
runMigrations().then(() => {
  app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
}).catch(err => {
  console.error('Server startup failed due to migration failure:', err);
});

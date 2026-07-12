const bcrypt = require('bcryptjs');
const db = require('../../db');
const notifications = require('../../notifications');
const validateAndFormatPhone = require('../utils/phone');

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

// --- USER MANAGEMENT API ---
// Departments, the user directory, user CRUD and the bulk operations. Extracted
// verbatim from server.js. createSingleUser() above is shared with manual creation.
function register(app, { requireUser, invalidateUserRole, actorOf }) {
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
}

module.exports = { register };

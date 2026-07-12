const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../../db');
const notifications = require('../../notifications');

// Authentication API — login and change-password. Extracted verbatim from server.js.
// `JWT_SECRET` is injected so token signing uses the same secret as verification.
function register(app, { JWT_SECRET }) {
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
}

module.exports = { register };

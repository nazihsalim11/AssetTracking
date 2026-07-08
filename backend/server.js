const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_assetflow_token';

// Configure multer storage for real uploads
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${basename}-${Date.now()}${ext}`);
  }
});

const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// --- ASSETS API ---
app.get('/api/assets', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM assets ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/assets', async (req, res) => {
  const {
    id, name, serialNumber, category, type, status, cost, purchaseDate,
    warrantyExpiry, department, location, amcId, invoiceId,
    assignedEmployee, depreciationLifeYears, notes
  } = req.body;

  const query = `
    INSERT INTO assets (
      id, name, serial_number, category, type, status, cost, purchase_date,
      warranty_expiry, department, location, amc_id, invoice_id,
      assigned_employee, depreciation_life_years, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    RETURNING *;
  `;
  const values = [
    id, name, serialNumber, category, type, status || 'Available', cost || 0, purchaseDate || null,
    warrantyExpiry || null, department || '', location || '', amcId || null, invoiceId || null,
    assignedEmployee || '', depreciationLifeYears || 5, notes || ''
  ];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + (err.detail || err.message) });
  }
});

app.patch('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  const fields = req.body;
  
  // Dynamically build the UPDATE query based on fields passed
  const allowedFields = {
    name: 'name',
    serialNumber: 'serial_number',
    category: 'category',
    type: 'type',
    status: 'status',
    cost: 'cost',
    purchaseDate: 'purchase_date',
    warrantyExpiry: 'warranty_expiry',
    department: 'department',
    location: 'location',
    amcId: 'amc_id',
    invoiceId: 'invoice_id',
    assignedEmployee: 'assigned_employee',
    depreciationLifeYears: 'depreciation_life_years',
    disposalDate: 'disposal_date',
    disposalReason: 'disposal_reason',
    notes: 'notes'
  };

  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, dbCol] of Object.entries(allowedFields)) {
    if (fields[key] !== undefined) {
      setClauses.push(`${dbCol} = $${idx}`);
      // Handle potential empty strings for foreign keys
      if ((key === 'amcId' || key === 'invoiceId') && fields[key] === '') {
        values.push(null);
      } else {
        values.push(fields[key]);
      }
      idx++;
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);
  const query = `UPDATE assets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`;

  try {
    const result = await db.query(query, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed: ' + err.message });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query('DELETE FROM assets WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Asset not found' });
    res.json({ message: 'Asset deleted successfully', asset: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database deletion failed' });
  }
});


// --- AMCS API ---
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
  const { id, vendor, cost, startDate, endDate, serviceSchedule, agreementFile, serviceHistory } = req.body;
  const query = `
    INSERT INTO amcs (id, vendor, cost, start_date, end_date, service_schedule, agreement_file, service_history)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [
    id, vendor, cost || 0, startDate, endDate, serviceSchedule || 'Quarterly', agreementFile || '',
    JSON.stringify(serviceHistory || [])
  ];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
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


// --- INVOICES API ---
app.get('/api/invoices', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM invoices ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/invoices', async (req, res) => {
  const { id, poReference, vendor, amount, gst, date, paymentStatus, fileName } = req.body;
  const query = `
    INSERT INTO invoices (id, po_reference, vendor, amount, gst, date, payment_status, file_name)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;
  const values = [id, poReference || '', vendor, amount || 0, gst || 0, date, paymentStatus || 'Pending', fileName || ''];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + err.message });
  }
});

app.patch('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;
  try {
    const result = await db.query(
      'UPDATE invoices SET payment_status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [paymentStatus, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed: ' + err.message });
  }
});


// --- MOVEMENTS API ---
app.get('/api/movements', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM movements ORDER BY date DESC, created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/movements', async (req, res) => {
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


// --- DOCUMENTS API ---
app.get('/api/documents', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM documents ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/documents', async (req, res) => {
  const { id, name, type, size, uploadDate, association, fileUrl } = req.body;
  const query = `
    INSERT INTO documents (id, name, type, file_size, upload_date, association, file_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [id, name, type, size || '', uploadDate, association || '', fileUrl || ''];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + err.message });
  }
});


// --- LOGS API ---
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
  const { timestamp, actor, action, detail } = req.body;
  const query = `
    INSERT INTO system_logs (timestamp, actor, action, detail)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [timestamp || new Date().toLocaleString(), actor, action, detail || ''];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + err.message });
  }
});


// --- NOTIFICATIONS API ---
app.get('/api/notifications', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notifications ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { id, text, type, time, read } = req.body;
  const query = `
    INSERT INTO notifications (id, text, type, time, read)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [id, text, type || 'info', time || 'Just now', read || false];

  try {
    const result = await db.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + err.message });
  }
});

app.patch('/api/notifications/:id', async (req, res) => {
  const { id } = req.params;
  const { read } = req.body;
  try {
    const result = await db.query(
      'UPDATE notifications SET read = $1 WHERE id = $2 RETURNING *',
      [read, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed: ' + err.message });
  }
});

app.patch('/api/notifications', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET read = TRUE');
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database update failed' });
  }
});


// --- EMAILS API ---
app.get('/api/emails', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM emails ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

// --- AUTHENTICATION API ---
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both username and password.' });
  }

  try {
    const result = await db.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      session: {
        username: user.username,
        role: user.role,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- USER MANAGEMENT API ---
app.get('/api/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, name, role, email, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database query failed' });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, password, name, role, email } = req.body;
  if (!username || !password || !name || !role || !email) {
    return res.status(400).json({ error: 'All fields are required (username, password, name, role, email).' });
  }

  try {
    const userExists = await db.query('SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const emailExists = await db.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailExists.rows.length > 0) {
      return res.status(400).json({ error: 'Email address is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (username, password_hash, name, role, email)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, name, role, email, created_at;
    `;
    const values = [username, passwordHash, name, role, email];
    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database insertion failed: ' + (err.detail || err.message) });
  }
});

// --- FILE UPLOAD API ---
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({
    name: req.file.originalname,
    fileName: req.file.filename,
    fileSize: `${(req.file.size / 1024).toFixed(1)} KB`,
    fileUrl
  });
});

// --- DAILY EXPIRATIONS CRON JOB ---
const runExpirationsCheck = async () => {
  console.log('Running daily expiration check for warranties and AMCs...');
  const today = new Date();
  
  try {
    // 1. Check Expiring Warranties (within 90 days)
    const assetsRes = await db.query("SELECT * FROM assets WHERE warranty_expiry IS NOT NULL AND status != 'Disposed'");
    for (const asset of assetsRes.rows) {
      const expiry = new Date(asset.warranty_expiry);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && diffDays <= 90) {
        const notifId = `NTF-WARR-${asset.id}`;
        const text = `Warranty expiring in ${diffDays} days for Asset ${asset.id} (${asset.name})`;
        
        const existsRes = await db.query('SELECT 1 FROM notifications WHERE id = $1', [notifId]);
        if (existsRes.rows.length === 0) {
          await db.query(
            'INSERT INTO notifications (id, text, type, time, read) VALUES ($1, $2, $3, $4, FALSE) ON CONFLICT DO NOTHING',
            [notifId, text, 'warning', 'Today']
          );
          
          const emailId = `EML-WARR-${Date.now()}`;
          const subject = `ALERT: Warranty Expiry Warning for Asset ${asset.id}`;
          const body = `Dear Team,\n\nThe warranty of Asset ${asset.id} (${asset.name}, Serial: ${asset.serial_number}) will expire in ${diffDays} days on ${asset.warranty_expiry}.\n\nRegards,\nAssetFlow Monitoring Bot`;
          await db.query(
            'INSERT INTO emails (id, sender, date, subject, body) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [emailId, 'Warranty Monitor', today.toLocaleString(), subject, body]
          );
        }
      }
    }

    // 2. Check Expiring AMCs (within 30 days)
    const amcsRes = await db.query("SELECT * FROM amcs");
    for (const amc of amcsRes.rows) {
      const expiry = new Date(amc.end_date);
      const diffTime = expiry - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0 && diffDays <= 30) {
        const notifId = `NTF-AMC-${amc.id}`;
        const text = `AMC Contract ${amc.id} with ${amc.vendor} expires in ${diffDays} days!`;
        
        const existsRes = await db.query('SELECT 1 FROM notifications WHERE id = $1', [notifId]);
        if (existsRes.rows.length === 0) {
          await db.query(
            'INSERT INTO notifications (id, text, type, time, read) VALUES ($1, $2, $3, $4, FALSE) ON CONFLICT DO NOTHING',
            [notifId, text, 'error', 'Today']
          );
          
          const emailId = `EML-AMC-${Date.now()}`;
          const subject = `ALERT: AMC Contract ${amc.id} Expiring Soon`;
          const body = `Attention Team,\n\nAMC Contract ${amc.id} with vendor ${amc.vendor} is expiring in ${diffDays} days on ${amc.end_date}.\n\nRegards,\nAssetFlow Contract Engine`;
          await db.query(
            'INSERT INTO emails (id, sender, date, subject, body) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [emailId, 'AMC Alerts Engine', today.toLocaleString(), subject, body]
          );
        }
      }
    }
  } catch (err) {
    console.error('Error running expiration checks:', err);
  }
};

// Run expiration check once on startup
runExpirationsCheck();

// Schedule daily check (every day at midnight)
cron.schedule('0 0 * * *', runExpirationsCheck);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));

const { Pool } = require('pg');
require('dotenv').config();

// Transaction pooler (for standard queries)
const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/asset_tracking';
const pool = new Pool({ connectionString: dbUrl });

// Direct session pooler (used for schema migrations and seeding)
const directUrl = process.env.DIRECT_URL || dbUrl;
const directPool = new Pool({ connectionString: directUrl });

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  directQuery: (text, params) => directPool.query(text, params),
  directPool,
};

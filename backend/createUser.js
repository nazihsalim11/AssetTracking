const db = require('./db');
const bcrypt = require('bcryptjs');

const args = process.argv.slice(2);
if (args.length < 5) {
  console.log('Usage: node createUser.js <username> <password> <name> <role> <email>');
  console.log('Roles: "Super Admin", "IT Admin", "Facility Admin", "Finance Team", "Employee", "Auditor"');
  console.log('Example: node createUser.js nazih nazih123 "Nazih Salim" "Super Admin" nazih@company.com');
  process.exit(1);
}

const [username, password, name, role, email] = args;

const createNewUser = async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO users (username, password_hash, name, role, email) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role';
    const result = await db.query(query, [username, hash, name, role, email]);
    console.log(`User created successfully! ID: ${result.rows[0].id}, Username: ${result.rows[0].username}, Role: ${result.rows[0].role}`);
  } catch (err) {
    console.error('Failed to create user:', err.message);
  } finally {
    db.pool.end();
  }
};

createNewUser();

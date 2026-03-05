import bcrypt from 'bcrypt';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'hokhub',
  password: 'password',
  port: 5432
});

const hash = await bcrypt.hash('hokhub2026', 10);
console.log('Generated hash:', hash);

const result = await pool.query('UPDATE contributors SET password_hash = $1', [hash]);
console.log('Updated:', result.rowCount, 'rows');

// Verify
const check = await pool.query('SELECT id, email, password_hash FROM contributors');
console.log('Verified:');
check.rows.forEach(r => console.log(r.id, r.email, r.password_hash.substring(0, 20) + '...'));

await pool.end();

import 'dotenv/config';
import fs from 'fs';
import mysql from 'mysql2/promise';

const sslOptions = (() => {
  const caPath = '/etc/ssl/cert.pem';
  try {
    if (fs.existsSync(caPath)) {
      return { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2' };
    }
  } catch { /* fallback */ }
  return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
})();

async function run() {
  console.log('[SETUP] Connecting to TiDB Cloud...');

  // First connect without database to create it
  const rootConn = await mysql.createConnection({
    host: process.env.TIDB_HOST,
    port: Number(process.env.TIDB_PORT || 4000),
    user: process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    ssl: sslOptions,
    multipleStatements: true,
  });

  console.log('[SETUP] Connected! Creating database...');
  await rootConn.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.TIDB_DATABASE}\``);
  console.log(`[SETUP] Database '${process.env.TIDB_DATABASE}' ready.`);
  await rootConn.execute(`USE \`${process.env.TIDB_DATABASE}\``);

  // Read and execute schema
  const schemaPath = new URL('../../tidb/schema.sql', import.meta.url);
  let schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Remove CREATE DATABASE and USE lines (we already did that)
  schemaSql = schemaSql
    .replace(/CREATE DATABASE.*?;/gi, '')
    .replace(/USE\s+\w+;/gi, '');

  // Split by semicolons and execute each statement
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await rootConn.execute(stmt);
      // Show first 60 chars of each statement
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 60);
      console.log(`[SETUP] ✓ ${preview}...`);
    } catch (err) {
      // Skip "already exists" errors
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.errno === 1050) {
        console.log(`[SETUP] ⏭ Table already exists, skipping.`);
      } else {
        console.error(`[SETUP] ✗ Error:`, err.message);
        console.error(`[SETUP]   Statement: ${stmt.slice(0, 100)}...`);
      }
    }
  }

  await rootConn.end();
  console.log('[SETUP] Schema setup complete!');
}

run().catch((error) => {
  console.error('[SETUP] Fatal error:', error.message);
  process.exit(1);
});

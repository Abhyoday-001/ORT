import 'dotenv/config';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { CREDENTIALS } from '../secure/gameSecrets.mjs';

const requiredEnv = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD', 'TIDB_DATABASE'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[SEED] Missing env: ${key}`);
    process.exit(1);
  }
}

const sslOptions = (() => {
  const caPath = '/etc/ssl/cert.pem';
  try {
    if (fs.existsSync(caPath)) {
      return { ca: fs.readFileSync(caPath), minVersion: 'TLSv1.2' };
    }
  } catch { /* fallback */ }
  return { minVersion: 'TLSv1.2', rejectUnauthorized: true };
})();

const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: Number(process.env.TIDB_PORT || 4000),
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: sslOptions,
  waitForConnections: true,
  connectionLimit: 5,
  timezone: '+00:00',
});

async function run() {
  console.log('[SEED] Seeding teams and credentials into TiDB...');

  for (const cred of CREDENTIALS) {
    const password_hash = await bcrypt.hash(cred.password, 10);
    const id = crypto.randomUUID();

    // Upsert team — insert or update password_hash if team_id already exists
    await pool.execute(
      `INSERT INTO teams (id, team_id, password_hash, enabled, is_admin)
       VALUES (?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), enabled = 1, is_admin = VALUES(is_admin)`,
      [id, cred.team_id, password_hash, cred.is_admin ? 1 : 0]
    );

    // Get the actual id (might differ if ON DUPLICATE KEY hit)
    const [rows] = await pool.execute(
      'SELECT id FROM teams WHERE team_id = ? LIMIT 1',
      [cred.team_id]
    );

    const teamId = rows[0]?.id;
    if (!teamId) {
      console.error(`[SEED] Could not find team after upsert: ${cred.team_id}`);
      process.exit(1);
    }

    // Upsert game_state
    await pool.execute(
      `INSERT INTO game_state (team_id, round3_lat_progress, round3_lon_progress)
       VALUES (?, '', '')
       ON DUPLICATE KEY UPDATE team_id = team_id`,
      [teamId]
    );

    console.log(`[SEED] OK ${cred.team_id}`);
  }

  console.log('[SEED] Complete.');
  await pool.end();
}

run().catch((error) => {
  console.error('[SEED] Fatal error', error);
  process.exit(1);
});

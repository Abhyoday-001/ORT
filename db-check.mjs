import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.TIDB_HOST,
  port: process.env.TIDB_PORT,
  user: process.env.TIDB_USER,
  password: process.env.TIDB_PASSWORD,
  database: process.env.TIDB_DATABASE,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
});

async function run() {
  const [rows] = await pool.query('SELECT * FROM active_effects ORDER BY created_at DESC LIMIT 5;');
  console.log('Recent active_effects:', rows);
  
  const [dbTime] = await pool.query('SELECT UTC_TIMESTAMP() as now_utc, NOW() as now_local;');
  console.log('DB Time:', dbTime);
  process.exit(0);
}
run();

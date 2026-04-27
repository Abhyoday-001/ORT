import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import http from 'http';
import { WebSocketServer } from 'ws';
import { ROUND_SECRETS } from './secure/gameSecrets.mjs';
import { AUCTION_CARDS } from './secure/auctionCards.mjs';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const port = Number(process.env.PORT || 3008);
let leaderboardVisible = false;

// ── Global Freeze State ─────────────────────────────────────────────
let globalFreezeState = {
  frozenTeams: [],      // List of team IDs
  freezeAllExcept: null, // Team ID to exclude
  expiryTimes: {}       // teamId -> JS timestamp
};
const freezeTimers = new Map();

function broadcastFreezeUpdate() {
  const payload = JSON.stringify({ type: 'freeze_update', state: globalFreezeState });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  // Send current state on connect
  ws.send(JSON.stringify({ type: 'freeze_update', state: globalFreezeState }));
});

function broadcastCooldownUpdate(teamId, seconds) {
  const payload = JSON.stringify({ type: 'cooldown_update', teamId, seconds });
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

// ── Cooldown System ────────────────────────────────────────────────
const wrongAnswerCooldowns = new Map();

function getCooldownLeft(teamId) {
  const expiry = wrongAnswerCooldowns.get(teamId);
  if (!expiry) return 0;
  const left = Math.ceil((expiry - Date.now()) / 1000);
  if (left <= 0) {
    wrongAnswerCooldowns.delete(teamId);
    return 0;
  }
  return left;
}

async function getTeamCooldownLeft(teamId) {
  try {
    const memLeft = getCooldownLeft(teamId);
    if (memLeft > 0) return memLeft;
    const [rows] = await pool.execute('SELECT cooldown_until FROM teams WHERE id = ? LIMIT 1', [teamId]);
    const row = rows?.[0];
    if (!row || !row.cooldown_until) return 0;
    const expiry = new Date(row.cooldown_until).getTime();
    const left = Math.ceil((expiry - Date.now()) / 1000);
    return left > 0 ? left : 0;
  } catch (err) { return 0; }
}

function setCooldown(teamId, seconds) {
  wrongAnswerCooldowns.set(teamId, Date.now() + seconds * 1000);
}

async function setTeamCooldown(teamId, seconds) {
  try {
    const [effects] = await pool.execute("SELECT id FROM active_effects WHERE team_id = ? AND effect_type = 'no_cooldown' AND (expiry_time IS NULL OR expiry_time > UTC_TIMESTAMP()) LIMIT 1", [teamId]);
    if (effects?.length > 0) return;
    const [incEffects] = await pool.execute("SELECT effect_value FROM active_effects WHERE team_id = ? AND effect_type = 'cooldown_increase' AND (expiry_time IS NULL OR expiry_time > UTC_TIMESTAMP()) LIMIT 1", [teamId]);
    let finalSeconds = seconds + (incEffects?.length > 0 ? 60 : 0);
    setCooldown(teamId, finalSeconds);
    const expiry = new Date(Date.now() + finalSeconds * 1000);
    await pool.execute('UPDATE teams SET cooldown_until = ? WHERE id = ?', [toMySQLTimestamp(expiry), teamId]);
    broadcastCooldownUpdate(teamId, finalSeconds);
  } catch (err) { console.error('[SET_COOLDOWN_ERROR]', err); }
}

const requiredEnv = ['TIDB_HOST', 'TIDB_USER', 'TIDB_PASSWORD', 'TIDB_DATABASE', 'APP_JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`[BOOT] Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── TiDB connection pool ────────────────────────────────────────────
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
  connectionLimit: 30,
  timezone: '+00:00',
});

// Quick connectivity check and setup on boot
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('[BOOT] TiDB connection OK');
    
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS active_effects (
        id VARCHAR(36) PRIMARY KEY,
        team_id VARCHAR(36) NOT NULL,
        source_team_id VARCHAR(36) NULL,
        effect_type VARCHAR(50) NOT NULL,
        effect_value DOUBLE PRECISION DEFAULT 1.0,
        source_card_id VARCHAR(255) NULL,
        metadata JSON,
        expiry_time DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[BOOT] active_effects table verified');

    // Add columns to teams if missing
    try {
      await conn.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS active_effects JSON AFTER coins');
      console.log('[BOOT] teams.active_effects column verified');
    } catch (err) { /* ignore */ }

    try {
      await conn.execute('ALTER TABLE teams ADD COLUMN IF NOT EXISTS cooldown_until DATETIME NULL AFTER active_effects');
      console.log('[BOOT] teams.cooldown_until column verified');
    } catch (err) {
      try {
        await conn.execute('ALTER TABLE teams ADD COLUMN cooldown_until DATETIME NULL');
      } catch (e) { /* ignore */ }
    }

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS auction_events (
        id VARCHAR(36) PRIMARY KEY,
        event_type VARCHAR(50) NOT NULL,
        message TEXT,
        payload JSON,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[BOOT] auction_events table verified');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS won_cards (
        id VARCHAR(36) PRIMARY KEY,
        team_id VARCHAR(36) NOT NULL,
        card_id VARCHAR(255) NOT NULL,
        card_name VARCHAR(255) NOT NULL,
        card_data JSON,
        won_at DATETIME NOT NULL
      )
    `);
    console.log('[BOOT] won_cards table verified');

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS team_presence (
        team_id VARCHAR(36) PRIMARY KEY,
        online TINYINT(1) NOT NULL DEFAULT 0,
        last_seen_at DATETIME NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('[BOOT] team_presence table verified');
    
    conn.release();
  } catch (err) {
    console.error('[BOOT] TiDB connection FAILED', err.message);
  }
})();

// ── Helpers ─────────────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '1mb' }));

function signSession(team) {
  return jwt.sign(
    {
      sub: team.id,
      team_id: team.team_id,
      is_admin: Boolean(team.is_admin),
    },
    process.env.APP_JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function setPresence(teamId, online) {
  try {
    await pool.execute(
      `INSERT INTO team_presence (team_id, online, last_seen_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE online = VALUES(online), last_seen_at = NOW()`,
      [teamId, online ? 1 : 0]
    );
  } catch (err) {
    console.error('[PRESENCE]', err?.message || err);
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    req.auth = jwt.verify(token, process.env.APP_JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminRequired(req, res, next) {
  if (!req.auth?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
}

// ── DB helper functions ─────────────────────────────────────────────

async function getTeamById(teamId) {
  const [rows] = await pool.execute(
    'SELECT * FROM teams WHERE id = ? LIMIT 1',
    [teamId]
  );
  return rows[0] || null;
}

async function getTeamByCode(teamCode) {
  const [rows] = await pool.execute(
    'SELECT * FROM teams WHERE team_id = ? LIMIT 1',
    [teamCode]
  );
  return rows[0] || null;
}

async function ensureGameState(teamUuid) {
  const [rows] = await pool.execute(
    'SELECT * FROM game_state WHERE team_id = ? LIMIT 1',
    [teamUuid]
  );
  if (rows[0]) return rows[0];

  await pool.execute(
    `INSERT INTO game_state (team_id, round3_lat_progress, round3_lon_progress) VALUES (?, '', '')`,
    [teamUuid]
  );

  const [newRows] = await pool.execute(
    'SELECT * FROM game_state WHERE team_id = ? LIMIT 1',
    [teamUuid]
  );
  return newRows[0];
}

async function ensureGameRuntime() {
  const [rows] = await pool.execute(
    'SELECT * FROM game_runtime WHERE id = 1 LIMIT 1'
  );
  if (rows[0]) {
    // Parse JSON columns
    const row = rows[0];
    if (typeof row.round_timers === 'string') row.round_timers = JSON.parse(row.round_timers);
    if (typeof row.round_timer_ends_at === 'string') row.round_timer_ends_at = JSON.parse(row.round_timer_ends_at);
    return row;
  }

  const now = new Date();
  const defaultTimers = { INTRO: 180, ROUND_1: 900, ROUND_2: 900, ROUND_3: 1200, FINAL: 1800 };
  const defaultEnds = { INTRO: null, ROUND_1: null, ROUND_2: null, ROUND_3: null, FINAL: null };

  await pool.execute(
    `INSERT INTO game_runtime (id, status, active_round, started_at, global_countdown_ends_at, round_timers, round_timer_ends_at)
     VALUES (1, 'LIVE', 'INTRO', ?, ?, ?, ?)`,
    [
      now.toISOString().slice(0, 19).replace('T', ' '),
      new Date(now.getTime() + 90 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '),
      JSON.stringify(defaultTimers),
      JSON.stringify(defaultEnds),
    ]
  );

  const [newRows] = await pool.execute('SELECT * FROM game_runtime WHERE id = 1 LIMIT 1');
  const row = newRows[0];
  if (typeof row.round_timers === 'string') row.round_timers = JSON.parse(row.round_timers);
  if (typeof row.round_timer_ends_at === 'string') row.round_timer_ends_at = JSON.parse(row.round_timer_ends_at);
  return row;
}

function toMySQLTimestamp(isoOrDate) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function updateGameRuntime(patch) {
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(patch)) {
    fields.push(`${key} = ?`);
    if (key === 'round_timers' || key === 'round_timer_ends_at') {
      values.push(JSON.stringify(val));
    } else if (key.endsWith('_at')) {
      values.push(toMySQLTimestamp(val));
    } else {
      values.push(val);
    }
  }

  if (fields.length === 0) return ensureGameRuntime();

  await pool.execute(
    `UPDATE game_runtime SET ${fields.join(', ')} WHERE id = 1`,
    values
  );

  return ensureGameRuntime();
}

async function calculateRoundTimerEndsAt(roundKey, roundTimers) {
  const seconds = Number(roundTimers?.[roundKey] || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function awardPointsAndRound(teamUuid, pointsToAdd, currentRound) {
  const team = await getTeamById(teamUuid);
  if (!team) throw new Error('Team not found for progress update');

  // Points are not used for scoring; keep them unchanged.
  // We still advance the team's current_round for progression.
  const nextPoints = Number(team.points || 0);
  const nextRound = Math.max(Number(team.current_round || 0), currentRound);

  await pool.execute(
    'UPDATE teams SET points = ?, current_round = ? WHERE id = ?',
    [nextPoints, nextRound, teamUuid]
  );
}

function randomCard() {
  return AUCTION_CARDS[Math.floor(Math.random() * AUCTION_CARDS.length)];
}

function expiryFromSeconds(seconds) {
  if (!seconds || Number(seconds) <= 0) return null;
  return new Date(Date.now() + Number(seconds) * 1000).toISOString();
}

async function logAuctionEvent(eventType, message, payload = {}) {
  await pool.execute(
    'INSERT INTO auction_events (id, event_type, message, payload) VALUES (?, ?, ?, ?)',
    [uuid(), eventType, message, JSON.stringify(payload)]
  );
}

async function ensureAuctionRuntime() {
  const [rows] = await pool.execute(
    'SELECT * FROM auction_runtime WHERE id = 1 LIMIT 1'
  );
  if (rows[0]) {
    const row = rows[0];
    if (typeof row.drawn_card === 'string') {
      try { row.drawn_card = JSON.parse(row.drawn_card); } catch { /* keep as-is */ }
    }
    return row;
  }

  await pool.execute(
    `INSERT INTO auction_runtime (id, active, phase) VALUES (1, 0, 'idle')`
  );

  const [newRows] = await pool.execute('SELECT * FROM auction_runtime WHERE id = 1 LIMIT 1');
  return newRows[0];
}

async function updateAuctionRuntime(patch) {
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(patch)) {
    fields.push(`${key} = ?`);
    if (key === 'drawn_card') {
      values.push(val ? JSON.stringify(val) : null);
    } else if (key === 'active') {
      values.push(val ? 1 : 0);
    } else if (key.endsWith('_at') || key.endsWith('_deadline')) {
      values.push(toMySQLTimestamp(val));
    } else {
      values.push(val ?? null);
    }
  }

  if (fields.length === 0) return ensureAuctionRuntime();

  await pool.execute(
    `UPDATE auction_runtime SET ${fields.join(', ')} WHERE id = 1`,
    values
  );

  return ensureAuctionRuntime();
}

async function insertActiveEffect(teamId, sourceTeamId, card, metadata = {}) {
  await pool.execute(
    `INSERT INTO active_effects (id, team_id, source_team_id, effect_type, effect_value, source_card_id, metadata, expiry_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(),
      teamId,
      sourceTeamId || null,
      card.effect_type,
      card.value ?? null,
      card.id,
      JSON.stringify(metadata),
      toMySQLTimestamp(expiryFromSeconds(card.duration)),
    ]
  );
}

async function syncTeamEffectsCache(teamId) {
  const nowMysql = toMySQLTimestamp(new Date());
  const [effects] = await pool.execute(
    `SELECT effect_type, effect_value, source_card_id, expiry_time, metadata
     FROM active_effects
     WHERE team_id = ? AND (expiry_time IS NULL OR expiry_time > ?)
     ORDER BY created_at DESC`,
    [teamId, nowMysql]
  );

  // Parse metadata JSON
  const parsed = (effects || []).map((e) => {
    if (typeof e.metadata === 'string') {
      try { e.metadata = JSON.parse(e.metadata); } catch { /* keep */ }
    }
    return e;
  });

  await pool.execute(
    'UPDATE teams SET active_effects = ? WHERE id = ?',
    [JSON.stringify(parsed), teamId]
  );
}

async function isProtected(teamId) {
  const nowMysql = toMySQLTimestamp(new Date());
  const [rows] = await pool.execute(
    `SELECT id FROM active_effects
     WHERE team_id = ? AND effect_type = 'protection'
     AND (expiry_time IS NULL OR expiry_time > ?)
     LIMIT 1`,
    [teamId, nowMysql]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function isFrozen(teamId) {
  try {
    const [rows] = await pool.execute(
      `SELECT id FROM active_effects
       WHERE team_id = ? AND effect_type IN ('freeze', 'freeze_target')
       AND (expiry_time IS NULL OR expiry_time > UTC_TIMESTAMP())
       LIMIT 1`,
      [teamId]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.error('[IS_FROZEN_CHECK_ERROR]', error);
    return false;
  }
}

app.get('/api/debug/freeze', async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM active_effects');
  const [dbTime] = await pool.execute('SELECT UTC_TIMESTAMP() as utc, NOW() as local');
  res.json({ effects: rows, time: dbTime });
});

async function updateTeamPoints(teamId, delta) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error('Team not found');

  const nextPoints = Math.max(0, Number(team.points || 0) + Number(delta || 0));
  await pool.execute(
    'UPDATE teams SET points = ? WHERE id = ?',
    [nextPoints, teamId]
  );
  return nextPoints;
}

async function updateTeamCoins(teamId, delta) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error('Team not found');

  const nextCoins = Math.max(0, Number(team.coins || 0) + Number(delta || 0));
  await pool.execute(
    'UPDATE teams SET coins = ? WHERE id = ?',
    [nextCoins, teamId]
  );
  return nextCoins;
}

async function applyCardEffect({ winnerTeamId, card, targetTeamId = null }) {
  if (!card) throw new Error('Card is required');

  const applyToAllOthers = async (delta) => {
    const [teams] = await pool.execute(
      'SELECT id, is_admin FROM teams WHERE enabled = 1'
    );

    for (const team of teams || []) {
      if (team.is_admin || team.id === winnerTeamId) continue;
      await updateTeamPoints(team.id, delta);
    }
  };

  switch (card.effect_type) {
    case 'add_points':
      await updateTeamPoints(winnerTeamId, Number(card.value || 0));
      break;
    case 'deduct_points':
    case 'lose_last_earned':
      await updateTeamPoints(winnerTeamId, -Math.abs(Number(card.value || 0)));
      break;
    case 'steal_points': {
      if (!targetTeamId) throw new Error('Target required for steal_points');
      const protectedTarget = await isProtected(targetTeamId);
      if (protectedTarget) {
        return { blocked: true, reason: 'Target is protected' };
      }
      const target = await getTeamById(targetTeamId);
      const stealAmount = Math.min(Number(target?.points || 0), Math.abs(Number(card.value || 0)));
      await updateTeamPoints(targetTeamId, -stealAmount);
      await updateTeamPoints(winnerTeamId, stealAmount);
      break;
    }
    case 'deduct_target_points': {
      if (!targetTeamId) throw new Error('Target required for deduct_target_points');
      const protectedTarget = await isProtected(targetTeamId);
      if (protectedTarget) {
        return { blocked: true, reason: 'Target is protected' };
      }
      await updateTeamPoints(targetTeamId, -Math.abs(Number(card.value || 0)));
      break;
    }
    case 'swap_with_target': {
      if (!targetTeamId) throw new Error('Target required for swap_with_target');
      const protectedTarget = await isProtected(targetTeamId);
      if (protectedTarget) {
        return { blocked: true, reason: 'Target is protected' };
      }
      const winner = await getTeamById(winnerTeamId);
      const target = await getTeamById(targetTeamId);
      await pool.execute('UPDATE teams SET points = ? WHERE id = ?', [target.points, winnerTeamId]);
      await pool.execute('UPDATE teams SET points = ? WHERE id = ?', [winner.points, targetTeamId]);
      break;
    }
    case 'aoe_deduct_others':
      await applyToAllOthers(-Math.abs(Number(card.value || 0)));
      break;
    case 'random_points': {
      const sign = Math.random() < 0.5 ? -1 : 1;
      await updateTeamPoints(winnerTeamId, sign * Math.abs(Number(card.value || 0)));
      break;
    }
    case 'coinflip_points': {
      const sign = Math.random() < 0.5 ? -1 : 1;
      await updateTeamPoints(winnerTeamId, sign * Math.abs(Number(card.value || 0)));
      break;
    }
    case 'swap_random': {
      const [teams] = await pool.execute(
        'SELECT id, points, is_admin, enabled FROM teams WHERE enabled = 1 AND is_admin = 0'
      );
      const candidates = (teams || []).filter((t) => t.id !== winnerTeamId);
      if (candidates.length > 0) {
        const randomTarget = candidates[Math.floor(Math.random() * candidates.length)];
        const winner = await getTeamById(winnerTeamId);
        await pool.execute('UPDATE teams SET points = ? WHERE id = ?', [randomTarget.points, winnerTeamId]);
        await pool.execute('UPDATE teams SET points = ? WHERE id = ?', [winner.points, randomTarget.id]);
      }
      break;
    }
    case 'no_cooldown':
      // Handled by persistence
      break;
    case 'cooldown_increase':
      if (!targetTeamId) throw new Error('Target required for cooldown_increase');
      // Handled by persistence
      break;
    case 'freeze':
      // Handled by persistence
      break;
    case 'freeze_target':
      if (!targetTeamId) throw new Error('Target required for freeze_target');
      // Handled by persistence
      break;
    default:
      break;
  }

  const effectTypesToPersist = new Set([
    'protection',
    'freeze',
    'freeze_target',
    'no_cooldown',
    'cooldown_increase',
    'time_bonus',
    'time_penalty',
    'hint',
    'skip',
    'next_round_reward_bonus',
    'round_multiplier',
    'auto_complete_task',
    'clear_penalties',
    'repeat_last_puzzle',
    'delay_actions',
    'rollback_progress',
    'hide_hints',
    'disable_inputs',
    'cancel_last_effect',
    'double_edge',
    'fake_alert',
  ]);

  if (effectTypesToPersist.has(card.effect_type)) {
    const persistedTarget = card.target_type === 'other' ? targetTeamId : winnerTeamId;
    await insertActiveEffect(persistedTarget, winnerTeamId, card, { target_team_id: targetTeamId || null });
    await syncTeamEffectsCache(persistedTarget);
  }

  return { blocked: false };
}

async function recentlyTargetedByWinner(winnerTeamId, targetTeamId, secondsWindow = 120) {
  const cutoffMysql = toMySQLTimestamp(new Date(Date.now() - secondsWindow * 1000));
  const [rows] = await pool.execute(
    `SELECT payload, created_at FROM auction_events
     WHERE event_type = 'target_applied' AND created_at >= ?
     ORDER BY created_at DESC LIMIT 50`,
    [cutoffMysql]
  );

  return (rows || []).some((event) => {
    let payload = event.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return false; }
    }
    return payload?.winner_team_id === winnerTeamId && payload?.target_team_id === targetTeamId;
  });
}

async function getEligibleAuctionTargets(excludeTeamId, includeRecent = true) {
  const [rows] = await pool.execute(
    `SELECT id, team_id, points, enabled, is_admin FROM teams
     WHERE enabled = 1 AND is_admin = 0 AND id != ?
     ORDER BY points DESC`,
    [excludeTeamId]
  );

  if (includeRecent) return rows || [];

  const filtered = [];
  for (const team of rows || []) {
    const blocked = await recentlyTargetedByWinner(excludeTeamId, team.id, 120);
    if (!blocked) filtered.push(team);
  }
  return filtered;
}

async function finaliseAuctionRuntime({ runtime, card, winnerTeam, targetTeam = null, eventType, message, payload = {} }) {
  const updatedRuntime = await updateAuctionRuntime({
    // NOTE: Auction is only closed via the admin "close" button.
    // Timeouts or target selection should not deactivate the auction window.
    active: true,
    phase: 'resolved',
    winner_team_id: winnerTeam?.id || runtime?.winner_team_id || null,
    winning_bid: runtime?.winning_bid ?? null,
    drawn_card: card || runtime?.drawn_card || null,
    target_team_id: targetTeam?.id || runtime?.target_team_id || null,
    target_selection_deadline: null,
  });

  await logAuctionEvent(eventType, message, payload);
  return updatedRuntime;
}

async function autoFinalizeExpiredTargetAuction(runtime) {
  if (!runtime || runtime.phase !== 'targeting' || !runtime.target_selection_deadline) return null;
  const deadline = Date.parse(runtime.target_selection_deadline);
  if (!Number.isFinite(deadline) || Date.now() < deadline) return null;

  const winner = await getTeamById(runtime.winner_team_id);
  const card = runtime.drawn_card;
  const targets = await getEligibleAuctionTargets(runtime.winner_team_id, true);
  const fallbackTarget = targets[0] || null;

  if (fallbackTarget && card) {
    await applyCardEffect({ winnerTeamId: runtime.winner_team_id, card, targetTeamId: fallbackTarget.id });
  }

  return finaliseAuctionRuntime({
    runtime,
    card,
    winnerTeam: winner,
    targetTeam: fallbackTarget,
    eventType: 'auction_timeout',
    message: fallbackTarget
      ? `Target timeout elapsed. Auto-applied ${card?.name || 'card'} to ${fallbackTarget.team_id}`
      : 'Target timeout elapsed. No valid target could be selected.',
    payload: {
      winner_team_id: runtime.winner_team_id,
      target_team_id: fallbackTarget?.id || null,
      card,
      autoResolved: true,
    },
  });
}

// ── Routes ──────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'operation-red-trophy-api', db: 'tidb' });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const teamId = String(req.body?.team_id || '').trim().toUpperCase();
    const password = String(req.body?.password || '');

    if (!teamId || !password) {
      return res.status(400).json({ error: 'team_id and password are required' });
    }

    const team = await getTeamByCode(teamId);
    if (!team) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (team.enabled === 0 || team.enabled === false) {
      return res.status(403).json({ error: 'This player is disabled by admin' });
    }

    // Backward compatibility: support both hashed and legacy plain-text password storage.
    let ok = false;
    if (team.password_hash) {
      ok = await bcrypt.compare(password, team.password_hash);
    } else if (team.password) {
      ok = password === String(team.password);
    }
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const gameState = await ensureGameState(team.id);
    const token = signSession(team);
    await setPresence(team.id, true);

    return res.json({
      token,
      user: {
        id: team.id,
        teamName: team.team_id,
        playerName: team.team_id,
        role: team.is_admin ? 'admin' : 'user',
        coins: team.coins,
      },
      progress: {
        round_1_complete: Boolean(gameState.round_1_complete),
        round_2_complete: Boolean(gameState.round_2_complete),
        round_3_complete: Boolean(gameState.round_3_complete),
        final_complete: Boolean(gameState.final_complete),
      },
      isFrozen: await isFrozen(team.id),
    });
  } catch (error) {
    console.error('[AUTH LOGIN]', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', authRequired, async (req, res) => {
  try {
    await setPresence(req.auth.sub, false);
    return res.json({ success: true });
  } catch (error) {
    console.error('[AUTH LOGOUT]', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

app.post('/api/presence/ping', authRequired, async (req, res) => {
  try {
    await setPresence(req.auth.sub, true);
    return res.json({ ok: true });
  } catch (error) {
    console.error('[PRESENCE PING]', error);
    return res.status(500).json({ error: 'Presence ping failed' });
  }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  try {
    const team = await getTeamById(req.auth.sub);
    if (!team) return res.status(404).json({ error: 'Session user not found' });
    const gameState = await ensureGameState(team.id);

    return res.json({
      user: {
        id: team.id,
        teamName: team.team_id,
        playerName: team.team_id,
        role: team.is_admin ? 'admin' : 'user',
      },
      team: {
        points: team.points,
        coins: team.coins,
        current_round: team.current_round,
      },
      progress: {
        round_1_complete: Boolean(gameState.round_1_complete),
        round_2_complete: Boolean(gameState.round_2_complete),
        round_3_complete: Boolean(gameState.round_3_complete),
        final_complete: Boolean(gameState.final_complete),
      },
      isFrozen: await isFrozen(team.id),
    });
  } catch (error) {
    console.error('[AUTH ME]', error);
    return res.status(500).json({ error: 'Unable to fetch session' });
  }
});

app.get('/api/team/runtime-status', authRequired, async (req, res) => {
  try {
    const team = await getTeamById(req.auth.sub);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const nowMysql = toMySQLTimestamp(new Date());
    const [freezeRows] = await pool.execute(
      `SELECT id
       FROM active_effects
       WHERE team_id = ? AND effect_type IN ('freeze', 'freeze_target')
       AND (expiry_time IS NULL OR expiry_time > ?)
       LIMIT 1`,
      [team.id, nowMysql]
    );

    const cooldownSeconds = await getTeamCooldownLeft(team.id);
    return res.json({
      isFrozen: Array.isArray(freezeRows) && freezeRows.length > 0,
      cooldownSeconds: Number(cooldownSeconds || 0),
    });
  } catch (error) {
    console.error('[TEAM RUNTIME STATUS]', error);
    return res.status(500).json({ error: 'Unable to fetch team runtime status' });
  }
});

app.get('/api/game/runtime', authRequired, async (_req, res) => {
  try {
    const runtime = await ensureGameRuntime();
    return res.json({ runtime });
  } catch (error) {
    console.error('[GAME RUNTIME]', error);
    return res.status(500).json({ error: 'Unable to fetch game runtime' });
  }
});

app.post('/api/admin/game/start', authRequired, adminRequired, async (req, res) => {
  try {
    const minutes = Math.max(1, Number(req.body?.minutes || 90));
    const runtime = await ensureGameRuntime();
    const now = new Date();
    const roundTimers = runtime.round_timers || {};

    const nextRuntime = await updateGameRuntime({
      status: 'LIVE',
      active_round: 'INTRO',
      started_at: runtime.started_at || now.toISOString(),
      paused_at: null,
      global_countdown_ends_at: new Date(now.getTime() + minutes * 60 * 1000).toISOString(),
      round_timer_ends_at: {
        INTRO: await calculateRoundTimerEndsAt('INTRO', roundTimers),
        ROUND_1: await calculateRoundTimerEndsAt('ROUND_1', roundTimers),
        ROUND_2: await calculateRoundTimerEndsAt('ROUND_2', roundTimers),
        ROUND_3: await calculateRoundTimerEndsAt('ROUND_3', roundTimers),
        FINAL: await calculateRoundTimerEndsAt('FINAL', roundTimers),
      },
    });

    return res.json({ success: true, runtime: nextRuntime });
  } catch (error) {
    console.error('[GAME START]', error);
    return res.status(500).json({ error: 'Unable to start game' });
  }
});

app.post('/api/admin/game/pause', authRequired, adminRequired, async (_req, res) => {
  try {
    const runtime = await ensureGameRuntime();
    const nextRuntime = await updateGameRuntime({
      status: 'PAUSED',
      paused_at: new Date().toISOString(),
    });
    return res.json({ success: true, runtime: nextRuntime });
  } catch (error) {
    console.error('[GAME PAUSE]', error);
    return res.status(500).json({ error: 'Unable to pause game' });
  }
});

app.post('/api/admin/game/resume', authRequired, adminRequired, async (_req, res) => {
  try {
    const runtime = await ensureGameRuntime();
    const nextRuntime = await updateGameRuntime({
      status: 'LIVE',
      paused_at: null,
    });
    return res.json({ success: true, runtime: nextRuntime });
  } catch (error) {
    console.error('[GAME RESUME]', error);
    return res.status(500).json({ error: 'Unable to resume game' });
  }
});

app.post('/api/admin/game/round', authRequired, adminRequired, async (req, res) => {
  try {
    const roundKey = String(req.body?.roundKey || '').trim();
    if (!roundKey) return res.status(400).json({ error: 'roundKey is required' });

    const runtime = await ensureGameRuntime();
    const round_timer_ends_at = { ...(runtime.round_timer_ends_at || {}) };
    round_timer_ends_at[roundKey] = await calculateRoundTimerEndsAt(roundKey, runtime.round_timers);

    const nextRuntime = await updateGameRuntime({
      active_round: roundKey,
      round_timer_ends_at,
    });

    return res.json({ success: true, runtime: nextRuntime });
  } catch (error) {
    console.error('[GAME ROUND]', error);
    return res.status(500).json({ error: 'Unable to set active round' });
  }
});

app.post('/api/admin/game/timer', authRequired, adminRequired, async (req, res) => {
  try {
    const roundKey = String(req.body?.roundKey || '').trim();
    const seconds = Math.max(30, Number(req.body?.seconds || 0));
    if (!roundKey) return res.status(400).json({ error: 'roundKey is required' });

    const runtime = await ensureGameRuntime();
    const round_timers = { ...(runtime.round_timers || {}) };
    round_timers[roundKey] = seconds;

    const round_timer_ends_at = { ...(runtime.round_timer_ends_at || {}) };
    round_timer_ends_at[roundKey] = await calculateRoundTimerEndsAt(roundKey, round_timers);

    const nextRuntime = await updateGameRuntime({
      round_timers,
      round_timer_ends_at,
    });

    return res.json({ success: true, runtime: nextRuntime });
  } catch (error) {
    console.error('[GAME TIMER]', error);
    return res.status(500).json({ error: 'Unable to set round timer' });
  }
});

app.post('/api/admin/team/freeze', authRequired, adminRequired, async (req, res) => {
  try {
    const { teamId, seconds } = req.body;
    if (!teamId || !seconds) return res.status(400).json({ error: 'teamId and seconds required' });

    // Remove existing freeze if any
    await pool.execute(
      "DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'freeze'",
      [teamId]
    );

    // Insert new freeze (Compute expiry fully in DB to avoid timezone issues)
    await pool.execute(
      "INSERT INTO active_effects (id, team_id, effect_type, effect_value, expiry_time, created_at) VALUES (?, ?, 'freeze', 1.0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP())",
      [uuid(), teamId, Number(seconds)]
    );

    // Update Global State
    if (!globalFreezeState.frozenTeams.includes(teamId)) {
      globalFreezeState.frozenTeams.push(teamId);
    }
    globalFreezeState.expiryTimes[teamId] = Date.now() + Number(seconds) * 1000;

    // Server-side Timer
    if (freezeTimers.has(teamId)) clearTimeout(freezeTimers.get(teamId));
    freezeTimers.set(teamId, setTimeout(async () => {
      try {
        await pool.execute("DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'freeze'", [teamId]);
        globalFreezeState.frozenTeams = globalFreezeState.frozenTeams.filter(id => id !== teamId);
        delete globalFreezeState.expiryTimes[teamId];
        freezeTimers.delete(teamId);
        broadcastFreezeUpdate();
        console.log(`[FREEZE] Auto-unfroze team ${teamId}`);
      } catch (err) { console.error('[FREEZE AUTO-UNFREEZE ERROR]', err); }
    }, Number(seconds) * 1000));

    broadcastFreezeUpdate();
    await syncTeamEffectsCache(teamId);
    await logAuctionEvent('admin_freeze', `Admin froze team ${teamId} for ${seconds}s`, { team_id: teamId, seconds });

    return res.json({ success: true, message: `Team frozen for ${seconds}s`, state: globalFreezeState });
  } catch (error) {
    console.error('[ADMIN FREEZE]', error);
    return res.status(500).json({ error: 'Unable to freeze team' });
  }
});

app.post('/api/admin/team/unfreeze', authRequired, adminRequired, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    await pool.execute(
      "DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'freeze'",
      [teamId]
    );

    // Update Global State
    globalFreezeState.frozenTeams = globalFreezeState.frozenTeams.filter(id => id !== teamId);
    delete globalFreezeState.expiryTimes[teamId];
    if (freezeTimers.has(teamId)) {
      clearTimeout(freezeTimers.get(teamId));
      freezeTimers.delete(teamId);
    }

    broadcastFreezeUpdate();
    await syncTeamEffectsCache(teamId);
    await logAuctionEvent('admin_unfreeze', `Admin unfrozen team ${teamId}`, { team_id: teamId });

    return res.json({ success: true, message: `Team unfrozen`, state: globalFreezeState });
  } catch (error) {
    console.error('[ADMIN UNFREEZE]', error);
    return res.status(500).json({ error: 'Unable to unfreeze team' });
  }
});

app.post('/api/admin/team/freeze-all-except', authRequired, adminRequired, async (req, res) => {
  try {
    const { excludeTeamId, seconds } = req.body;
    if (!seconds) return res.status(400).json({ error: 'seconds required' });

    // Fetch all non-admin teams
    const [teams] = await pool.execute('SELECT id FROM teams WHERE is_admin = 0');
    const targetTeams = teams.filter(t => t.id !== excludeTeamId);

    // Update Global State
    globalFreezeState.frozenTeams = targetTeams.map(t => t.id);
    globalFreezeState.freezeAllExcept = excludeTeamId || null;
    const expiry = Date.now() + Number(seconds) * 1000;
    
    for (const team of targetTeams) {
      await pool.execute("DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'freeze'", [team.id]);
      await pool.execute(
        "INSERT INTO active_effects (id, team_id, effect_type, effect_value, expiry_time, created_at) VALUES (?, ?, 'freeze', 1.0, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP())",
        [uuid(), team.id, Number(seconds)]
      );
      globalFreezeState.expiryTimes[team.id] = expiry;
      await syncTeamEffectsCache(team.id);
    }

    // Mass Timer
    if (freezeTimers.has('MASS_FREEZE')) clearTimeout(freezeTimers.get('MASS_FREEZE'));
    freezeTimers.set('MASS_FREEZE', setTimeout(async () => {
      try {
        await pool.execute("DELETE FROM active_effects WHERE effect_type = 'freeze'");
        globalFreezeState.frozenTeams = [];
        globalFreezeState.freezeAllExcept = null;
        globalFreezeState.expiryTimes = {};
        freezeTimers.delete('MASS_FREEZE');
        broadcastFreezeUpdate();
        console.log('[FREEZE] Mass unfreeze completed');
      } catch (err) { console.error('[MASS UNFREEZE ERROR]', err); }
    }, Number(seconds) * 1000));

    broadcastFreezeUpdate();
    await logAuctionEvent('admin_freeze_all', `Admin froze all teams except ${excludeTeamId || 'NONE'} for ${seconds}s`, { excludeTeamId, seconds });

    return res.json({ success: true, message: `Mass freeze applied for ${seconds}s`, state: globalFreezeState });
  } catch (error) {
    console.error('[ADMIN FREEZE ALL]', error);
    return res.status(500).json({ error: 'Unable to freeze all teams' });
  }
});

app.post('/api/admin/team/unfreeze-all', authRequired, adminRequired, async (req, res) => {
  try {
    const [teams] = await pool.execute('SELECT id FROM teams WHERE is_admin = 0');
    
    await pool.execute("DELETE FROM active_effects WHERE effect_type = 'freeze'");

    // Clear all timers
    freezeTimers.forEach(t => clearTimeout(t));
    freezeTimers.clear();

    // Reset State
    globalFreezeState = { frozenTeams: [], freezeAllExcept: null, expiryTimes: {} };
    
    broadcastFreezeUpdate();

    for (const team of teams) {
      await syncTeamEffectsCache(team.id);
    }

    await logAuctionEvent('admin_unfreeze_all', `Admin unfrozen all teams`, {});

    return res.json({ success: true, message: 'All teams unfrozen' });
  } catch (error) {
    console.error('[UNFREEZE ALL]', error);
    return res.status(500).json({ error: 'Unable to unfreeze all teams' });
  }
});

app.post('/api/admin/team/no-cooldown', authRequired, adminRequired, async (req, res) => {
  try {
    const { teamId, seconds } = req.body;
    if (!teamId || !seconds) return res.status(400).json({ error: 'teamId and seconds required' });

    await pool.execute(
      "DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'no_cooldown'",
      [teamId]
    );

    await pool.execute(
      "INSERT INTO active_effects (id, team_id, effect_type, expiry_time, created_at) VALUES (?, ?, 'no_cooldown', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), UTC_TIMESTAMP())",
      [uuid(), teamId, seconds]
    );

    await logAuctionEvent('admin_buff', `Admin granted NO_COOLDOWN to ${teamId} for ${seconds}s`, { team_id: teamId, seconds });
    return res.json({ success: true, message: `No-cooldown granted for ${seconds}s` });
  } catch (error) {
    console.error('[NO COOLDOWN]', error);
    return res.status(500).json({ error: 'Unable to grant no-cooldown' });
  }
});

app.post('/api/admin/team/revoke-no-cooldown', authRequired, adminRequired, async (req, res) => {
  try {
    const { teamId } = req.body;
    if (!teamId) return res.status(400).json({ error: 'teamId required' });

    await pool.execute(
      "DELETE FROM active_effects WHERE team_id = ? AND effect_type = 'no_cooldown'",
      [teamId]
    );

    await logAuctionEvent('admin_buff_revoke', `Admin revoked NO_COOLDOWN from ${teamId}`, { team_id: teamId });
    return res.json({ success: true, message: 'No-cooldown revoked' });
  } catch (error) {
    console.error('[REVOKE NO COOLDOWN]', error);
    return res.status(500).json({ error: 'Unable to revoke no-cooldown' });
  }
});

app.post('/api/admin/team/coins', authRequired, adminRequired, async (req, res) => {
  try {
    const { teamId, coins } = req.body;
    if (!teamId || coins === undefined) return res.status(400).json({ error: 'teamId and coins required' });

    const team = await getTeamById(teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    await pool.execute(
      "UPDATE teams SET coins = ? WHERE id = ?",
      [Number(coins), teamId]
    );

    await logAuctionEvent('admin_coins_update', `Admin updated team ${team.team_id} coins to ${coins}`, {
      team_id: teamId,
      coins
    });

    return res.json({ success: true, message: `Team ${team.team_id} coins set to ${coins}` });
  } catch (error) {
    console.error('[ADMIN COINS]', error);
    return res.status(500).json({ error: 'Unable to update coins' });
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    if (!leaderboardVisible) {
      return res.json({ leaderboard: [], visible: false });
    }

    const [rows] = await pool.execute(
      `SELECT t.id, t.team_id, t.points, t.current_round, t.is_admin, t.updated_at, t.coins,
              gs.round_1_complete, gs.round_2_complete, gs.round3_answered_count, gs.round_3_complete, gs.final_complete,
              COALESCE(tp.online, 0) AS online, tp.last_seen_at
       FROM teams t
       LEFT JOIN game_state gs ON gs.team_id = t.id
       LEFT JOIN team_presence tp ON tp.team_id = t.id
       WHERE t.is_admin = 0 AND t.enabled = 1
       ORDER BY t.points DESC`
    );

    const leaderboard = (rows || []).map((row) => {
      const r1 = Boolean(row.round_1_complete);
      const r2 = Boolean(row.round_2_complete);
      const r3c = Boolean(row.round_3_complete);
      const finalc = Boolean(row.final_complete);
      // Round-based progress only:
      // Round1 = 25%, Round2 = 50%, Round3 = 75%, Final = 100%
      const progress_percent =
        (r1 ? 25 : 0) +
        (r2 ? 25 : 0) +
        (r3c ? 25 : 0) +
        (finalc ? 25 : 0);

      return ({
      id: row.id,
      team_id: row.team_id,
      points: row.points,
      coins: row.coins,
      current_round: row.current_round,
      online: Boolean(row.online),
      last_seen_at: row.last_seen_at,
      progress_percent,
      progress: {
        round_1_complete: Boolean(row.round_1_complete),
        round_2_complete: Boolean(row.round_2_complete),
        round_3_complete: Boolean(row.round_3_complete),
        final_complete: Boolean(row.final_complete),
      },
      updated_at: row.updated_at,
      });
    });

    return res.json({ leaderboard, visible: true });
  } catch (error) {
    console.error('[LEADERBOARD]', error);
    return res.status(500).json({ error: 'Unable to fetch leaderboard' });
  }
});

app.get('/api/public/leaderboard-visibility', (_req, res) => {
  return res.json({ visible: leaderboardVisible });
});

app.post('/api/validate/round1', authRequired, async (req, res) => {
  try {
    const selectedNetwork = String(req.body?.selectedNetwork || '').trim();
    const password = String(req.body?.password || '').trim().toUpperCase();

    if (!selectedNetwork || !password) {
      return res.status(400).json({ error: 'selectedNetwork and password are required' });
    }

    const team = await getTeamById(req.auth.sub);
    const gameState = await ensureGameState(req.auth.sub);

    console.log(`[VALIDATE R1] Team: ${team?.team_id || req.auth.sub}, Password: ${password}`);

    if (!team || team.is_admin) return res.status(403).json({ error: 'Invalid team context' });
    if (gameState.round_1_complete) return res.json({ success: true, alreadyCompleted: true });

    const selectedNetworkNormalized = selectedNetwork.toUpperCase();
    const validNetwork =
      selectedNetwork === ROUND_SECRETS.round1.correctNetworkId ||
      selectedNetworkNormalized === String(ROUND_SECRETS.round1.correctNetworkName || '').toUpperCase();

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    const valid = validNetwork && password === ROUND_SECRETS.round1.correctPassword;

    if (!valid) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, error: 'Invalid network or password - 30S COOLDOWN' });
    }

    await pool.execute(
      'UPDATE game_state SET round_1_complete = 1 WHERE team_id = ?',
      [req.auth.sub]
    );

    await awardPointsAndRound(req.auth.sub, ROUND_SECRETS.round1.pointsAward, 1);

    return res.json({ success: true, message: 'Round 1 verified' });
  } catch (error) {
    console.error('[VALIDATE R1]', error);
    return res.status(500).json({ error: 'Round 1 validation failed' });
  }
});

app.post('/api/validate/round2', authRequired, async (req, res) => {
  try {
    const terminalKey = String(req.body?.terminalKey || '').trim().toUpperCase();
    const team = await getTeamById(req.auth.sub);
    const gameState = await ensureGameState(req.auth.sub);

    console.log(`[VALIDATE R2] Team: ${team?.team_id}, Input: ${terminalKey}`);

    if (!team || team.is_admin) return res.status(403).json({ error: 'Invalid team context' });
    if (!gameState.round_1_complete) return res.status(403).json({ error: 'Complete Round 1 first' });
    if (gameState.round_2_complete) return res.json({ success: true, alreadyCompleted: true });

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    const valid =
      terminalKey.toUpperCase() === String(ROUND_SECRETS.round2.correctTerminalKey || '').trim().toUpperCase();
    if (!valid) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, error: 'Invalid terminal key - 30S COOLDOWN' });
    }

    await pool.execute(
      'UPDATE game_state SET round_2_complete = 1 WHERE team_id = ?',
      [req.auth.sub]
    );

    await awardPointsAndRound(req.auth.sub, ROUND_SECRETS.round2.pointsAward, 2);

    return res.json({ success: true, message: 'Round 2 verified' });
  } catch (error) {
    console.error('[VALIDATE R2]', error);
    return res.status(500).json({ error: 'Round 2 validation failed' });
  }
});

app.post('/api/validate/round3', authRequired, async (req, res) => {
  try {
    const questionId = Number(req.body?.questionId);
    const answer = String(req.body?.answer || '').trim();

    if (!questionId || !answer) {
      return res.status(400).json({ error: 'questionId and answer are required' });
    }

    const team = await getTeamById(req.auth.sub);
    const gameState = await ensureGameState(req.auth.sub);

    console.log(`[VALIDATE R3] Team: ${team?.team_id}, Q: ${questionId}, Answer: ${answer}`);

    if (!team || team.is_admin) return res.status(403).json({ error: 'Invalid team context' });
    if (!gameState.round_2_complete) return res.status(403).json({ error: 'Complete Round 2 first' });

    const answeredCount = Number(gameState.round3_answered_count || 0);
    const expected = ROUND_SECRETS.round3.questions[answeredCount];

    if (!expected) {
      return res.json({
        success: true,
        roundComplete: true,
        mapLocation: ROUND_SECRETS.round3.coordinates,
      });
    }

    if (expected.id !== questionId) {
      return res.status(400).json({ error: 'Question order violation detected' });
    }

    const normalizeR3Answer = (raw) => {
      const s = String(raw || '').trim().toUpperCase();
      // accept formats like: "34.32° N", "34.32 N", "34.32N"
      // keep digits/dot/sign; keep trailing hemisphere letter if present.
      const compact = s.replace(/\s+/g, '');
      const strippedDegree = compact.replace(/°/g, '');
      return strippedDegree;
    };

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    const normalizedInput = normalizeR3Answer(answer);
    const normalizedExpected = normalizeR3Answer(expected.answer);
    const correct = normalizedInput === normalizedExpected;

    if (!correct) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, correct: false, error: 'INVALID RESPONSE - 30S COOLDOWN' });
    }

    const nextAnswered = answeredCount + 1;
    const nextLat = expected.section === 'latitude'
      ? `${gameState.round3_lat_progress || ''}${expected.digit}`
      : gameState.round3_lat_progress || '';
    const nextLon = expected.section === 'longitude'
      ? `${gameState.round3_lon_progress || ''}${expected.digit}`
      : gameState.round3_lon_progress || '';

    await pool.execute(
      `UPDATE game_state SET round3_answered_count = ?, round3_lat_progress = ?, round3_lon_progress = ? WHERE team_id = ?`,
      [nextAnswered, nextLat, nextLon, req.auth.sub]
    );

    return res.json({
      success: true,
      correct: true,
      coordinateDigit: expected.digit,
      section: expected.section,
      answeredCount: nextAnswered,
      message: 'ACCEPTED',
    });
  } catch (error) {
    console.error('[VALIDATE R3]', error);
    return res.status(500).json({ error: 'Round 3 validation failed' });
  }
});

app.post('/api/validate/round3-geo', authRequired, async (req, res) => {
  try {
    const lat = String(req.body?.latitude || '').trim();
    const lon = String(req.body?.longitude || '').trim();
    const team = await getTeamById(req.auth.sub);

    console.log(`[VALIDATE R3-GEO] Team: ${team?.team_id}, Lat: ${lat}, Lon: ${lon}`);

    if (!lat || !lon) {
      return res.status(400).json({ error: 'Latitude and Longitude are required' });
    }

    const gameState = await ensureGameState(req.auth.sub);
    
    // User requested normalization:
    // 1. Wrap multiple rotations
    // 2. Shortest angular form (modulo 360)
    // 3. Round to 2 decimals
    const normalizeCoord = (val) => {
      let n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      if (isNaN(n)) return "";
      // Wrap to -180 to 180 for longitude context
      let wrapped = ((n + 180) % 360 + 360) % 360 - 180;
      // Prefer West for -180
      if (wrapped === -180) wrapped = 180; 
      return Math.abs(wrapped).toFixed(2); // Shortest angular form from 0 is absolute value if we assume E/W is handled by sign
    };

    const targetLat = normalizeCoord(ROUND_SECRETS.round3.coordinates.latitude);
    const targetLon = normalizeCoord(ROUND_SECRETS.round3.coordinates.longitude);

    console.log(`[GEO DEBUG] Target: ${targetLat}, ${targetLon} | Input: ${lat}, ${lon}`);

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    if (normalizeCoord(lat) !== targetLat || normalizeCoord(lon) !== targetLon) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, correct: false, error: 'INVALID COORDINATES - 30S COOLDOWN' });
    }

    if (!gameState.round_3_complete) {
      await pool.execute(
        `UPDATE game_state SET round_3_complete = 1 WHERE team_id = ?`,
        [req.auth.sub]
      );
      await awardPointsAndRound(req.auth.sub, ROUND_SECRETS.round3.pointsAward, 3);
    }

    return res.json({
      success: true,
      correct: true,
      mapLocation: ROUND_SECRETS.round3.coordinates,
      message: 'GEO TRACE CONFIRMED',
    });
  } catch (error) {
    console.error('[VALIDATE R3 GEO]', error);
    return res.status(500).json({ error: 'Geo validation failed' });
  }
});

app.post('/api/validate/final-entry', authRequired, async (req, res) => {
  try {
    const password = String(req.body?.password || '').trim();
    const gameState = await ensureGameState(req.auth.sub);

    if (!gameState.round_3_complete) {
      return res.status(403).json({ error: 'Complete Round 3 first' });
    }

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    if (password !== ROUND_SECRETS.finalRound.entryPassword) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, error: 'Invalid final round password - 30S COOLDOWN' });
    }

    return res.json({ success: true, unlocked: true });
  } catch (error) {
    console.error('[VALIDATE FINAL ENTRY]', error);
    return res.status(500).json({ error: 'Final password validation failed' });
  }
});

app.post('/api/validate/final-gate', authRequired, async (req, res) => {
  try {
    const gateId = String(req.body?.gateId || '').trim();
    const stepIndex = Number(req.body?.stepIndex);
    const answer = String(req.body?.answer || '').trim();

    if (!gateId || isNaN(stepIndex) || !answer) {
      return res.status(400).json({ error: 'gateId, stepIndex, and answer are required' });
    }

    const gameState = await ensureGameState(req.auth.sub);

    if (!gameState.round_3_complete) {
      return res.status(403).json({ error: 'Complete Round 3 first' });
    }

    const gateAnswers = ROUND_SECRETS.finalRound.gates[gateId];
    if (!gateAnswers || stepIndex < 0 || stepIndex >= gateAnswers.length) {
      return res.status(400).json({ error: 'Invalid gate or step' });
    }

    const cooldownLeft = await getTeamCooldownLeft(req.auth.sub);
    if (cooldownLeft > 0) {
      return res.status(429).json({ success: false, error: `COOLDOWN ACTIVE: WAIT ${cooldownLeft}s` });
    }

    const frozen = await isFrozen(req.auth.sub);
    if (frozen) {
      return res.status(403).json({ success: false, error: 'YOU ARE FROZEN BY ADMIN' });
    }

    const expected = gateAnswers[stepIndex].toLowerCase();
    const input = answer.toLowerCase();

    if (expected !== input) {
      await setTeamCooldown(req.auth.sub, 30);
      return res.status(400).json({ success: false, correct: false, error: 'INVALID FLAG - 30S COOLDOWN' });
    }

    return res.json({ success: true, correct: true, message: 'FLAG APPROVED' });
  } catch (error) {
    console.error('[VALIDATE FINAL GATE]', error);
    return res.status(500).json({ error: 'Gate validation failed' });
  }
});

app.post('/api/final/complete', authRequired, async (req, res) => {
  try {
    const gameState = await ensureGameState(req.auth.sub);

    if (!gameState.round_3_complete) {
      return res.status(403).json({ error: 'Complete Round 3 first' });
    }

    if (!gameState.final_complete) {
      await pool.execute(
        'UPDATE game_state SET final_complete = 1 WHERE team_id = ?',
        [req.auth.sub]
      );

      await awardPointsAndRound(req.auth.sub, ROUND_SECRETS.finalRound.pointsAward, 4);
    }

    return res.json({ success: true, final_complete: true });
  } catch (error) {
    console.error('[FINAL COMPLETE]', error);
    return res.status(500).json({ error: 'Final completion failed' });
  }
});

app.get('/api/auction/state', authRequired, async (req, res) => {
  try {
    const preRuntime = await ensureAuctionRuntime();
    await autoFinalizeExpiredTargetAuction(preRuntime);

    const team = await getTeamById(req.auth.sub);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const runtime = await ensureAuctionRuntime();

    const [bids] = await pool.execute(
      `SELECT ab.team_id, ab.amount, ab.created_at, t.team_id AS team_code
       FROM auction_bids ab
       LEFT JOIN teams t ON t.id = ab.team_id
       ORDER BY ab.amount DESC, ab.created_at ASC`
    );

    const [events] = await pool.execute(
      `SELECT id, event_type, message, payload, created_at
       FROM auction_events
       ORDER BY created_at DESC LIMIT 25`
    );

    const [targetTeams] = await pool.execute(
      `SELECT id, team_id, points, enabled, is_admin FROM teams
       WHERE enabled = 1 AND is_admin = 0
       ORDER BY points DESC`
    );

    // Parse JSON payload in events
    const parsedEvents = (events || []).map((ev) => {
      if (typeof ev.payload === 'string') {
        try { ev.payload = JSON.parse(ev.payload); } catch { /* keep */ }
      }
      return ev;
    });

    return res.json({
      runtime,
      bids: (bids || []).map((bid) => ({
        team_id: bid.team_id,
        team_code: bid.team_code || 'UNKNOWN',
        amount: bid.amount,
        created_at: bid.created_at,
      })),
      events: parsedEvents,
      targetTeams: targetTeams || [],
      me: {
        id: team.id,
        team_id: team.team_id,
        points: team.points,
        coins: team.coins,
        is_admin: Boolean(team.is_admin),
      },
    });
  } catch (error) {
    console.error('[AUCTION STATE]', error);
    return res.status(500).json({ error: 'Unable to fetch auction state' });
  }
});

app.post('/api/admin/auction/start', authRequired, adminRequired, async (req, res) => {
  try {
    await ensureAuctionRuntime();
    // Safety: refund any reserved coins from a previous auction before clearing bids.
    const [existingBids] = await pool.execute('SELECT team_id, amount FROM auction_bids');
    for (const bid of existingBids || []) {
      const refund = Number(bid.amount || 0);
      if (refund > 0) {
        await updateTeamCoins(bid.team_id, refund);
      }
    }
    await pool.execute('DELETE FROM auction_bids');

    const runtime = await updateAuctionRuntime({
      active: true,
      phase: 'bidding',
      winner_team_id: null,
      winning_bid: null,
      drawn_card: null,
      target_team_id: null,
      target_selection_deadline: null,
    });

    await logAuctionEvent('auction_started', 'Auction window opened - awaiting card display');

    return res.json({ success: true, runtime });
  } catch (error) {
    console.error('[AUCTION START]', error);
    return res.status(500).json({ error: 'Unable to start auction' });
  }
});

app.post('/api/admin/auction/display-card', authRequired, adminRequired, async (req, res) => {
  try {
    const cardId = req.body?.cardId;
    const card = AUCTION_CARDS.find(c => c.id === cardId);
    
    if (!card) {
      return res.status(400).json({ error: 'Valid cardId is required' });
    }

    const runtime = await ensureAuctionRuntime();
    if (!runtime.active) {
      return res.status(400).json({ error: 'Auction is not active' });
    }

    const updated = await updateAuctionRuntime({
      drawn_card: card,
    });

    await logAuctionEvent('card_displayed', `Card displayed: ${card.name}`);

    return res.json({ success: true, runtime: updated });
  } catch (error) {
    console.error('[AUCTION DISPLAY CARD]', error);
    return res.status(500).json({ error: 'Unable to display card' });
  }
});

app.post('/api/auction/bid', authRequired, async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (!Number.isInteger(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Bid amount must be a positive integer' });
    }

    const team = await getTeamById(req.auth.sub);
    if (!team) {
      return res.status(403).json({ error: 'Team not found' });
    }
    if (team.is_admin) {
      return res.status(403).json({ error: 'Admins cannot place bids' });
    }
    if (team.enabled === 0 || team.enabled === false) {
      return res.status(403).json({ error: 'This player is disabled by admin' });
    }

    const runtime = await ensureAuctionRuntime();
    if (!runtime.active || runtime.phase !== 'bidding') {
      return res.status(400).json({ error: 'Auction is not accepting bids right now' });
    }

    const frozen = await isFrozen(team.id);
    if (frozen) {
      return res.status(403).json({ error: 'You are frozen and cannot bid right now' });
    }

    if (runtime.drawn_card && amount < Number(runtime.drawn_card.min_value || 0)) {
      return res.status(400).json({ error: `Bid must be at least ${runtime.drawn_card.min_value} coins` });
    }

    // Reserve coins immediately on bid placement (and release on bid reduction).
    // This enables real-time balance updates while allowing refunds for non-winners.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock current bid row (if any) to compute delta safely.
      const [existingRows] = await conn.execute(
        'SELECT amount FROM auction_bids WHERE team_id = ? LIMIT 1 FOR UPDATE',
        [team.id]
      );
      const previous = Number(existingRows?.[0]?.amount || 0);
      const delta = amount - previous;

      // Lock team row to update coins safely.
      const [teamRows] = await conn.execute(
        'SELECT coins FROM teams WHERE id = ? LIMIT 1 FOR UPDATE',
        [team.id]
      );
      const currentCoins = Number(teamRows?.[0]?.coins || 0);

      if (delta > 0 && delta > currentCoins) {
        await conn.rollback();
        return res.status(400).json({ error: 'Bid exceeds your available coins' });
      }

      if (delta !== 0) {
        await conn.execute(
          'UPDATE teams SET coins = GREATEST(0, coins - ?) WHERE id = ?',
          [delta, team.id]
        );
      }

      // Upsert bid (insert or update)
      await conn.execute(
        `INSERT INTO auction_bids (id, team_id, amount, created_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), created_at = NOW()`,
        [uuid(), team.id, amount]
      );

      await conn.commit();
    } catch (err) {
      try { await conn.rollback(); } catch { /* ignore */ }
      throw err;
    } finally {
      conn.release();
    }

    await logAuctionEvent('bid_placed', `${team.team_id} placed a bid`, {
      team_id: team.id,
      amount,
    });

    return res.json({ success: true, amount });
  } catch (error) {
    console.error('[AUCTION BID]', error);
    return res.status(500).json({ error: 'Unable to place bid' });
  }
});

app.post('/api/admin/auction/resolve', authRequired, adminRequired, async (req, res) => {
  try {
    const runtime = await ensureAuctionRuntime();
    if (!runtime.active) {
      return res.status(400).json({ error: 'Auction is not active' });
    }

    const winnerTeamId = req.body?.winnerTeamId;
    if (!winnerTeamId) {
      return res.status(400).json({ error: 'winnerTeamId is required — select a team to award the card' });
    }

    const winner = await getTeamById(winnerTeamId);
    if (!winner) {
      return res.status(400).json({ error: 'Selected team not found' });
    }

    const card = runtime.drawn_card;

    // Store won card in won_cards table
    if (card) {
      await pool.execute(
        `INSERT INTO won_cards (id, team_id, card_id, card_name, card_data, won_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [uuid(), winner.id, card.id || 'unknown', card.name || 'Unknown Card', JSON.stringify(card)]
      );
    }

    // Winner's bid is already reserved/deducted at bid time.
    // At resolution, refund all non-winning bidders back to their pre-bid balance.
    const [winnerBidRows] = await pool.execute(
      'SELECT amount FROM auction_bids WHERE team_id = ? LIMIT 1',
      [winner.id]
    );
    const bidAmount = Number(winnerBidRows?.[0]?.amount || 0);
    if (!bidAmount || bidAmount <= 0) {
      return res.status(400).json({ error: 'Selected team has no valid bid to resolve' });
    }

    const [otherBids] = await pool.execute(
      'SELECT team_id, amount FROM auction_bids WHERE team_id != ?',
      [winner.id]
    );
    for (const bid of otherBids || []) {
      const refund = Number(bid.amount || 0);
      if (refund > 0) {
        await updateTeamCoins(bid.team_id, refund);
      }
    }
    // Keep only the winner bid row for reference during targeting/resolved states.
    await pool.execute('DELETE FROM auction_bids WHERE team_id != ?', [winner.id]);

    // Apply card effect if it's a self-targeting card
    if (card && card.target_type !== 'other') {
      await applyCardEffect({ winnerTeamId: winner.id, card });
    }

    const nextPhase = card && card.target_type === 'other' ? 'targeting' : 'resolved';
    const targetDeadlineSeconds = 60;

    // Do NOT close auction here — only the "close" button deactivates it.
    const updatedRuntime = await updateAuctionRuntime({
      active: true,
      phase: nextPhase,
      winner_team_id: winner.id,
      winning_bid: bidAmount,
      // keep drawn_card visible until admin closes auction
      drawn_card: card || runtime.drawn_card || null,
      target_team_id: null,
      target_selection_deadline: nextPhase === 'targeting'
        ? new Date(Date.now() + targetDeadlineSeconds * 1000).toISOString()
        : null,
    });

    await logAuctionEvent('auction_resolved', `Card "${card?.name || 'Unknown'}" awarded to ${winner.team_id}`, {
      winner_team_id: winner.id,
      winning_bid: bidAmount,
      card,
    });

    return res.json({
      success: true,
      runtime: updatedRuntime,
      winner: { id: winner.id, team_id: winner.team_id },
      card,
    });
  } catch (error) {
    console.error('[AUCTION RESOLVE]', error);
    return res.status(500).json({ error: 'Unable to resolve auction' });
  }
});

app.get('/api/auction/won-cards', authRequired, async (req, res) => {
  try {
    const team = await getTeamById(req.auth.sub);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const [cards] = await pool.execute(
      `SELECT id, team_id, card_id, card_name, card_data, won_at
       FROM won_cards
       WHERE team_id = ?
       ORDER BY won_at DESC
       LIMIT 50`,
      [team.id]
    );

    const parsedCards = (cards || []).map((card) => {
      if (typeof card.card_data === 'string') {
        try {
          card.card_data = JSON.parse(card.card_data);
        } catch { /* keep as string */ }
      }
      return card;
    });

    return res.json({
      cards: parsedCards,
      total: parsedCards.length,
    });
  } catch (error) {
    console.error('[AUCTION WON CARDS]', error);
    return res.status(500).json({ error: 'Unable to fetch won cards' });
  }
});

app.get('/api/admin/auction/won-cards', authRequired, adminRequired, async (_req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT wc.id, wc.team_id, t.team_id AS team_code, wc.card_id, wc.card_name, wc.card_data, wc.won_at
       FROM won_cards wc
       LEFT JOIN teams t ON t.id = wc.team_id
       ORDER BY wc.won_at DESC
       LIMIT 500`
    );

    const cards = (rows || []).map((card) => {
      if (typeof card.card_data === 'string') {
        try { card.card_data = JSON.parse(card.card_data); } catch { /* keep */ }
      }
      return card;
    });

    const byTeam = {};
    for (const card of cards) {
      const key = card.team_id;
      if (!byTeam[key]) {
        byTeam[key] = { team_id: card.team_id, team_code: card.team_code || 'UNKNOWN', cards: [] };
      }
      byTeam[key].cards.push(card);
    }

    return res.json({ teams: Object.values(byTeam), total: cards.length });
  } catch (error) {
    console.error('[ADMIN WON CARDS]', error);
    return res.status(500).json({ error: 'Unable to fetch won cards (admin)' });
  }
});

app.delete('/api/admin/auction/won-cards/:wonCardId', authRequired, adminRequired, async (req, res) => {
  try {
    const wonCardId = String(req.params.wonCardId || '').trim();
    if (!wonCardId) return res.status(400).json({ error: 'wonCardId is required' });

    const [rows] = await pool.execute(
      'SELECT id, team_id, card_name FROM won_cards WHERE id = ? LIMIT 1',
      [wonCardId]
    );
    const card = rows?.[0];
    if (!card) return res.status(404).json({ error: 'Won card not found' });

    await pool.execute('DELETE FROM won_cards WHERE id = ?', [wonCardId]);
    await logAuctionEvent('card_revoked', `Admin revoked card "${card.card_name}"`, {
      won_card_id: wonCardId,
      team_id: card.team_id,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('[ADMIN REVOKE CARD]', error);
    return res.status(500).json({ error: 'Unable to revoke card' });
  }
});

app.post('/api/auction/target', authRequired, async (req, res) => {
  try {
    const targetTeamId = String(req.body?.targetTeamId || '').trim();
    if (!targetTeamId) {
      return res.status(400).json({ error: 'targetTeamId is required' });
    }

    const runtime = await ensureAuctionRuntime();
    if (!runtime.active || runtime.phase !== 'targeting') {
      return res.status(400).json({ error: 'No target selection pending' });
    }

    if (!req.auth.is_admin) {
      return res.status(403).json({ error: 'Only admin can apply card targets' });
    }

    if (targetTeamId === runtime.winner_team_id) {
      return res.status(400).json({ error: 'You cannot target yourself' });
    }

    const target = await getTeamById(targetTeamId);
    if (!target || target.is_admin || target.enabled === 0 || target.enabled === false) {
      return res.status(400).json({ error: 'Invalid target selected' });
    }

    const alreadyTargeted = await recentlyTargetedByWinner(runtime.winner_team_id, targetTeamId, 120);
    if (alreadyTargeted) {
      return res.status(400).json({ error: 'Target recently attacked by same winner. Pick another team.' });
    }

    const card = runtime.drawn_card;
    const effectResult = await applyCardEffect({
      winnerTeamId: runtime.winner_team_id,
      card,
      targetTeamId,
    });

    const updated = await updateAuctionRuntime({
      active: true,
      phase: 'resolved',
      target_team_id: targetTeamId,
      target_selection_deadline: null,
      drawn_card: card || runtime.drawn_card || null,
    });

    await logAuctionEvent('target_applied', `Target selected for ${card?.name || 'card effect'}`, {
      winner_team_id: runtime.winner_team_id,
      target_team_id: targetTeamId,
      card,
      effect_result: effectResult,
    });

    return res.json({ success: true, runtime: updated, effectResult });
  } catch (error) {
    console.error('[AUCTION TARGET]', error);
    return res.status(500).json({ error: 'Unable to apply target effect' });
  }
});

app.post('/api/admin/auction/close', authRequired, adminRequired, async (_req, res) => {
  try {
    await ensureAuctionRuntime();
    const runtime = await ensureAuctionRuntime();

    // Refund all reserved bids except the winner (winner keeps their deduction).
    const [bids] = await pool.execute('SELECT team_id, amount FROM auction_bids');
    for (const bid of bids || []) {
      const refund = Number(bid.amount || 0);
      if (refund <= 0) continue;
      if (runtime?.winner_team_id && bid.team_id === runtime.winner_team_id) continue;
      await updateTeamCoins(bid.team_id, refund);
    }

    await pool.execute('DELETE FROM auction_bids');
    const updated = await updateAuctionRuntime({
      active: false,
      phase: 'idle',
      winner_team_id: null,
      winning_bid: null,
      drawn_card: null,
      target_team_id: null,
      target_selection_deadline: null,
    });

    await logAuctionEvent('auction_closed', 'Auction manually closed by admin');
    return res.json({ success: true, runtime: updated });
  } catch (error) {
    console.error('[AUCTION CLOSE]', error);
    return res.status(500).json({ error: 'Unable to close auction' });
  }
});

app.get('/api/admin/teams', authRequired, adminRequired, async (_req, res) => {
  try {
    const nowMysql = toMySQLTimestamp(new Date());
    const [rows] = await pool.execute(
      `SELECT t.id, t.team_id, t.points, t.coins, t.current_round, t.enabled, t.updated_at,
              gs.round_1_complete, gs.round_2_complete, gs.round_3_complete, gs.final_complete,
              COALESCE(tp.online, 0) AS online, tp.last_seen_at,
              (SELECT COUNT(*) FROM active_effects ae 
               WHERE ae.team_id = t.id AND ae.effect_type = 'freeze' 
               AND (ae.expiry_time IS NULL OR ae.expiry_time > ?)) as is_frozen
       FROM teams t
       LEFT JOIN game_state gs ON gs.team_id = t.id
       LEFT JOIN team_presence tp ON tp.team_id = t.id
       WHERE t.is_admin = 0
       ORDER BY t.points DESC`,
      [nowMysql]
    );

    const teams = (rows || []).map((row) => {
      const r1 = Boolean(row.round_1_complete);
      const r2 = Boolean(row.round_2_complete);
      const r3 = Boolean(row.round_3_complete);
      const f = Boolean(row.final_complete);
      const progress_percent = (r1 ? 25 : 0) + (r2 ? 25 : 0) + (r3 ? 25 : 0) + (f ? 25 : 0);

      return {
        id: row.id,
        team_id: row.team_id,
        points: row.points,
        coins: row.coins,
        current_round: row.current_round,
        enabled: Boolean(row.enabled),
        is_frozen: Boolean(row.is_frozen),
        online: Boolean(row.online),
        last_seen_at: row.last_seen_at || null,
        progress_percent,
        updated_at: row.updated_at,
        game_state: [{
          round_1_complete: r1,
          round_2_complete: r2,
          round_3_complete: r3,
          final_complete: f,
        }],
      };
    }).sort((a, b) =>
      (b.progress_percent - a.progress_percent) ||
      (b.current_round - a.current_round) ||
      (b.points - a.points) ||
      a.team_id.localeCompare(b.team_id)
    );

    return res.json({ teams });
  } catch (error) {
    console.error('[ADMIN TEAMS]', error);
    return res.status(500).json({ error: 'Unable to fetch admin team list' });
  }
});

app.patch('/api/admin/teams/:teamId/enabled', authRequired, adminRequired, async (req, res) => {
  try {
    const teamId = String(req.params.teamId || '').trim();
    const enabled = Boolean(req.body?.enabled);

    if (!teamId) {
      return res.status(400).json({ error: 'teamId is required' });
    }

    const [rows] = await pool.execute(
      'SELECT id, team_id, is_admin, enabled FROM teams WHERE id = ? LIMIT 1',
      [teamId]
    );

    const team = rows[0];
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.is_admin) return res.status(400).json({ error: 'Admin account cannot be toggled' });

    await pool.execute(
      'UPDATE teams SET enabled = ? WHERE id = ?',
      [enabled ? 1 : 0, teamId]
    );

    return res.json({ success: true, team_id: team.team_id, enabled });
  } catch (error) {
    console.error('[ADMIN TOGGLE TEAM]', error);
    return res.status(500).json({ error: 'Unable to update player status' });
  }
});

app.post('/api/admin/leaderboard-visibility', authRequired, adminRequired, (req, res) => {
  try {
    if (typeof req.body?.visible !== 'boolean') {
      return res.status(400).json({ error: 'visible boolean is required' });
    }

    leaderboardVisible = req.body.visible;
    return res.json({ success: true, visible: leaderboardVisible });
  } catch (error) {
    console.error('[ADMIN LEADERBOARD VISIBILITY]', error);
    return res.status(500).json({ error: 'Unable to update leaderboard visibility' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[API] Operation Red Trophy backend listening on http://0.0.0.0:${port}`);
});

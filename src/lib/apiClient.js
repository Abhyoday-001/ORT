import { BACKEND_URL } from './config';

const API_BASE = BACKEND_URL;

async function request(path, options = {}) {
  const token = sessionStorage.getItem('matrix_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error || data?.message || 'Request failed';
    throw new Error(message);
  }

  return data;
}

export async function loginTeam(team_id, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ team_id, password }),
  });
}

export async function fetchSession() {
  return request('/api/auth/me');
}

export async function fetchLeaderboard() {
  return request('/api/leaderboard');
}

export async function fetchLeaderboardVisibility() {
  return request('/api/public/leaderboard-visibility');
}

export async function setLeaderboardVisibility(visible) {
  return request('/api/admin/leaderboard-visibility', {
    method: 'POST',
    body: JSON.stringify({ visible }),
  });
}

export async function fetchAdminTeams() {
  return request('/api/admin/teams');
}

export async function setPlayerEnabled(teamId, enabled) {
  return request(`/api/admin/teams/${teamId}/enabled`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function validateRound1(selectedNetwork, password) {
  return request('/api/validate/round1', {
    method: 'POST',
    body: JSON.stringify({ selectedNetwork, password }),
  });
}

export async function validateRound2(terminalKey) {
  return request('/api/validate/round2', {
    method: 'POST',
    body: JSON.stringify({ terminalKey }),
  });
}

export async function validateRound3(questionId, answer) {
  return request('/api/validate/round3', {
    method: 'POST',
    body: JSON.stringify({ questionId, answer }),
  });
}

export async function validateRound3Geo(latitude, longitude) {
  return request('/api/validate/round3-geo', {
    method: 'POST',
    body: JSON.stringify({ latitude, longitude }),
  });
}

export async function validateFinalGate(gateId, stepIndex, answer) {
  return request('/api/validate/final-gate', {
    method: 'POST',
    body: JSON.stringify({ gateId, stepIndex, answer }),
  });
}

export async function validateFinalEntry(password) {
  return request('/api/validate/final-entry', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function completeFinalRound() {
  return request('/api/final/complete', { method: 'POST' });
}

export async function fetchGameRuntime() {
  return request('/api/game/runtime');
}

export async function adminStartGameRuntime(minutes) {
  return request('/api/admin/game/start', {
    method: 'POST',
    body: JSON.stringify({ minutes }),
  });
}

export async function adminPauseGameRuntime() {
  return request('/api/admin/game/pause', { method: 'POST' });
}

export async function adminResumeGameRuntime() {
  return request('/api/admin/game/resume', { method: 'POST' });
}

export async function adminSetGameActiveRound(roundKey) {
  return request('/api/admin/game/round', {
    method: 'POST',
    body: JSON.stringify({ roundKey }),
  });
}

export async function adminSetGameRoundTimer(roundKey, seconds) {
  return request('/api/admin/game/timer', {
    method: 'POST',
    body: JSON.stringify({ roundKey, seconds }),
  });
}

export async function adminFreezeTeam(teamId, seconds) {
  return request('/api/admin/team/freeze', {
    method: 'POST',
    body: JSON.stringify({ teamId, seconds }),
  });
}

export async function adminUnfreezeTeam(teamId) {
  return request('/api/admin/team/unfreeze', {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}

export async function adminFreezeAllExcept(excludeTeamId, seconds) {
  return request('/api/admin/team/freeze-all-except', {
    method: 'POST',
    body: JSON.stringify({ excludeTeamId, seconds }),
  });
}

export async function adminUnfreezeAll() {
  return request('/api/admin/team/unfreeze-all', {
    method: 'POST',
  });
}

export async function adminGrantNoCooldown(teamId, seconds) {
  return request('/api/admin/team/no-cooldown', {
    method: 'POST',
    body: JSON.stringify({ teamId, seconds }),
  });
}

export async function adminRevokeNoCooldown(teamId) {
  return request('/api/admin/team/revoke-no-cooldown', {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}

export async function adminUpdateTeamCoins(teamId, coins) {
  return request('/api/admin/team/coins', {
    method: 'POST',
    body: JSON.stringify({ teamId, coins }),
  });
}

export async function fetchAuctionState() {
  return request('/api/auction/state');
}

export async function placeAuctionBid(amount) {
  return request('/api/auction/bid', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  });
}

export async function submitAuctionTarget(targetTeamId) {
  return request('/api/auction/target', {
    method: 'POST',
    body: JSON.stringify({ targetTeamId }),
  });
}

export async function adminStartAuction() {
  return request('/api/admin/auction/start', { method: 'POST' });
}

export async function adminDisplayCard(cardId) {
  return request('/api/admin/auction/display-card', {
    method: 'POST',
    body: JSON.stringify({ cardId }),
  });
}

export async function adminResolveAuction(winnerTeamId) {
  return request('/api/admin/auction/resolve', {
    method: 'POST',
    body: JSON.stringify({ winnerTeamId }),
  });
}

export async function adminCloseAuction() {
  return request('/api/admin/auction/close', { method: 'POST' });
}

export async function fetchWonCards() {
  return request('/api/auction/won-cards');
}

export async function adminFetchWonCards() {
  return request('/api/admin/auction/won-cards');
}

export async function adminRevokeWonCard(wonCardId) {
  return request(`/api/admin/auction/won-cards/${wonCardId}`, { method: 'DELETE' });
}

export async function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export async function presencePing() {
  return request('/api/presence/ping', { method: 'POST' });
}

export async function fetchTeamRuntimeStatus() {
  return request('/api/team/runtime-status');
}

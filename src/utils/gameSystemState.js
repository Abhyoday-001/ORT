import { AUCTION_CARDS } from '../config/auctionCards';

const STORAGE_KEY = 'ort_game_system_state_v1';

const ROUND_SCORE = {
  INTRO_COMPLETE: 1000,
  ROUND_1_COMPLETE: 1000,
  ROUND_2_COMPLETE: 1000,
  ROUND_3_COMPLETE: 1000,
  FINAL_ROUND_COMPLETE: 1000,
};

const DEFAULT_TEAMS = {
  RED_ALPHA: {
    teamName: 'RED_ALPHA',
    points: 500,
    status: 'READY',
    currentRound: 'INTRO',
    progressFlags: [],
    skips: 0,
    hints: 0,
    extraPuzzles: 0,
    timeOffset: 0,
    finalPath: null,
    finalCompletedAt: null,
    updatedAt: Date.now(),
  },
};

const createDefaultState = () => ({
  status: 'PAUSED',
  activeRound: 'INTRO',
  startedAt: null,
  pausedAt: null,
  globalCountdownEndsAt: null,
  roundTimers: {
    INTRO: 180,
    ROUND_1: 900,
    ROUND_2: 900,
    ROUND_3: 1200,
    FINAL: 1800,
  },
  roundTimerEndsAt: {
    INTRO: null,
    ROUND_1: null,
    ROUND_2: null,
    ROUND_3: null,
    FINAL: null,
  },
  auction: {
    active: false,
    phase: 'idle',
    deck: shuffleCards(AUCTION_CARDS),
    bids: {},
    winnerTeam: null,
    winningBid: 0,
    drawnCard: null,
    triggeredAt: null,
  },
  finalRound: {
    entryPassword: 'V2016K',
    unlockedTeams: {},
    teamPath: {},
    teamPuzzleStep: {},
    winnerTeam: null,
  },
  teams: { ...DEFAULT_TEAMS },
  eventLog: [],
  version: 1,
});

function shuffleCards(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(input) {
  const defaults = createDefaultState();
  const state = { ...defaults, ...input };

  state.roundTimers = { ...defaults.roundTimers, ...(input?.roundTimers || {}) };
  state.roundTimerEndsAt = { ...defaults.roundTimerEndsAt, ...(input?.roundTimerEndsAt || {}) };
  state.teams = { ...defaults.teams, ...(input?.teams || {}) };
  state.finalRound = { ...defaults.finalRound, ...(input?.finalRound || {}) };
  // Force current event password even for older persisted local state.
  state.finalRound.entryPassword = defaults.finalRound.entryPassword;
  state.auction = {
    ...defaults.auction,
    ...(input?.auction || {}),
    deck: Array.isArray(input?.auction?.deck) && input.auction.deck.length > 0
      ? input.auction.deck
      : defaults.auction.deck,
  };
  state.eventLog = Array.isArray(input?.eventLog) ? input.eventLog.slice(-200) : defaults.eventLog;

  return state;
}

export function loadGameSystemState() {
  const fallback = createDefaultState();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return fallback;
  return normalizeState(safeParse(raw, fallback));
}

export function saveGameSystemState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('ort:game-system-updated', { detail: state }));
}

export function subscribeGameSystem(listener) {
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    listener(loadGameSystemState());
  };

  const onInternal = (event) => {
    listener(event.detail || loadGameSystemState());
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener('ort:game-system-updated', onInternal);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('ort:game-system-updated', onInternal);
  };
}

function updateState(mutator) {
  const current = loadGameSystemState();
  const next = normalizeState(mutator({ ...current }));
  saveGameSystemState(next);
  return next;
}

function upsertTeam(state, teamName) {
  if (!teamName) return;
  if (!state.teams[teamName]) {
    state.teams[teamName] = {
      teamName,
      points: 500,
      status: 'READY',
      currentRound: 'INTRO',
      progressFlags: [],
      skips: 0,
      hints: 0,
      extraPuzzles: 0,
      timeOffset: 0,
      finalPath: null,
      finalCompletedAt: null,
      updatedAt: Date.now(),
    };
  }
}

function addLog(state, text) {
  state.eventLog = [...state.eventLog, { at: Date.now(), text }].slice(-200);
}

function applyCardEffect(team, card) {
  if (!card || !card.effect) return;
  const { kind, value } = card.effect;
  if (kind === 'points') team.points += value;
  if (kind === 'skip') team.skips += value;
  if (kind === 'hint') team.hints += value;
  if (kind === 'extraPuzzle') team.extraPuzzles += value;
  if (kind === 'timePenalty') team.timeOffset -= value;
  if (kind === 'timeBonus') team.timeOffset += value;
}

export function ensureTeam(teamName) {
  if (!teamName) return loadGameSystemState();
  return updateState((state) => {
    upsertTeam(state, teamName);
    state.teams[teamName].updatedAt = Date.now();
    return state;
  });
}

export function updateTeamFlag(teamName, flag) {
  return updateState((state) => {
    upsertTeam(state, teamName);
    const team = state.teams[teamName];
    if (!team.progressFlags.includes(flag)) {
      team.progressFlags.push(flag);
      team.points += ROUND_SCORE[flag] || 0;
    }

    if (flag === 'INTRO_COMPLETE') team.currentRound = 'ROUND_1';
    if (flag === 'ROUND_1_COMPLETE') team.currentRound = 'ROUND_2';
    if (flag === 'ROUND_2_COMPLETE') team.currentRound = 'ROUND_3';
    if (flag === 'ROUND_3_COMPLETE') team.currentRound = 'FINAL';
    if (flag === 'FINAL_ROUND_COMPLETE') {
      team.currentRound = 'VAULT';
      team.status = 'COMPLETED';
    }

    team.updatedAt = Date.now();
    addLog(state, `${teamName} flagged ${flag}`);
    return state;
  });
}

export function setTeamStatus(teamName, status) {
  return updateState((state) => {
    upsertTeam(state, teamName);
    state.teams[teamName].status = status;
    state.teams[teamName].updatedAt = Date.now();
    return state;
  });
}

export function adminStartGame(minutes = 90) {
  return updateState((state) => {
    const now = Date.now();
    state.status = 'LIVE';
    state.startedAt = state.startedAt || now;
    state.pausedAt = null;
    state.globalCountdownEndsAt = now + minutes * 60 * 1000;
    addLog(state, `ADMIN started game (${minutes}m)`);
    return state;
  });
}

export function adminPauseGame() {
  return updateState((state) => {
    state.status = 'PAUSED';
    state.pausedAt = Date.now();
    addLog(state, 'ADMIN paused game');
    return state;
  });
}

export function adminResumeGame() {
  return updateState((state) => {
    if (state.status === 'PAUSED' && state.pausedAt && state.globalCountdownEndsAt) {
      const pausedDuration = Date.now() - state.pausedAt;
      state.globalCountdownEndsAt += pausedDuration;
    }
    state.status = 'LIVE';
    state.pausedAt = null;
    addLog(state, 'ADMIN resumed game');
    return state;
  });
}

export function adminSetRoundTimer(roundKey, seconds) {
  return updateState((state) => {
    const safe = Math.max(30, Number(seconds) || 300);
    state.roundTimers[roundKey] = safe;
    state.roundTimerEndsAt[roundKey] = Date.now() + safe * 1000;
    addLog(state, `ADMIN set ${roundKey} timer to ${safe}s`);
    return state;
  });
}

export function adminSetActiveRound(roundKey) {
  return updateState((state) => {
    state.activeRound = roundKey;
    state.roundTimerEndsAt[roundKey] = Date.now() + (state.roundTimers[roundKey] || 300) * 1000;
    addLog(state, `ADMIN switched active round to ${roundKey}`);
    return state;
  });
}

export function adminTriggerAuction() {
  return updateState((state) => {
    if (!Array.isArray(state.auction.deck) || state.auction.deck.length === 0) {
      state.auction.deck = shuffleCards(AUCTION_CARDS);
    }

    state.auction.active = true;
    state.auction.phase = 'bidding';
    state.auction.bids = {};
    state.auction.winnerTeam = null;
    state.auction.winningBid = 0;
    state.auction.drawnCard = null;
    state.auction.triggeredAt = Date.now();
    addLog(state, 'ADMIN triggered Auction Round');
    return state;
  });
}

export function placeAuctionBid(teamName, amount) {
  return updateState((state) => {
    if (!state.auction.active || state.auction.phase !== 'bidding') return state;

    upsertTeam(state, teamName);
    const team = state.teams[teamName];
    const bidValue = Math.floor(Number(amount) || 0);

    if (bidValue <= 0 || bidValue > team.points) return state;

    state.auction.bids[teamName] = bidValue;
    addLog(state, `${teamName} placed bid ${bidValue}`);
    return state;
  });
}

export function adminResolveAuction() {
  return updateState((state) => {
    if (!state.auction.active || state.auction.phase !== 'bidding') return state;

    const bidEntries = Object.entries(state.auction.bids)
      .map(([teamName, amount]) => [teamName, Math.floor(Number(amount) || 0)])
      .filter(([teamName, amount]) => {
        const team = state.teams[teamName];
        return team && amount > 0 && amount <= team.points;
      });

    if (bidEntries.length === 0) {
      state.auction.phase = 'reveal';
      state.auction.drawnCard = state.auction.deck.shift() || null;
      state.auction.winnerTeam = null;
      state.auction.winningBid = 0;
      addLog(state, 'Auction resolved with no valid bids');
      return state;
    }

    bidEntries.sort((a, b) => b[1] - a[1]);
    const [winnerTeam, winningBidRaw] = bidEntries[0];
    upsertTeam(state, winnerTeam);

    const winner = state.teams[winnerTeam];
    const winningBid = Math.min(winningBidRaw, winner.points);
    winner.points = Math.max(0, winner.points - winningBid);

    const drawnCard = state.auction.deck.shift() || null;
    if (drawnCard) {
      applyCardEffect(winner, drawnCard);
    }

    winner.updatedAt = Date.now();

    state.auction.phase = 'reveal';
    state.auction.winnerTeam = winnerTeam;
    state.auction.winningBid = winningBid;
    state.auction.drawnCard = drawnCard;
    addLog(state, `Auction won by ${winnerTeam} (deducted ${winningBid})`);
    return state;
  });
}

export function adminCloseAuction() {
  return updateState((state) => {
    state.auction.active = false;
    state.auction.phase = 'idle';
    state.auction.bids = {};
    state.auction.winnerTeam = null;
    state.auction.winningBid = 0;
    state.auction.drawnCard = null;
    addLog(state, 'ADMIN closed Auction Round');
    return state;
  });
}

export function unlockFinalRound(teamName, password) {
  return updateState((state) => {
    upsertTeam(state, teamName);
    if (password !== state.finalRound.entryPassword) return state;
    state.finalRound.unlockedTeams[teamName] = true;
    state.teams[teamName].status = 'FINAL_UNLOCKED';
    state.teams[teamName].updatedAt = Date.now();
    addLog(state, `${teamName} unlocked final round`);
    return state;
  });
}

export function chooseFinalPath(teamName, pathId) {
  return updateState((state) => {
    upsertTeam(state, teamName);
    if (!state.finalRound.unlockedTeams[teamName]) return state;

    state.finalRound.teamPath[teamName] = pathId;
    state.finalRound.teamPuzzleStep[teamName] = 0;
    state.teams[teamName].finalPath = pathId;
    state.teams[teamName].status = `FINAL_${pathId}`;
    state.teams[teamName].updatedAt = Date.now();
    addLog(state, `${teamName} selected final path ${pathId}`);
    return state;
  });
}

export function advanceFinalPath(teamName, totalSteps) {
  return updateState((state) => {
    upsertTeam(state, teamName);
    if (!state.finalRound.unlockedTeams[teamName]) return state;

    const current = state.finalRound.teamPuzzleStep[teamName] || 0;
    const next = Math.min(current + 1, totalSteps);
    state.finalRound.teamPuzzleStep[teamName] = next;

    if (next >= totalSteps) {
      if (!state.finalRound.winnerTeam) {
        state.finalRound.winnerTeam = teamName;
        state.teams[teamName].points += 300;
      }
      state.teams[teamName].finalCompletedAt = Date.now();
      state.teams[teamName].status = 'FINAL_COMPLETED';
      if (!state.teams[teamName].progressFlags.includes('FINAL_ROUND_COMPLETE')) {
        state.teams[teamName].progressFlags.push('FINAL_ROUND_COMPLETE');
      }
      addLog(state, `${teamName} completed final hybrid round`);
    }

    state.teams[teamName].updatedAt = Date.now();
    return state;
  });
}

export function setFinalPassword(password) {
  return updateState((state) => {
    const trimmed = String(password || '').trim();
    if (trimmed.length < 8) return state;
    state.finalRound.entryPassword = trimmed;
    addLog(state, 'ADMIN updated final round password');
    return state;
  });
}

export function computeLeaderboard(state) {
  return Object.values(state.teams)
    .map((team) => ({
      teamName: team.teamName,
      points: team.points,
      status: team.status,
      currentRound: team.currentRound,
      progressCount: team.progressFlags.length,
      finalPath: team.finalPath,
      updatedAt: team.updatedAt,
    }))
    .sort((a, b) => b.points - a.points || b.progressCount - a.progressCount || a.teamName.localeCompare(b.teamName));
}

export { STORAGE_KEY, ROUND_SCORE };

import React, { useEffect, useMemo, useState } from 'react';
import { useGameSystem } from '../hooks/useGameSystem';
import {
  adminPauseGameRuntime,
  adminCloseAuction,
  adminResolveAuction,
  submitAuctionTarget,
  adminResumeGameRuntime,
  adminStartAuction,
  adminDisplayCard,
  adminStartGameRuntime,
  adminSetGameActiveRound,
  adminSetGameRoundTimer,
  adminFetchWonCards,
  adminRevokeWonCard,
  fetchAdminTeams,
  fetchAuctionState,
  fetchGameRuntime,
  fetchLeaderboardVisibility,
  setLeaderboardVisibility,
  setPlayerEnabled,
  adminFreezeTeam,
  adminUnfreezeTeam,
  adminFreezeAllExcept,
  adminUnfreezeAll,
  adminUpdateTeamCoins,
} from '../lib/apiClient';
import { AUCTION_CARDS } from '../config/auctionCards';

const ROUND_OPTIONS = ['INTRO', 'ROUND_1', 'ROUND_2', 'ROUND_3', 'FINAL'];

function formatRemaining(endAt) {
  if (!endAt) return '--:--';
  const remaining = Math.max(0, endAt - Date.now());
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function AdminDashboard({ user, onLogout }) {
  const {
    state,
    adminStartGame,
    adminPauseGame,
    adminResumeGame,
    adminSetRoundTimer,
    adminSetActiveRound,
  } = useGameSystem(user?.teamName || 'ADMIN_TERMINAL');

  const [globalMinutes, setGlobalMinutes] = useState(90);
  const [roundKey, setRoundKey] = useState('ROUND_1');
  const [roundSeconds, setRoundSeconds] = useState(900);
  const [adminTeams, setAdminTeams] = useState([]);
  const [teamsError, setTeamsError] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);
  const [busyTeamId, setBusyTeamId] = useState('');
  const [leaderboardVisible, setLeaderboardVisibleState] = useState(false);
  const [leaderboardBusy, setLeaderboardBusy] = useState(false);
  const [auctionBusy, setAuctionBusy] = useState(false);
  const [auctionRuntime, setAuctionRuntime] = useState(null);
  const [auctionBids, setAuctionBids] = useState([]);
  const [auctionTargetTeams, setAuctionTargetTeams] = useState([]);
  const [gameRuntime, setGameRuntime] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [selectedCardId, setSelectedCardId] = useState(AUCTION_CARDS[0]?.id || '');
  const [resolveTeamId, setResolveTeamId] = useState('');
  const [targetApplyTeamId, setTargetApplyTeamId] = useState('');
  const [superCardsTeams, setSuperCardsTeams] = useState([]);
  const [superCardsBusy, setSuperCardsBusy] = useState(false);
  const [superCardsError, setSuperCardsError] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState('');
  const [freezeTeamId, setFreezeTeamId] = useState('');
  const [freezeSeconds, setFreezeSeconds] = useState(300);
  const [excludeTeamId, setExcludeTeamId] = useState('');
  const [mgmtBusy, setMgmtBusy] = useState(false);
  const [freezeActionStatus, setFreezeActionStatus] = useState({ type: '', message: '' });

  const nowClock = useMemo(
    () => new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
    [state.eventLog.length]
  );

  // Clear action message after 4 seconds
  useEffect(() => {
    if (!actionMessage) return;
    const t = setTimeout(() => setActionMessage(''), 4000);
    return () => clearTimeout(t);
  }, [actionMessage]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (!teamsError) return;
    const t = setTimeout(() => setTeamsError(''), 5000);
    return () => clearTimeout(t);
  }, [teamsError]);

  useEffect(() => {
    if (!freezeActionStatus.message) return;
    const t = setTimeout(() => setFreezeActionStatus({ type: '', message: '' }), 3500);
    return () => clearTimeout(t);
  }, [freezeActionStatus]);

  useEffect(() => {
    let mounted = true;

    const loadTeams = async () => {
      try {
        setTeamLoading(true);
        const result = await fetchAdminTeams();
        if (!mounted) return;
        const teams = Array.isArray(result?.teams)
          ? result.teams
          : Array.isArray(result)
            ? result
            : [];
        setAdminTeams(teams);
      } catch (error) {
        if (!mounted) return;
        setTeamsError(error.message || 'Unable to load players');
      } finally {
        if (mounted) setTeamLoading(false);
      }
    };

    const loadLeaderboardVisibility = async () => {
      try {
        const result = await fetchLeaderboardVisibility();
        if (!mounted) return;
        setLeaderboardVisibleState(Boolean(result.visible));
      } catch {
        if (!mounted) return;
        setLeaderboardVisibleState(false);
      }
    };

    const loadAuction = async () => {
      try {
        const result = await fetchAuctionState();
        if (!mounted) return;
        setAuctionRuntime(result?.runtime || null);
        setAuctionBids(result?.bids || []);
        setAuctionTargetTeams(result?.targetTeams || []);
      } catch {
        if (!mounted) return;
        setAuctionRuntime(null);
      }
    };

    const loadGameRuntime = async () => {
      try {
        const result = await fetchGameRuntime();
        if (!mounted) return;
        setGameRuntime(result?.runtime || null);
      } catch {
        if (!mounted) return;
        setGameRuntime(null);
      }
    };

    const loadSuperCards = async () => {
      try {
        const result = await adminFetchWonCards();
        if (!mounted) return;
        setSuperCardsTeams(Array.isArray(result?.teams) ? result.teams : []);
        setSuperCardsError('');
      } catch (err) {
        if (!mounted) return;
        setSuperCardsTeams([]);
        setSuperCardsError(err?.message || 'Unable to load super cards');
      }
    };

    loadTeams();
    loadLeaderboardVisibility();
    loadAuction();
    loadGameRuntime();
    loadSuperCards();
    const timer = setInterval(loadTeams, 1000);
    const visibilityTimer = setInterval(loadLeaderboardVisibility, 1000);
    const auctionTimer = setInterval(loadAuction, 2500);
    const gameTimer = setInterval(loadGameRuntime, 3000);
    const cardsTimer = setInterval(loadSuperCards, 5000);

    return () => {
      mounted = false;
      clearInterval(timer);
      clearInterval(visibilityTimer);
      clearInterval(auctionTimer);
      clearInterval(gameTimer);
      clearInterval(cardsTimer);
    };
  }, []);

  const handleTogglePlayer = async (teamId, enabled) => {
    try {
      setBusyTeamId(teamId);
      await setPlayerEnabled(teamId, enabled);
      const result = await fetchAdminTeams();
      const teams = Array.isArray(result?.teams)
        ? result.teams
        : Array.isArray(result)
          ? result
          : [];
      setAdminTeams(teams);
      setActionMessage(`PLAYER ${enabled ? 'ENABLED' : 'DISABLED'} SUCCESSFULLY`);
    } catch (error) {
      setTeamsError(error.message || 'Unable to update player status');
    } finally {
      setBusyTeamId('');
    }
  };

  const handleToggleLeaderboard = async () => {
    try {
      setLeaderboardBusy(true);
      const next = !leaderboardVisible;
      const result = await setLeaderboardVisibility(next);
      setLeaderboardVisibleState(Boolean(result.visible));
      setActionMessage(`LEADERBOARD ${Boolean(result.visible) ? 'VISIBLE' : 'HIDDEN'}`);
    } catch (error) {
      setTeamsError(error.message || 'Unable to update leaderboard visibility');
    } finally {
      setLeaderboardBusy(false);
    }
  };

  const refreshGameRuntime = async () => {
    const result = await fetchGameRuntime();
    setGameRuntime(result?.runtime || null);
  };

  const refreshAuction = async () => {
    const result = await fetchAuctionState();
    setAuctionRuntime(result?.runtime || null);
    setAuctionBids(result?.bids || []);
    setAuctionTargetTeams(result?.targetTeams || []);
  };

  const handleStartGame = async () => {
    try {
      setAuctionBusy(true);
      await adminStartGameRuntime(Number(globalMinutes));
      await refreshGameRuntime();
      setActionMessage('GAME STARTED');
    } catch (error) {
      setTeamsError(error.message || 'Unable to start game');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handlePauseGame = async () => {
    try {
      setAuctionBusy(true);
      await adminPauseGameRuntime();
      await refreshGameRuntime();
      setActionMessage('GAME PAUSED');
    } catch (error) {
      setTeamsError(error.message || 'Unable to pause game');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleResumeGame = async () => {
    try {
      setAuctionBusy(true);
      await adminResumeGameRuntime();
      await refreshGameRuntime();
      setActionMessage('GAME RESUMED');
    } catch (error) {
      setTeamsError(error.message || 'Unable to resume game');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleSetActiveRound = async (roundValue) => {
    try {
      setAuctionBusy(true);
      await adminSetGameActiveRound(roundValue);
      await refreshGameRuntime();
      setActionMessage(`ROUND SET TO ${roundValue}`);
    } catch (error) {
      setTeamsError(error.message || 'Unable to set active round');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleSetRoundTimer = async () => {
    try {
      setAuctionBusy(true);
      await adminSetGameRoundTimer(roundKey, Number(roundSeconds));
      await refreshGameRuntime();
      setActionMessage(`TIMER UPDATED FOR ${roundKey}`);
    } catch (error) {
      setTeamsError(error.message || 'Unable to set round timer');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleResolveAuction = async () => {
    if (!resolveTeamId) {
      setTeamsError('SELECT A TEAM to award the card before resolving');
      return;
    }
    try {
      setAuctionBusy(true);
      const result = await adminResolveAuction(resolveTeamId);
      await refreshAuction();
      const winnerName = result?.winner?.team_id || 'Unknown';
      setActionMessage(`CARD AWARDED TO ${winnerName}`);
      setResolveTeamId('');
    } catch (error) {
      setTeamsError(error.message || 'Unable to resolve auction');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleApplyTargetAsAdmin = async () => {
    if (!targetApplyTeamId) {
      setTeamsError('SELECT A TARGET TEAM before applying effect');
      return;
    }
    try {
      setAuctionBusy(true);
      await submitAuctionTarget(targetApplyTeamId);
      await refreshAuction();
      setActionMessage('TARGET EFFECT APPLIED BY ADMIN');
      setTargetApplyTeamId('');
    } catch (error) {
      setTeamsError(error.message || 'Unable to apply target effect');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleStartAuction = async () => {
    try {
      setAuctionBusy(true);
      await adminStartAuction();
      await refreshAuction();
      setActionMessage('AUCTION STARTED');
    } catch (error) {
      setTeamsError(error.message || 'Unable to start auction');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleDisplayCard = async () => {
    if (!selectedCardId) {
      setTeamsError('Please select a card first');
      return;
    }
    try {
      setAuctionBusy(true);
      await adminDisplayCard(selectedCardId);
      await refreshAuction();
      setActionMessage(`CARD DISPLAYED: ${AUCTION_CARDS.find(c => c.id === selectedCardId)?.name}`);
    } catch (error) {
      setTeamsError(error.message || 'Unable to display card');
    } finally {
      setAuctionBusy(false);
    }
  };

  const handleCloseAuction = async () => {
    try {
      setAuctionBusy(true);
      await adminCloseAuction();
      await refreshAuction();
      setActionMessage('AUCTION CLOSED');
    } catch (error) {
      setTeamsError(error.message || 'Unable to close auction');
    } finally {
      setAuctionBusy(false);
    }
  };

  // Non-admin teams only for resolve dropdown
  const nonAdminTeams = auctionTargetTeams.filter(t => !t.is_admin);

  const handleRevokeCard = async (wonCardId) => {
    try {
      setSuperCardsBusy(true);
      await adminRevokeWonCard(wonCardId);
      const result = await adminFetchWonCards();
      setSuperCardsTeams(Array.isArray(result?.teams) ? result.teams : []);
      setActionMessage('SUPER CARD REVOKED');
    } catch (err) {
      setSuperCardsError(err?.message || 'Unable to revoke super card');
    } finally {
      setSuperCardsBusy(false);
    }
  };

  const handleFreezeTeam = async () => {
    if (!freezeTeamId || !freezeSeconds) return;
    try {
      setMgmtBusy(true);
      await adminFreezeTeam(freezeTeamId, freezeSeconds);
      const result = await fetchAdminTeams();
      setAdminTeams(Array.isArray(result?.teams) ? result.teams : (Array.isArray(result) ? result : []));
      setActionMessage(`TEAM FROZEN FOR ${freezeSeconds}s`);
      setFreezeActionStatus({ type: 'success', message: `Freeze applied for ${freezeSeconds}s` });
    } catch (err) {
      setTeamsError(err.message || 'Unable to freeze team');
      setFreezeActionStatus({ type: 'error', message: err.message || 'Freeze failed' });
    } finally {
      setMgmtBusy(false);
    }
  };

  const handleUnfreezeTeam = async (teamId) => {
    try {
      setMgmtBusy(true);
      await adminUnfreezeTeam(teamId);
      const result = await fetchAdminTeams();
      setAdminTeams(Array.isArray(result?.teams) ? result.teams : (Array.isArray(result) ? result : []));
      setActionMessage('TEAM UNFROZEN');
      setFreezeActionStatus({ type: 'success', message: 'Team unfreezed successfully' });
    } catch (err) {
      setTeamsError(err.message || 'Unable to unfreeze team');
      setFreezeActionStatus({ type: 'error', message: err.message || 'Revoke failed' });
    } finally {
      setMgmtBusy(false);
    }
  };

  const handleFreezeAllExcept = async () => {
    if (!freezeSeconds) return;
    try {
      setMgmtBusy(true);
      await adminFreezeAllExcept(excludeTeamId, freezeSeconds);
      const result = await fetchAdminTeams();
      setAdminTeams(Array.isArray(result?.teams) ? result.teams : (Array.isArray(result) ? result : []));
      setActionMessage('MASS FREEZE APPLIED');
      setFreezeActionStatus({ type: 'success', message: `Freeze all applied for ${freezeSeconds}s` });
    } catch (err) {
      setTeamsError(err.message || 'Unable to mass freeze');
      setFreezeActionStatus({ type: 'error', message: err.message || 'Mass freeze failed' });
    } finally {
      setMgmtBusy(false);
    }
  };

  const handleUnfreezeAll = async () => {
    try {
      setMgmtBusy(true);
      await adminUnfreezeAll();
      const result = await fetchAdminTeams();
      setAdminTeams(Array.isArray(result?.teams) ? result.teams : (Array.isArray(result) ? result : []));
      setActionMessage('ALL TEAMS UNFROZEN');
      setFreezeActionStatus({ type: 'success', message: 'All teams unfreezed successfully' });
    } catch (err) {
      setTeamsError(err.message || 'Unable to unfreeze all');
      setFreezeActionStatus({ type: 'error', message: err.message || 'Unfreeze all failed' });
    } finally {
      setMgmtBusy(false);
    }
  };

  const handleSetCoins = async (teamId, coins) => {
    try {
      setBusyTeamId(teamId);
      await adminUpdateTeamCoins(teamId, coins);
      const result = await fetchAdminTeams();
      setAdminTeams(Array.isArray(result?.teams) ? result.teams : (Array.isArray(result) ? result : []));
      setActionMessage('COINS UPDATED');
    } catch (err) {
      setTeamsError(err.message);
    } finally {
      setBusyTeamId('');
    }
  };

  return (
    <div className="h-screen overflow-y-auto bg-slate-950 text-emerald-300 font-mono p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-emerald-500/20 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-[0.18em] text-emerald-400">ADMIN COMMAND CENTER</h1>
            <p className="text-xs text-emerald-600 tracking-[0.2em] mt-1">REAL-TIME CONTROL // OPERATION RED TROPHY</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-white/50">IST {nowClock}</span>
            <span className="text-emerald-300">ADMIN: {user?.teamName || 'ADMIN'}</span>
            <button
              onClick={onLogout}
              className="rounded border border-red-500/40 px-3 py-1 text-red-400 hover:bg-red-500/10"
            >
              LOGOUT
            </button>
          </div>
        </header>

        {/* Status messages */}
        {actionMessage && (
          <div className="rounded border border-emerald-500/30 bg-emerald-900/20 px-4 py-2 text-xs text-emerald-300 animate-pulse">
            ✓ {actionMessage}
          </div>
        )}
        {teamsError && (
          <div className="rounded border border-red-500/30 bg-red-900/20 px-4 py-2 text-xs text-red-300">
            ✕ {teamsError}
          </div>
        )}

        {/* GLOBAL CONTROLS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-white/15 bg-black/40 p-4 space-y-3">
            <h2 className="text-sm text-white tracking-[0.2em]">GAME CONTROL</h2>
            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <label className="text-[11px] tracking-[0.12em] text-white/60">GLOBAL COUNTDOWN (MINUTES)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  value={globalMinutes}
                  onChange={(e) => setGlobalMinutes(e.target.value)}
                  className="rounded bg-black/60 border border-white/10 px-3 py-2 text-sm flex-1"
                />
                <button onClick={handleStartGame} className="px-3 py-2 rounded border border-emerald-500/40 text-xs hover:bg-emerald-500/20">START</button>
                <button onClick={handlePauseGame} className="px-3 py-2 rounded border border-yellow-500/40 text-xs hover:bg-yellow-500/20">PAUSE</button>
                <button onClick={handleResumeGame} className="px-3 py-2 rounded border border-cyan-500/40 text-xs hover:bg-cyan-500/20">RESUME</button>
              </div>
            </div>

            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <label className="text-[11px] tracking-[0.12em] text-white/60">PER-ROUND TIMER (SECONDS)</label>
              <div className="flex flex-col md:flex-row gap-2">
                <select
                  value={roundKey}
                  onChange={(e) => setRoundKey(e.target.value)}
                  className="rounded bg-black/60 border border-white/10 px-3 py-2 text-sm"
                >
                  {ROUND_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="30"
                  value={roundSeconds}
                  onChange={(e) => setRoundSeconds(e.target.value)}
                  className="rounded bg-black/60 border border-white/10 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleSetRoundTimer}
                  className="px-3 py-2 rounded border border-cyan-500/40 text-xs"
                >
                  SET TIMER
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-4 space-y-2">
            <h2 className="text-sm text-emerald-400 tracking-[0.2em]">LIVE STATUS</h2>
            <p className="text-xs">STATE: <span className="text-white">{gameRuntime?.status || state.status}</span></p>
            <p className="text-xs">ROUND: <span className="text-white">{gameRuntime?.active_round || state.activeRound}</span></p>
            <p className="text-xs">GLOBAL LEFT: <span className="text-yellow-300">{formatRemaining(gameRuntime?.global_countdown_ends_at || state.globalCountdownEndsAt)}</span></p>
            <p className="text-xs">ROUND LEFT: <span className="text-cyan-300">{formatRemaining(gameRuntime?.round_timer_ends_at?.[gameRuntime?.active_round || state.activeRound] || state.roundTimerEndsAt[state.activeRound])}</span></p>
            <p className="text-xs">AUCTION: <span className="text-white">{auctionRuntime?.active ? (auctionRuntime.phase || 'ACTIVE').toUpperCase() : 'INACTIVE'}</span></p>
            <p className="text-xs">LEADERBOARD: <span className={leaderboardVisible ? 'text-green-300' : 'text-red-300'}>{leaderboardVisible ? 'VISIBLE' : 'HIDDEN'}</span></p>
            <p className="text-xs">FINAL WINNER: <span className="text-green-300">{state.finalRound.winnerTeam || 'TBD'}</span></p>
            <button
              onClick={handleToggleLeaderboard}
              disabled={leaderboardBusy}
              className="mt-2 w-full rounded border border-emerald-500/40 bg-emerald-900/20 px-3 py-2 text-xs hover:bg-emerald-500/20 disabled:opacity-60"
            >
              {leaderboardBusy
                ? 'UPDATING...'
                : leaderboardVisible
                  ? 'HIDE LEADERBOARD'
                  : 'SHOW LEADERBOARD'}
            </button>
          </div>
        </section>

        {/* AUCTION + ROUND CONTROLS */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* LIVE AUCTION CONTROL */}
          <div className="xl:col-span-2 rounded-xl border border-red-500/20 bg-black/40 p-4 space-y-3">
            <h2 className="text-sm text-red-300 tracking-[0.2em]">LIVE AUCTION CONTROL</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* LEFT: Controls */}
              <div className="space-y-3">
                {/* Start Auction */}
                <button
                  disabled={auctionBusy}
                  onClick={handleStartAuction}
                  className="w-full rounded border border-red-500/40 bg-red-900/20 py-2 px-3 text-xs font-bold uppercase hover:bg-red-500/15 disabled:opacity-60"
                >
                  ▶ START AUCTION
                </button>

                {/* Display Card */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">SELECT CARD:</label>
                  <select
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="w-full rounded bg-black/60 border border-yellow-500/40 px-3 py-2 text-xs text-white"
                  >
                    {AUCTION_CARDS.map(card => (
                      <option key={card.id} value={card.id}>
                        {card.name} (Min: {card.min_value})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={auctionBusy}
                    onClick={handleDisplayCard}
                    className="w-full rounded border border-yellow-500/40 bg-yellow-900/20 py-2 px-3 text-xs font-bold uppercase hover:bg-yellow-500/15 disabled:opacity-60"
                  >
                    🎴 DISPLAY CARD
                  </button>
                </div>

                {/* Resolve - Team selection */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">AWARD CARD TO TEAM:</label>
                  <select
                    value={resolveTeamId}
                    onChange={(e) => setResolveTeamId(e.target.value)}
                    className="w-full rounded bg-black/60 border border-cyan-500/40 px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- SELECT TEAM --</option>
                    {nonAdminTeams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.team_id} (PTS: {team.points})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={auctionBusy || !resolveTeamId}
                    onClick={handleResolveAuction}
                    className="w-full rounded border border-cyan-500/40 bg-cyan-900/20 py-2 px-3 text-xs font-bold uppercase hover:bg-cyan-500/15 disabled:opacity-60"
                  >
                    ✓ RESOLVE — AWARD CARD TO TEAM
                  </button>
                </div>

                {auctionRuntime?.phase === 'targeting' && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">APPLY CARD EFFECT TO TARGET:</label>
                    <select
                      value={targetApplyTeamId}
                      onChange={(e) => setTargetApplyTeamId(e.target.value)}
                      className="w-full rounded bg-black/60 border border-purple-500/40 px-3 py-2 text-xs text-white"
                    >
                      <option value="">-- SELECT TARGET TEAM --</option>
                      {nonAdminTeams
                        .filter((team) => team.id !== auctionRuntime?.winner_team_id)
                        .map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.team_id} (PTS: {team.points})
                          </option>
                        ))}
                    </select>
                    <button
                      disabled={auctionBusy || !targetApplyTeamId}
                      onClick={handleApplyTargetAsAdmin}
                      className="w-full rounded border border-purple-500/40 bg-purple-900/20 py-2 px-3 text-xs font-bold uppercase hover:bg-purple-500/15 disabled:opacity-60"
                    >
                      🎯 APPLY TARGET EFFECT (ADMIN)
                    </button>
                  </div>
                )}

                {/* Close Auction */}
                <button
                  disabled={auctionBusy}
                  onClick={handleCloseAuction}
                  className="w-full rounded border border-white/20 bg-white/5 py-2 px-3 text-xs font-bold uppercase hover:bg-white/10 disabled:opacity-60"
                >
                  ✕ CLOSE AUCTION
                </button>
              </div>

              {/* RIGHT: Status + Live Bids */}
              <div className="space-y-3">
                {/* Auction Status */}
                <div className="text-xs text-white/70 border border-white/10 rounded p-3 bg-black/60 space-y-1">
                  <p><span className="text-emerald-300">Phase:</span> {auctionRuntime?.phase?.toUpperCase() || 'IDLE'}</p>
                  <p><span className="text-yellow-300">Card:</span> {auctionRuntime?.drawn_card?.name || 'YET TO DISPLAY'}</p>
                  <p><span className="text-cyan-300">Min Bid:</span> {auctionRuntime?.drawn_card?.min_value || 0}</p>
                  <p><span className="text-emerald-300">Winner:</span> {auctionRuntime?.winner_team_id || 'PENDING'}</p>
                  <p><span className="text-purple-300">Winning Bid:</span> {auctionRuntime?.winning_bid || 0}</p>
                </div>

                {/* LIVE BIDS */}
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <h4 className="text-xs font-bold text-cyan-300 tracking-[0.1em] mb-2">LIVE BIDS</h4>
                  {auctionBids.length === 0 ? (
                    <p className="text-[10px] text-white/40 font-mono">No bids placed yet.</p>
                  ) : (
                    <div className="space-y-1 font-mono text-[10px] max-h-48 overflow-y-auto pr-1">
                      {auctionBids.map((bid, idx) => (
                        <div key={bid.team_id} className="flex justify-between items-center bg-black/40 px-2 py-1.5 rounded">
                          <span className="text-white/80">{bid.team_code}</span>
                          <span className={idx === 0 ? 'text-emerald-400 font-bold' : 'text-cyan-400'}>
                            {bid.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ROUND TRANSITION CONTROL */}
          <div className="rounded-xl border border-cyan-500/20 bg-black/40 p-4 space-y-3">
            <h2 className="text-sm text-cyan-300 tracking-[0.2em]">ROUND TRANSITION CONTROL</h2>
            <div className="grid grid-cols-2 gap-2">
              {ROUND_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => handleSetActiveRound(option)}
                  className="rounded border border-cyan-500/35 py-2 text-[10px] hover:bg-cyan-500/15"
                >
                  SET {option}
                </button>
              ))}
            </div>
          </div>

          {/* TEAM MGMT: FREEZE/UNFREEZE */}
          <div className="rounded-xl border border-yellow-500/20 bg-black/40 p-4 space-y-3">
            <h2 className="text-sm text-yellow-400 tracking-[0.2em]">TEAM FREEZE CONTROL</h2>
            {freezeActionStatus.message && (
              <div
                className={`rounded border px-3 py-2 text-[10px] uppercase tracking-[0.12em] ${
                  freezeActionStatus.type === 'success'
                    ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300'
                    : 'border-red-500/40 bg-red-900/20 text-red-300'
                }`}
              >
                {freezeActionStatus.message}
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">SELECT TEAM:</label>
                <select
                  value={freezeTeamId}
                  onChange={(e) => setFreezeTeamId(e.target.value)}
                  className="w-full rounded bg-black/60 border border-yellow-500/40 px-3 py-2 text-xs text-white"
                >
                  <option value="">-- SELECT TEAM --</option>
                  {adminTeams.filter(t => !t.is_admin).map(team => (
                    <option key={team.id} value={team.id}>{team.team_id}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">DURATION (SECONDS):</label>
                <input
                  type="number"
                  value={freezeSeconds}
                  onChange={(e) => setFreezeSeconds(e.target.value)}
                  className="w-full rounded bg-black/60 border border-white/10 px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={mgmtBusy || !freezeTeamId}
                  onClick={handleFreezeTeam}
                  type="button"
                  className="flex-1 rounded border border-red-500/40 bg-red-900/20 py-2 text-[10px] font-bold uppercase hover:bg-red-500/15 disabled:opacity-60"
                >
                  ❄️ FREEZE
                </button>
                <button
                  disabled={mgmtBusy || !freezeTeamId}
                  onClick={() => handleUnfreezeTeam(freezeTeamId)}
                  type="button"
                  className="flex-1 rounded border border-green-500/40 bg-green-900/20 py-2 text-[10px] font-bold uppercase hover:bg-green-500/15 disabled:opacity-60"
                >
                  🔥 REVOKE
                </button>
              </div>

              <div className="pt-2 border-t border-white/10 space-y-3">
                <h3 className="text-[10px] text-white/40 uppercase tracking-[0.2em] text-center">Mass Actions</h3>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 uppercase tracking-[0.1em]">EXCLUDE TEAM (OPTIONAL):</label>
                  <select
                    value={excludeTeamId}
                    onChange={(e) => setExcludeTeamId(e.target.value)}
                    className="w-full rounded bg-black/60 border border-white/10 px-3 py-2 text-xs text-white"
                  >
                    <option value="">-- NONE --</option>
                    {adminTeams.filter(t => !t.is_admin).map(team => (
                      <option key={team.id} value={team.id}>{team.team_id}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={mgmtBusy}
                    onClick={handleFreezeAllExcept}
                    type="button"
                    className="flex-1 rounded border border-red-500/60 bg-red-900/40 py-2 text-[10px] font-bold uppercase hover:bg-red-500/20 disabled:opacity-60"
                  >
                    ❄️ FREEZE ALL
                  </button>
                  <button
                    disabled={mgmtBusy}
                    onClick={handleUnfreezeAll}
                    type="button"
                    className="flex-1 rounded border border-green-500/60 bg-green-900/40 py-2 text-[10px] font-bold uppercase hover:bg-green-500/20 disabled:opacity-60"
                  >
                    🔥 UNFREEZE ALL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* LEADERBOARD / TEAMS TABLE */}
        <section className="rounded-xl border border-white/15 bg-black/40 p-4">
          <h2 className="text-sm text-white tracking-[0.2em] mb-3">LEADERBOARD / TEAMS</h2>
          <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-900/5 p-3">
            <h3 className="text-xs text-emerald-300 tracking-[0.16em] mb-2">TEAM PRESENCE STATUS</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-white/45 border-b border-white/10">
                    <th className="text-left py-2">TEAM</th>
                    <th className="text-left py-2">STATUS</th>
                    <th className="text-left py-2">LAST SEEN</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTeams.map((team) => (
                    <tr key={`presence-${team.id}`} className="border-b border-white/5">
                      <td className="py-2 text-white/80">{team.team_id}</td>
                      <td className="py-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] border ${
                            team.online
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                          }`}
                        >
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-current" />
                          {team.online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>
                      <td className="py-2 text-white/60">
                        {team.last_seen_at ? new Date(team.last_seen_at).toLocaleString() : '--'}
                      </td>
                    </tr>
                  ))}
                  {!teamLoading && adminTeams.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 text-white/40">No teams found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/45 border-b border-white/10">
                  <th className="text-left py-2">PLAYER ID</th>
                  <th className="text-left py-2">TEAM NAME</th>
                  <th className="text-left py-2">PROGRESS %</th>
                  <th className="text-left py-2 text-yellow-300">COINS</th>
                  <th className="text-left py-2">CURRENT ROUND</th>
                  <th className="text-left py-2">ENABLED</th>
                </tr>
              </thead>
              <tbody>
                {adminTeams.map((team) => {
                  const gs = team.game_state?.[0] || {};
                  const progressPct = Number(team.progress_percent ?? (
                    (gs.round_1_complete ? 25 : 0) +
                    (gs.round_2_complete ? 25 : 0) +
                    (gs.round_3_complete ? 25 : 0) +
                    (gs.final_complete ? 25 : 0)
                  ));
                  return (
                  <tr key={team.id} className={`border-b border-white/5 hover:bg-white/5 ${team.is_frozen ? 'bg-blue-900/10' : ''}`}>
                    <td className="py-2 text-white/75">{team.id.slice(0, 8)}</td>
                    <td className="py-2 text-emerald-300">
                      <div className="flex items-center gap-2">
                        {team.team_id}
                        {team.is_frozen && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[8px] font-black uppercase border border-blue-500/30 animate-pulse">
                            ❄️ FROZEN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/60">{progressPct}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-yellow-300 font-bold">
                      <input
                        type="number"
                        value={team.coins || 0}
                        onChange={(e) => handleSetCoins(team.id, e.target.value)}
                        className="w-20 rounded bg-black/40 border border-yellow-500/20 px-2 py-0.5 text-[11px] text-yellow-300 outline-none focus:border-yellow-500"
                      />
                    </td>
                    <td className="py-2 text-white/75">{team.current_round}</td>
                    <td className="py-2 text-yellow-300">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={Boolean(team.enabled)}
                          disabled={busyTeamId === team.id}
                          onChange={(e) => handleTogglePlayer(team.id, e.target.checked)}
                        />
                        <span>{team.enabled ? 'YES' : 'NO'}</span>
                      </label>
                    </td>
                  </tr>
                  );
                })}
                {!teamLoading && adminTeams.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-white/50">No players found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SUPER CARDS MANAGEMENT */}
        <section className="rounded-xl border border-purple-500/20 bg-black/40 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm text-purple-300 tracking-[0.2em]">SUPER CARDS MANAGEMENT</h2>
              <p className="text-[10px] text-white/50 tracking-[0.16em] uppercase">View & revoke won cards</p>
            </div>
            <div className="text-[10px] text-white/60">
              Teams: <span className="text-purple-200 font-bold">{superCardsTeams.length}</span>
            </div>
          </div>

          {superCardsError && (
            <div className="rounded border border-rose-500/25 bg-rose-900/10 px-3 py-2 text-[10px] text-rose-300 mb-3">
              ✕ {superCardsError}
            </div>
          )}

          {superCardsTeams.length === 0 ? (
            <p className="text-xs text-white/50">No super cards have been won yet.</p>
          ) : (
            <div className="space-y-2">
              {superCardsTeams.map((team) => (
                <div key={team.team_id} className="rounded-lg border border-purple-500/15 bg-purple-900/10">
                  <button
                    type="button"
                    onClick={() => setExpandedTeamId(expandedTeamId === team.team_id ? '' : team.team_id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                  >
                    <span className="text-xs text-purple-200 font-bold tracking-[0.12em]">
                      {team.team_code}
                    </span>
                    <span className="text-[10px] text-white/60">
                      Cards: <span className="text-purple-200 font-bold">{team.cards?.length || 0}</span>
                      <span className="ml-3 text-white/40">{expandedTeamId === team.team_id ? '▲' : '▼'}</span>
                    </span>
                  </button>

                  {expandedTeamId === team.team_id && (
                    <div className="px-3 pb-3">
                      <div className="flex gap-3 overflow-x-auto pb-2">
                        {(team.cards || []).map((card) => (
                          <div
                            key={card.id}
                            className="min-w-[260px] max-w-[260px] shrink-0 rounded-xl border border-purple-500/20 bg-black/35 p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-purple-200 truncate">{card.card_name}</p>
                                <p className="text-[10px] text-white/60 truncate">
                                  {card.card_data?.effect_type?.replace(/_/g, ' ') || 'unknown'}
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={superCardsBusy}
                                onClick={() => handleRevokeCard(card.id)}
                                className="shrink-0 rounded border border-rose-500/35 bg-rose-900/15 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-rose-300 hover:bg-rose-500/15 disabled:opacity-60"
                              >
                                Revoke
                              </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                              <span className="rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-yellow-200">
                                MIN: {card.card_data?.min_value ?? 0}
                              </span>
                              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-white/70">
                                {String(card.card_data?.type || 'neutral').toUpperCase()}
                              </span>
                            </div>
                            <p className="mt-2 text-[10px] text-white/40">
                              Won {new Date(card.won_at).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* EVENT LOG */}
        <section className="rounded-xl border border-white/15 bg-black/40 p-4">
          <h2 className="text-sm text-white tracking-[0.2em] mb-3">EVENT LOG</h2>
          <div className="max-h-56 overflow-y-auto text-xs space-y-1">
            {[...state.eventLog].reverse().map((entry) => (
              <div key={`${entry.at}-${entry.text}`} className="text-white/70 font-mono">
                [{new Date(entry.at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}] {entry.text}
              </div>
            ))}
            {state.eventLog.length === 0 && <p className="text-white/40">No events yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

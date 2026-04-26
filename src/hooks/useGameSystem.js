import { useEffect, useMemo, useState } from 'react';
import { socket } from '../socket';
import { fetchTeamRuntimeStatus } from '../lib/apiClient';
import {
  adminCloseAuction,
  adminPauseGame,
  adminResolveAuction,
  adminResumeGame,
  adminSetActiveRound,
  adminSetRoundTimer,
  adminStartGame,
  adminTriggerAuction,
  advanceFinalPath,
  chooseFinalPath,
  computeLeaderboard,
  ensureTeam,
  loadGameSystemState,
  placeAuctionBid,
  setFinalPassword,
  setTeamStatus,
  subscribeGameSystem,
  unlockFinalRound,
  updateTeamFlag,
} from '../utils/gameSystemState';

export function useGameSystem(teamName) {
  const [state, setState] = useState(() => loadGameSystemState());
  const [freezeState, setFreezeState] = useState({ frozenTeams: [], freezeAllExcept: null, expiryTimes: {} });
  const [cooldown, setCooldown] = useState(0);
  const [isFrozenNow, setIsFrozenNow] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeGameSystem((next) => setState(next));
    setState(loadGameSystemState());

    const onFreeze = (data) => {
      console.log('[GAME SYSTEM] Freeze Update:', data);
      setFreezeState(data);
    };

    const onCooldown = (data) => {
      console.log('[GAME SYSTEM] Cooldown Update:', data);
      // We only care about cooldowns for OUR team
      // Note: teamName might be the ID or Name depending on context, we check both
      if (data.teamId === teamName) {
        setCooldown(data.seconds);
      }
    };

    socket.on('freeze_update', onFreeze);
    socket.on('cooldown_update', onCooldown);
    
    return () => {
      unsubscribe();
      socket.off('freeze_update', onFreeze);
      socket.off('cooldown_update', onCooldown);
    };
  }, [teamName]);

  useEffect(() => {
    if (teamName) {
      ensureTeam(teamName);
      setState(loadGameSystemState());
    }
  }, [teamName]);

  const leaderboard = useMemo(() => computeLeaderboard(state), [state]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  useEffect(() => {
    let stopped = false;
    const isAdminCtx = !teamName || teamName === 'ADMIN_TERMINAL';
    if (isAdminCtx) return;

    const syncRuntime = async () => {
      if (stopped) return;
      try {
        const data = await fetchTeamRuntimeStatus();
        if (stopped) return;
        setIsFrozenNow(Boolean(data?.isFrozen));
        const nextCd = Number(data?.cooldownSeconds || 0);
        // keep the larger value so we don't flicker backwards
        setCooldown((prev) => Math.max(prev, nextCd));
      } catch {
        // ignore poll errors; socket/local state still active
      }
    };

    syncRuntime();
    const t = setInterval(syncRuntime, 2000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [teamName]);

  return {
    state,
    leaderboard,
    freezeState,
    cooldown,
    setCooldown, // Expose for local updates
    isFrozen: (() => {
      if (!teamName || teamName === 'ADMIN_TERMINAL') return false;
      if (isFrozenNow) return true;
      // Get the DB team object if needed, but here we usually have teamName as the ID or name
      // If freezeAllExcept is active, everyone except that team is frozen
      if (freezeState.freezeAllExcept && freezeState.freezeAllExcept !== teamName) return true;
      // Otherwise check if this team is in the frozen list
      return (freezeState?.frozenTeams || []).includes(teamName);
    })(),
    ensureTeam,
    updateTeamFlag,
    setTeamStatus,
    adminStartGame,
    adminPauseGame,
    adminResumeGame,
    adminSetRoundTimer,
    adminSetActiveRound,
    adminTriggerAuction,
    adminResolveAuction,
    adminCloseAuction,
    placeAuctionBid,
    unlockFinalRound,
    chooseFinalPath,
    advanceFinalPath,
    setFinalPassword,
  };
}

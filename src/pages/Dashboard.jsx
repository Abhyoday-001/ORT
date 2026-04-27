import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationProvider } from '../context/SimulationContext';
import RedTrophyGame from '../components/RedTrophyGame';
import TrophyBackground from '../components/TrophyBackground';
import Navbar from '../components/Navbar';
import FrozenOverlay from '../components/FrozenOverlay';
import { socket } from '../socket';
import { useGameSystem } from '../hooks/useGameSystem';
import { fetchLeaderboard, fetchLeaderboardVisibility, fetchSession, logout, presencePing } from '../lib/apiClient';
import { useSimulation } from '../context/SimulationContext';

function ProgressSyncer({ progress }) {
  const { syncProgress } = useSimulation();
  useEffect(() => {
    if (progress) syncProgress(progress);
  }, [progress, syncProgress]);
  return null;
}

const formatTimer = (endAt) => {
  if (!endAt) return '--:--';
  const remaining = Math.max(0, endAt - Date.now());
  const mm = Math.floor(remaining / 60000).toString().padStart(2, '0');
  const ss = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [loggedInUser, setLoggedInUser] = useState(() => {
    try {
      const cached = sessionStorage.getItem('matrix_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [gameState, setGameState] = useState({ status: 'LIVE', activeStartTime: Date.now() });
  const [nowIST, setNowIST] = useState(new Date());
  const [gameTimer, setGameTimer] = useState('00:00:00');
  const [remoteLeaderboard, setRemoteLeaderboard] = useState([]);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [serverProgress, setServerProgress] = useState(null);
  const { 
    state: gameSystemState, 
    ensureTeam, 
    isFrozen: isFrozenRealtime,
    freezeState 
  } = useGameSystem(loggedInUser?.team_id || loggedInUser?.teamName);

  useEffect(() => {
    let mounted = true;

    const syncSession = async () => {
      try {
        const response = await fetchSession();
        if (!mounted) return;

        const sessionUser = response?.user || null;
        if (!sessionUser) throw new Error('Invalid session');

        if (sessionUser.role === 'admin') {
          navigate('/admin', { replace: true });
          return;
        }

        if (response?.progress) {
          setServerProgress(response.progress);
        }

        setLoggedInUser(sessionUser);
        sessionStorage.setItem('matrix_user', JSON.stringify(sessionUser));
        sessionStorage.setItem('isAuthenticated', 'true');
        setSessionReady(true);
      } catch {
        if (!mounted) return;
        sessionStorage.removeItem('isAuthenticated');
        sessionStorage.removeItem('matrix_user');
        sessionStorage.removeItem('matrix_token');
        navigate('/login', { replace: true });
      }
    };

    syncSession();
    const sessionTimer = setInterval(syncSession, 5000); // Poll every 5s for freeze status
    return () => {
      mounted = false;
      clearInterval(sessionTimer);
    };
  }, [navigate]);

  useEffect(() => {
    if (!loggedInUser?.id) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      try {
        await presencePing();
      } catch {
        // ignore
      }
    };

    tick();
    const t = setInterval(tick, 10000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [loggedInUser?.id]);

  useEffect(() => {
    if (loggedInUser?.teamName) {
      ensureTeam(loggedInUser.teamName);
    }
  }, [loggedInUser?.teamName, ensureTeam]);

  useEffect(() => {
    socket.on('gameState', (state) => {
      setGameState(state);
    });
    return () => {
      socket.off('gameState');
    };
  }, []);

  // Leaderboard data is handled by the Leaderboard component itself.

  useEffect(() => {
    const timer = setInterval(() => {
      setNowIST(new Date());
      if (gameState.status === 'LIVE' && gameState.activeStartTime) {
        const diff = Date.now() - gameState.activeStartTime;
        const hh = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const mm = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const ss = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        setGameTimer(`${hh}:${mm}:${ss}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  const handleLogout = () => {
    try {
      logout();
    } catch {
      // ignore
    }
    sessionStorage.removeItem('isAuthenticated');
    sessionStorage.removeItem('matrix_user');
    sessionStorage.removeItem('matrix_token');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative min-h-screen font-mono bg-black overflow-hidden">
      {!sessionReady && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 text-cyan-300 font-mono tracking-[0.2em] text-sm">
          VALIDATING SESSION...
        </div>
      )}


      <TrophyBackground className="absolute inset-0 opacity-22 pointer-events-none" />

      <SimulationProvider initialUser={loggedInUser} isFrozen={isFrozenRealtime}>
        <Navbar codename={loggedInUser?.teamName} onLogout={handleLogout} />

        <div className="px-4 pt-2 text-[10px] uppercase tracking-[0.18em] font-mono flex flex-wrap gap-5 text-white/60 border-b border-white/10 bg-black/35 backdrop-blur-sm">
          <div>Global: <span className="text-cyan-300">{formatTimer(gameSystemState.globalCountdownEndsAt)}</span></div>
          <div>Round: <span className="text-yellow-300">{gameSystemState.activeRound}</span></div>
          <div>Round Timer: <span className="text-emerald-300">{formatTimer(gameSystemState.roundTimerEndsAt[gameSystemState.activeRound])}</span></div>
          <div>Status: <span className={gameSystemState.status === 'LIVE' ? 'text-green-400' : 'text-red-400'}>{gameSystemState.status}</span></div>
        </div>

        {sessionReady && (
          <div className="pt-16">
            <ProgressSyncer progress={serverProgress} />
            <FrozenOverlay 
              isVisible={isFrozenRealtime} 
              expiryTime={freezeState.expiryTimes[loggedInUser?.id] || freezeState.expiryTimes[loggedInUser?.team_id]} 
            />
            
            <div className="relative z-10 min-h-screen flex flex-col">
              <RedTrophyGame />
            </div>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/70 backdrop-blur-sm border-t border-rcb-gold/20 px-4 py-2 flex justify-center gap-12 text-sm tracking-[0.16em] text-white/60 uppercase">
          <div className="flex gap-2 items-center">
            <span>IST:</span>
            <span className="text-white text-base font-semibold">{nowIST.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span>GAME:</span>
            <span className={`text-lg font-bold ${gameState.status === 'LIVE' ? 'text-rcb-gold animate-pulse' : 'text-white'}`}>{gameTimer}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span>ROOM:</span>
            <span className="text-rcb-red text-base font-semibold">
              {loggedInUser?.teamName || loggedInUser?.team_id || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </SimulationProvider>
    </div>
  );
}

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { socket, API_URL, FRONTEND_ONLY } from '../socket';

const SimulationContext = createContext(null);

export function SimulationProvider({ children, initialUser, isFrozen }) {
  // ── State ──
  const [currentView, setCurrentView] = useState('simulation');
  const [isAuthenticated, setAuthenticated] = useState(!!initialUser);
  const [currentUser, setCurrentUser] = useState(initialUser || null);
  const [otherPlayers, setOtherPlayers] = useState({});
  const [multiplayerConnected, setMultiplayerConnected] = useState(false);
  const [gameState, setGameState] = useState({ status: 'LIVE' });
  const [missionBriefing, setMissionBriefing] = useState(null);
  const missionDismissRef = React.useRef(null);
  const [quality, setQuality] = useState('high');
  const [notification, setNotification] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0, z: 0 });
  const [tooltip, setTooltip] = useState(null);

  // ── Refs ──
  const otherPlayersRef = React.useRef({});

  /* --- SIMPLIFIED CONTEXT FOR OPERATION RED TROPHY --- */
  const sendPosition = useCallback(() => {}, []);

  useEffect(() => {
    if (!currentUser) return;
    if (FRONTEND_ONLY) return;

    socket.on('connect', () => {
      setMultiplayerConnected(true);
      socket.emit('player:join', currentUser);
    });

    socket.on('disconnect', () => setMultiplayerConnected(false));

    // Maps server-side progress keys back to the roomUnlocked flags the checklist reads
    const PROGRESS_TO_ROOM_UNLOCKED = {
      'PC_DOOR': 'pcRoom',
      'SERVER_DOOR': 'serverRoom',
      'SECURITY_DOOR': 'securityRoom',
    };

    socket.on('player:progress', (data) => {
      if (!data) return;
      if (data.levelId) {
        setLevelCompleted(prev => ({ ...prev, [data.levelId]: true }));
      }
      if (data.roomKey) {
        if (PROGRESS_TO_ROOM_UNLOCKED[data.roomKey]) {
          setRoomUnlocked(prev => ({ ...prev, [PROGRESS_TO_ROOM_UNLOCKED[data.roomKey]]: true }));
        }
        if (data.roomKey === 'HUB_PIN') setNetworkHubStarted(true);
        if (data.roomKey.startsWith('PATHWAY_')) {
          const index = parseInt(data.roomKey.split('_')[1]);
          setPathwayDevicesSolved(prev => {
            const next = [...prev];
            next[index] = true;
            return next;
          });
        }
      }
    });

    socket.on('admin:credentials_synced', (syncObj) => {
      if (syncObj) {
        setRoomPasswords({
          pcRoom: syncObj.pc_room_access || '',
          securityRoom: syncObj.security_lab_pin || '',
          serverRoom: syncObj.server_room_pin || '',
          networkHub: syncObj.network_uplink_ip || ''
        });
        setGameConfig({
          ...syncObj,
          pcUsername: syncObj.pc_login_handle || '',
          pcPassword: syncObj.pc_password || '',
          intruderName: syncObj.hidden_intruder_name || 'UNKNOWN_OPERATIVE',
          targetRmse: parseFloat(syncObj.lab_target_rmse) || 0.05,
        });
        setNotification('SYSTEM: CREDENTIAL CONTROL CENTER SYNCED');
        setTimeout(() => setNotification(null), 3500);
      }
    });

    socket.on('team:initialProgress', (completedKeys) => {
      if (!completedKeys || !Array.isArray(completedKeys)) return;
      const newLevelCompleted = { pcLogin: false, securityAccess: false, serverAccess: false };
      const newRoomUnlocked = { pcRoom: false, securityRoom: false, serverRoom: false };
      const newPathwaySolved = [false, false, false, false, false, false];
      const newInventory = [];
      let hubStarted = false;

      completedKeys.forEach(key => {
        if (key === 'PC_LOGIN' || key === 'pcLogin') newLevelCompleted.pcLogin = true;
        if (key === 'LAB_COMPLETE' || key === 'securityAccess') newLevelCompleted.securityAccess = true;
        if (key === 'FIND_NAME' || key === 'serverAccess') newLevelCompleted.serverAccess = true;
        
        // Operation Red Trophy Keys
        if (key === 'ROUND_1_COMPLETE') newLevelCompleted.ROUND_1_COMPLETE = true;
        if (key === 'ROUND_2_COMPLETE') newLevelCompleted.ROUND_2_COMPLETE = true;
        if (key === 'ROUND_3_COMPLETE') newLevelCompleted.ROUND_3_COMPLETE = true;
        if (key === 'FINAL_ROUND_COMPLETE') newLevelCompleted.FINAL_ROUND_COMPLETE = true;

        if (key === 'PC_DOOR' || key === 'pc') newRoomUnlocked.pcRoom = true;
        if (key === 'SERVER_DOOR' || key === 'server') newRoomUnlocked.serverRoom = true;
        if (key === 'SECURITY_DOOR' || key === 'security') newRoomUnlocked.securityRoom = true;
        if (key === 'HUB_PIN' || key === 'HUB_STARTED') hubStarted = true;
        if (key.startsWith('PATHWAY_')) {
          const idx = parseInt(key.split('_')[1]);
          if (idx >= 0 && idx < 6) newPathwaySolved[idx] = true;
        }
      });

      setLevelCompleted(newLevelCompleted);
      setPathwayDevicesSolved(newPathwaySolved);
      setRoomUnlocked(newRoomUnlocked);
      if (hubStarted) setNetworkHubStarted(true);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('player:progress');
      socket.off('admin:credentials_synced');
      socket.off('team:initialProgress');
    };
  }, [currentUser]);

  const [roomState, setRoomState] = useState({
    pc: { locked: false, solved: true },
    server: { locked: false, solved: true },
    security: { locked: false, solved: true },
    bookshelf: { locked: false, solved: true },
  });

  const [pcRoomDoorOpen, setPcRoomDoorOpen] = useState(true);
  const [serverRoomDoorOpen, setServerRoomDoorOpen] = useState(true);
  const [securityRoomDoorOpen, setSecurityRoomDoorOpen] = useState(true);
  const [libraryRoomDoorOpen, setLibraryRoomDoorOpen] = useState(true);

  const addToInventory = useCallback((item) => setInventory((prev) => prev.includes(item) ? prev : [...prev, item]), []);
  const switchView = useCallback((view) => {
    setCurrentView(view);
    try { if (initialUser?.id) sessionStorage.setItem(`player_view_${initialUser.id}`, view); } catch {}
  }, [initialUser?.id]);
  const updatePlayerPosition = useCallback((pos) => setPlayerPosition(pos), []);

  const [pathwayDevicesSolved, setPathwayDevicesSolved] = useState([false, false, false, false, false, false]);
  const pathwayDevicesSolvedCount = pathwayDevicesSolved.filter(Boolean).length;
  const networkHubAccessible = pathwayDevicesSolvedCount >= 4;

  const saveProgressToDB = useCallback(async (roomKey) => {
    if (FRONTEND_ONLY) return;
    if (!currentUser?.id || !roomKey) return;
    const token = sessionStorage.getItem('matrix_token') || sessionStorage.getItem('token');
    if (!token) return;
    try {
      await fetch(`${API_URL}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ teamId: currentUser.id, roomKey })
      });
    } catch (err) { console.error(err); }
  }, [currentUser]);

  const solvePathwayDevice = useCallback((index) => {
    setPathwayDevicesSolved(prev => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
    const roomKey = `PATHWAY_${index}`;
    if (gameState.status === 'LIVE' && currentUser?.id && currentUser.role !== 'admin') {
      socket.emit('player:progress', { roomKey });
      saveProgressToDB(roomKey);
    }
  }, [currentUser, saveProgressToDB, gameState.status]);

  const completeLevel = useCallback((levelId) => {
    const pIdMap = { 'pcLogin': 'PC_LOGIN', 'securityAccess': 'LAB_COMPLETE', 'serverAccess': 'FIND_NAME' };
    const pId = pIdMap[levelId] || levelId;
    setLevelCompleted(prev => ({ ...prev, [levelId]: true }));
    if (gameState.status === 'LIVE' && currentUser?.id && currentUser.role !== 'admin') {
      socket.emit('player:progress', { levelId: pId, roomKey: pId });
      // saveProgressToDB(pId); // Handled by server validation
    }
  }, [currentUser, gameState.status]);

  const syncProgress = useCallback((newProgressMap) => {
    if (!newProgressMap) return;
    const updates = {};
    if (newProgressMap.round_1_complete) updates.ROUND_1_COMPLETE = true;
    if (newProgressMap.round_2_complete) updates.ROUND_2_COMPLETE = true;
    if (newProgressMap.round_3_complete) updates.ROUND_3_COMPLETE = true;
    if (newProgressMap.final_complete) updates.FINAL_ROUND_COMPLETE = true;
    
    if (Object.keys(updates).length > 0) {
      setLevelCompleted(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const solveRoom = useCallback((roomKey) => {
    setRoomState((prev) => ({ ...prev, [roomKey]: { ...prev[roomKey], solved: true } }));
    if (gameState.status === 'LIVE' && currentUser?.id && currentUser.role !== 'admin') {
      socket.emit('player:progress', { roomKey });
      saveProgressToDB(roomKey);
    }
  }, [currentUser, saveProgressToDB, gameState.status]);

  const [roomPasswords, setRoomPasswords] = useState({ pcRoom: '', securityRoom: '', serverRoom: '', networkHub: '' });
  const [gameConfig, setGameConfig] = useState({
    pcUsername: '',
    pcPassword: '',
    intruderName: 'UNKNOWN_OPERATIVE',
    intruderEncodedCode: '',
    targetRmse: 0.05,
    dirtyDataset: 'dirty_cyber_data.csv',
    truthDataset: 'ground_truth.csv',
    cleaningScript: 'cleaner.py'
  });

  useEffect(() => {
    if (FRONTEND_ONLY) return;
    const token = sessionStorage.getItem('matrix_token');
    fetch(`${API_URL}/credentials/all`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.json()).then(data => {
      if (data && typeof data === 'object') {
        setRoomPasswords({
          pcRoom: data.pc_room_access || '',
          securityRoom: data.security_lab_pin || '',
          serverRoom: data.server_room_pin || '',
          networkHub: data.network_uplink_ip || ''
        });
        setGameConfig({
          ...data,
          pcUsername: data.pc_login_handle || '',
          pcPassword: data.pc_password || '',
          intruderName: data.hidden_intruder_name || 'UNKNOWN_OPERATIVE',
          targetRmse: parseFloat(data.lab_target_rmse) || 0.05,
        });
      }
    }).catch(console.error);
  }, []);

  const [roomUnlocked, setRoomUnlocked] = useState({ pcRoom: true, securityRoom: true, serverRoom: true });
  const [scannerAttempts, setScannerAttempts] = useState({ pcRoom: { count: 0, cooldownUntil: null }, securityRoom: { count: 0, cooldownUntil: null }, serverRoom: { count: 0, cooldownUntil: null } });
  const [activePinEntry, setActivePinEntry] = useState(null);
  const [levelCompleted, setLevelCompleted] = useState({ pcLogin: false, securityAccess: false, serverAccess: false });
  const [interactionTrigger, setInteractionTrigger] = useState(0);
  const [caseStats, setCaseStats] = useState(null);
  const [networkHubStarted, setNetworkHubStarted] = useState(true);
  const [hubAttempts, setHubAttempts] = useState(0);
  const [hubCooldownUntil, setHubCooldownUntil] = useState(null);
  const [activeHubOverlay, setActiveHubOverlay] = useState(false);
  const [mobileInput, setMobileInput] = useState({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });

  const triggerInteraction = useCallback(() => setInteractionTrigger(prev => prev + 1), []);
  const canAccessRoom = useCallback(() => true, []);
  const getDenialMessage = useCallback(() => 'ACCESS DENIED', []);
  const isRoomInCooldown = useCallback((roomKey) => {
    const attempt = scannerAttempts[roomKey];
    return attempt?.cooldownUntil && Date.now() < attempt.cooldownUntil;
  }, [scannerAttempts]);

  const recordFailedAttempt = useCallback((roomKey) => {
    setScannerAttempts(prev => {
      const current = prev[roomKey] || { count: 0, cooldownUntil: 0 };
      const newCount = current.count + 1;
      let newCooldown = newCount >= 3 ? Date.now() + 30000 : null;
      return { ...prev, [roomKey]: { count: newCount >= 3 ? 0 : newCount, cooldownUntil: newCooldown } };
    });
  }, []);

  const unlockRoomScanner = useCallback((roomKey) => {
    setRoomUnlocked(prev => ({ ...prev, [roomKey]: true }));
    const roomViewMap = { pcRoom: 'pc_login', serverRoom: 'server_rack', securityRoom: 'security_desk' };
    if (roomViewMap[roomKey]) switchView(roomViewMap[roomKey]);
    setActivePinEntry(null);
  }, [switchView]);

  const solveCase = useCallback(async () => {
    switchView('case_solved');
  }, [switchView]);

  const recordHubAttempt = useCallback((success) => {
    if (success) { setNetworkHubStarted(true); setHubAttempts(0); return; }
    setHubAttempts(prev => prev + 1);
  }, []);

  const unlockRoom = useCallback((roomKey) => {
    setRoomState((prev) => ({ ...prev, [roomKey]: { ...prev[roomKey], locked: false } }));
  }, []);

  const collectArtifact = useCallback((artifactId) => {
    setInventory((prev) => prev.includes(artifactId) ? prev : [...prev, artifactId]);
  }, []);
  const hasArtifact = useCallback((artifactId) => inventory.includes(artifactId), [inventory]);
  const login = useCallback((userProfile) => {
    setCurrentUser(userProfile || null);
    setAuthenticated(true);
  }, []);

  const showMissionBriefing = useCallback((briefingData, onDismiss) => {
    missionDismissRef.current = onDismiss || null;
    setMissionBriefing(briefingData);
  }, []);

  const dismissMissionBriefing = useCallback(() => {
    setMissionBriefing(null);
    if (missionDismissRef.current) { missionDismissRef.current(); missionDismissRef.current = null; }
  }, []);

  return (
    <SimulationContext.Provider
      value={useMemo(() => ({
        quality, setQuality, currentView, switchView, playerPosition, updatePlayerPosition, tooltip, setTooltip,
        isAuthenticated, setAuthenticated, login, currentUser, setCurrentUser,
        otherPlayers, otherPlayersRef, multiplayerConnected, sendPosition, gameState,
        notification, setNotification, inventory, addToInventory, collectArtifact, hasArtifact,
        roomState, unlockRoom, solveRoom, pcRoomDoorOpen, setPcRoomDoorOpen, serverRoomDoorOpen, setServerRoomDoorOpen,
        securityRoomDoorOpen, setSecurityRoomDoorOpen, libraryRoomDoorOpen, setLibraryRoomDoorOpen,
        pathwayDevicesSolved, pathwayDevicesSolvedCount, networkHubAccessible, solvePathwayDevice,
        roomPasswords, roomUnlocked, scannerAttempts, activePinEntry, setActivePinEntry,
        isRoomInCooldown, unlockRoomScanner, recordFailedAttempt, levelCompleted,
        canAccessRoom, getDenialMessage, completeLevel, interactionTrigger, triggerInteraction,
        networkHubStarted, setNetworkHubStarted, hubAttempts, hubCooldownUntil, recordHubAttempt,
        activeHubOverlay, setActiveHubOverlay,
        solveCase, caseStats, gameConfig, mobileInput, setMobileInput,
        missionBriefing, showMissionBriefing, dismissMissionBriefing,
        user: currentUser,
        isFrozen,
        progress: Object.keys(levelCompleted).filter(k => levelCompleted[k]),
        addProgress: completeLevel,
        syncProgress,
        credentials: { ...gameConfig, ...roomPasswords }
      }), [
        quality, setQuality, currentView, switchView, playerPosition, updatePlayerPosition, tooltip, setTooltip,
        isAuthenticated, setAuthenticated, login, currentUser, setCurrentUser,
        otherPlayers, otherPlayersRef, multiplayerConnected, sendPosition, gameState,
        notification, setNotification, inventory, addToInventory, collectArtifact, hasArtifact,
        roomState, unlockRoom, solveRoom, pcRoomDoorOpen, setPcRoomDoorOpen, serverRoomDoorOpen, setServerRoomDoorOpen,
        securityRoomDoorOpen, setSecurityRoomDoorOpen, libraryRoomDoorOpen, setLibraryRoomDoorOpen,
        pathwayDevicesSolved, pathwayDevicesSolvedCount, networkHubAccessible, solvePathwayDevice,
        roomPasswords, roomUnlocked, scannerAttempts, activePinEntry, setActivePinEntry,
        isRoomInCooldown, unlockRoomScanner, recordFailedAttempt, levelCompleted,
        canAccessRoom, getDenialMessage, completeLevel, syncProgress, interactionTrigger, triggerInteraction,
        networkHubStarted, setNetworkHubStarted, hubAttempts, hubCooldownUntil, recordHubAttempt,
        activeHubOverlay, setActiveHubOverlay,
        solveCase, caseStats, gameConfig, mobileInput, setMobileInput,
        missionBriefing, showMissionBriefing, dismissMissionBriefing,
        isFrozen
      ])}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulation must be used within SimulationProvider');
  return ctx;
}

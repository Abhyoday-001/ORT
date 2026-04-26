import React, { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import StoryIntro from './StoryIntro';
import Round1 from './Round1';
import Round2 from './Round2';
import Round3 from './Round3';
import FinalHybridRound from './FinalHybridRound';
import AuctionRound from './AuctionRound';
import PasswordModal from './PasswordModal';
import { socket } from '../socket';
import TrophyBackground from './TrophyBackground';
import { fetchGameRuntime } from '../lib/apiClient';
import { useGameSystem } from '../hooks/useGameSystem';
import '../themes/rcbTheme.css';

/* ── Progress Step Component ── */
const ProgressStep = ({ label, stepNum, status }) => {
  const isActive = status === 'active';
  const isComplete = status === 'complete';
  const isDimmed = status === 'future';

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          w-6 h-6 flex items-center justify-center text-xs font-bold
          border transition-all duration-500
          ${isComplete ? 'border-[var(--ort-green)] bg-[var(--ort-green-dim)] text-[var(--ort-green)]' : ''}
          ${isActive ? 'border-[var(--ort-cyan)] bg-[var(--ort-cyan-dim)] text-[var(--ort-cyan)] shadow-[0_0_12px_var(--ort-cyan-glow)] animate-pulse' : ''}
          ${isDimmed ? 'border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.2)]' : ''}
        `}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {isComplete ? '✓' : stepNum}
      </div>
      <span
        className={`text-[0.55rem] font-bold tracking-[0.15em] uppercase transition-colors duration-500`}
        style={{
          fontFamily: 'var(--font-mono)',
          color: isComplete ? 'var(--ort-green)' : isActive ? 'var(--ort-cyan)' : 'rgba(255,255,255,0.2)'
        }}
      >
        {label}
      </span>
    </div>
  );
};

const ProgressConnector = ({ active }) => (
  <div
    className="w-8 h-[1px] mx-1 transition-all duration-500"
    style={{
      background: active
        ? 'linear-gradient(to right, var(--ort-green), var(--ort-cyan))'
        : 'rgba(255,255,255,0.08)'
    }}
  />
);

const RedTrophyGame = () => {
  const { user, progress, addProgress } = useSimulation();
  const { state: gameSystemState, updateTeamFlag } = useGameSystem(user?.teamName);
  const [gameRuntime, setGameRuntime] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [sabotageActive, setSabotageActive] = useState(false);
  const [sabotageTimeLeft, setSabotageTimeLeft] = useState(0);

  // Transition State
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionText, setTransitionText] = useState('');

  // Password Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    description: '',
    onSubmit: () => {},
    error: ''
  });

  useEffect(() => {
    if (progress.includes('INTRO_COMPLETE')) {
      if (progress.includes('FINAL_ROUND_COMPLETE')) setCurrentRound(5);
      else if (progress.includes('ROUND_3_COMPLETE')) setCurrentRound(4);
      else if (progress.includes('ROUND_2_COMPLETE')) setCurrentRound(3);
      else if (progress.includes('ROUND_1_COMPLETE')) setCurrentRound(2);
      else setCurrentRound(1);
    }
  }, [progress]);

  useEffect(() => {
    let mounted = true;

    const loadRuntime = async () => {
      try {
        const result = await fetchGameRuntime();
        if (!mounted) return;
        setGameRuntime(result?.runtime || null);
      } catch {
        if (!mounted) return;
        setGameRuntime(null);
      }
    };

    loadRuntime();
    const timer = setInterval(loadRuntime, 3000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    socket.on('game:sabotage', (data) => {
      if (data.targetTeam === user?.teamName) {
        setSabotageActive(true);
        setSabotageTimeLeft(data.duration / 1000);
      }
    });
    return () => { socket.off('game:sabotage'); };
  }, [user?.teamName]);

  useEffect(() => {
    if (sabotageActive && sabotageTimeLeft > 0) {
      const timer = setInterval(() => {
        setSabotageTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (sabotageTimeLeft <= 0) {
      setSabotageActive(false);
    }
  }, [sabotageActive, sabotageTimeLeft]);

  const triggerTransition = (text, nextRound) => {
    setIsTransitioning(true);
    setTransitionText(text);
    setTimeout(() => {
      setCurrentRound(nextRound);
      setIsTransitioning(false);
    }, 2800);
  };

  const handleIntroComplete = () => {
    addProgress('INTRO_COMPLETE');
    updateTeamFlag(user?.teamName, 'INTRO_COMPLETE');
    triggerTransition('INITIALIZING ROUND 1...', 1);
  };

  const handleRoundComplete = (roundNum) => {
    const key = `ROUND_${roundNum}_COMPLETE`;
    addProgress(key);
    updateTeamFlag(user?.teamName, key);

    let nextText = 'DECRYPTING DATA STREAM...';
    if (roundNum === 1) nextText = 'NETWORK BREACH SUCCESSFUL...';
    if (roundNum === 2) nextText = 'TRIANGULATING VAULT ACCESS...';
    if (roundNum === 3) nextText = 'UNLOCKING FINAL OBJECTIVE...';

    triggerTransition(nextText, roundNum + 1);
  };

  const handleFinalRoundComplete = () => {
    addProgress('FINAL_ROUND_COMPLETE');
    updateTeamFlag(user?.teamName, 'FINAL_ROUND_COMPLETE');
    triggerTransition('VAULT UNSEALED...', 5);
  };

  const openPasswordModal = (config) => {
    setModalConfig({ ...config, isOpen: true, error: '' });
  };
  const closePasswordModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };
  const setModalError = (error) => {
    setModalConfig(prev => ({ ...prev, error }));
  };

  const getStepStatus = (stepRound) => {
    if (currentRound > stepRound) return 'complete';
    if (currentRound === stepRound) return 'active';
    return 'future';
  };

  const runtimeStatus = gameRuntime?.status || 'LIVE';

  return (
    <div className="fixed inset-0 overflow-hidden flex flex-col ort-grid-bg" style={{ background: 'var(--ort-bg)' }}>
      <div className="stadium-glow" />
      <div className="ambient-particles" />

      {/* Background layers */}
      <div className={`absolute inset-0 flex flex-col transition-all duration-500 ${modalConfig.isOpen ? 'ort-blur-bg' : ''}`}>

        {/* Decorative lines */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-0 left-[20%] w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, var(--ort-green-dim), transparent)' }} />
          <div className="absolute top-0 right-[20%] w-[1px] h-full" style={{ background: 'linear-gradient(to bottom, transparent, var(--ort-cyan-dim), transparent)' }} />
        </div>

        {/* ═══ HEADER — Sticky Top Bar ═══ */}
        <header
          className="relative z-20 px-6 py-3 flex items-center justify-between ort-glass"
          style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}
        >
          {/* Left — Event Name */}
          <div className="flex items-center gap-3">
            <h1
              className="text-sm font-black tracking-[0.15em] uppercase ort-glow-green"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--ort-red)' }}
            >
              OPERATION: RED TROPHY
            </h1>
          </div>

          {/* Center — Game Progress Bar */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            <ProgressStep label="Round 1" stepNum="1" status={getStepStatus(1)} />
            <ProgressConnector active={currentRound > 1} />
            <ProgressStep label="Round 2" stepNum="2" status={getStepStatus(2)} />
            <ProgressConnector active={currentRound > 2} />
            <ProgressStep label="Round 3" stepNum="3" status={getStepStatus(3)} />
            <ProgressConnector active={currentRound > 3} />
            <ProgressStep label="Final" stepNum="4" status={getStepStatus(4)} />
            <ProgressConnector active={currentRound > 4} />
            <ProgressStep label="Vault" stepNum="05" status={getStepStatus(5)} />
          </div>

          {/* Right — Operative */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[0.5rem] uppercase tracking-[0.3em]" style={{ color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)' }}>Operative</p>
              <p className="text-xs font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ort-cyan)' }}>
                {user?.playerName || user?.teamName || 'UNKNOWN'}
              </p>
            </div>
            <div
              className="w-8 h-8 flex items-center justify-center ort-neon-cyan"
              style={{ fontFamily: 'var(--font-heading)', fontSize: '0.7rem', fontWeight: 800, color: 'var(--ort-cyan)' }}
            >
              {currentRound > 4 ? '05' : `R${currentRound}`}
            </div>
          </div>
        </header>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="relative z-10 flex-1 overflow-y-auto" style={{ padding: '1.5rem 2rem' }}>

          {/* Sabotage Overlay */}
          {sabotageActive && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" style={{ background: 'rgba(255,59,59,0.9)', backdropFilter: 'blur(20px)' }}>
              <h1 className="text-5xl font-black uppercase ort-glow-red" style={{ fontFamily: 'var(--font-heading)', color: 'white', marginBottom: '1rem' }}>
                SABOTAGE ACTIVE
              </h1>
              <p className="text-xl" style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.8)' }}>
                REBOOTING SYSTEMS IN: {sabotageTimeLeft}s
              </p>
              <div style={{ marginTop: '2rem', width: '280px', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--ort-amber)', width: `${(sabotageTimeLeft / 180) * 100}%`, transition: 'width 1s linear', boxShadow: '0 0 10px var(--ort-amber-glow)' }} />
              </div>
            </div>
          )}

          {runtimeStatus === 'PAUSED' && (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/75 backdrop-blur-sm">
              <h2 className="text-4xl font-black text-yellow-400 tracking-[0.15em]" style={{ fontFamily: 'var(--font-heading)' }}>
                GAME PAUSED
              </h2>
              <p className="mt-3 text-sm text-white/70 font-mono uppercase tracking-[0.25em]">Awaiting admin resume signal</p>
            </div>
          )}

          <div className="max-w-7xl mx-auto h-full">
                        {currentRound === 0 && (
                          <StoryIntro onComplete={handleIntroComplete} />
                        )}
            {currentRound === 1 && (
              <Round1
                onComplete={() => handleRoundComplete(1)}
                openModal={openPasswordModal}
                closeModal={closePasswordModal}
                setModalError={setModalError}
              />
            )}
            {currentRound === 2 && (
              <Round2
                onComplete={() => handleRoundComplete(2)}
                openModal={openPasswordModal}
                closeModal={closePasswordModal}
                setModalError={setModalError}
              />
            )}
            {currentRound === 3 && (
              <Round3
                onComplete={() => handleRoundComplete(3)}
                openModal={openPasswordModal}
                closeModal={closePasswordModal}
                setModalError={setModalError}
              />
            )}
            {currentRound === 4 && (
              <FinalHybridRound onComplete={handleFinalRoundComplete} />
            )}
            {currentRound > 4 && (
              <div className="flex flex-col items-center justify-center ort-fade-in py-16 text-center h-full">
                {/* Particle bursts */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <span
                    key={i}
                    className="ort-burst"
                    style={{
                      '--bx': `${(Math.random() - 0.5) * 400}px`,
                      '--by': `${(Math.random() - 0.5) * 400}px`,
                      animationDelay: `${Math.random() * 0.5}s`,
                      left: '50%', top: '40%',
                    }}
                  />
                ))}
                <div className="relative mb-8">
                  <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, var(--ort-green-dim) 0%, transparent 70%)', filter: 'blur(40px)', transform: 'scale(1.5)' }} />
                      <div className="relative z-10 mx-auto h-[300px] w-[300px] sm:h-[360px] sm:w-[360px]">
                        <TrophyBackground className="h-full w-full" />
                      </div>
                </div>
                <h1
                  className="text-6xl font-black uppercase tracking-tight ort-glow-green"
                  style={{ fontFamily: 'var(--font-heading)', color: 'var(--ort-green)', marginBottom: '0.75rem' }}
                >
                  EE SALA CUP NAMDE!
                </h1>
                <p
                  className="text-lg uppercase tracking-[0.4em]"
                  style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.6)', marginBottom: '3rem' }}
                >
                  The Red Trophy has been reclaimed.
                </p>
                <div className="ort-btn ort-btn-solid-green ort-pulse-btn" style={{ fontSize: '0.9rem', padding: '1rem 3rem' }}>
                  OPERATION SUCCESSFUL
                </div>
              </div>
            )}
          </div>
        </main>

        <AuctionRound />

        {/* ═══ FOOTER ═══ */}
        <footer
          className="relative z-20 px-6 py-2 flex justify-between items-center ort-glass"
          style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}
        >
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full ort-flicker" style={{ background: 'var(--ort-green)' }} />
              <span className="text-[0.55rem] font-bold tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ort-green)', opacity: 0.7 }}>Uplink Active</span>
            </div>

            {/* Phase indicators */}
            <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.15em' }}>
              <span style={{ color: currentRound >= 1 ? 'var(--ort-green)' : 'rgba(255,255,255,0.15)' }}>PHASE I</span>
              <div className="w-6 h-[1px]" style={{ background: currentRound >= 2 ? 'var(--ort-green)' : 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: currentRound >= 2 ? 'var(--ort-green)' : 'rgba(255,255,255,0.15)' }}>PHASE II</span>
              <div className="w-6 h-[1px]" style={{ background: currentRound >= 3 ? 'var(--ort-green)' : 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: currentRound >= 3 ? 'var(--ort-green)' : 'rgba(255,255,255,0.15)' }}>PHASE III</span>
              <div className="w-6 h-[1px]" style={{ background: currentRound >= 4 ? 'var(--ort-green)' : 'rgba(255,255,255,0.08)' }} />
              <span style={{ color: currentRound >= 4 ? 'var(--ort-green)' : 'rgba(255,255,255,0.15)' }}>PHASE IV</span>
            </div>
          </div>
          <span className="text-[0.5rem] italic tracking-[0.2em] uppercase" style={{ fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.15)' }}>
            CLASSIFIED ACCESS ONLY // [CHINNASWAMY_OPS]
          </span>
        </footer>
      </div>

      {/* Transition Overlay (outside blur) */}
      {isTransitioning && (
        <div className="ort-transition-overlay ort-fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div className="w-16 h-16 mx-auto mb-6" style={{ border: '2px solid var(--ort-green)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h2 className="ort-transition-text ort-glitch">{transitionText}</h2>
          </div>
          <div className="ort-transition-bar">
            <div className="ort-transition-bar-fill" />
          </div>
          <p className="mt-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Establishing Secure Uplink<span className="ort-cursor" />
          </p>
        </div>
      )}

      {/* Password Modal (outside blur) */}
      <PasswordModal
        isOpen={modalConfig.isOpen}
        onClose={closePasswordModal}
        onSubmit={modalConfig.onSubmit}
        title={modalConfig.title}
        description={modalConfig.description}
        error={modalConfig.error}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RedTrophyGame;

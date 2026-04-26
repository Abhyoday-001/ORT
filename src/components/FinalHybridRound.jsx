import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useGameSystem } from '../hooks/useGameSystem';
import { completeFinalRound, validateFinalEntry, validateFinalGate } from '../lib/apiClient';
import { GAME_CONTENT } from '../config/gameContent';

const FINAL_GATES = {
  A: {
    title: 'GATE A',
    layers: GAME_CONTENT.finalRound.gates.A,
  },
  B: {
    title: 'GATE B',
    layers: GAME_CONTENT.finalRound.gates.B,
  },
  C: {
    title: 'GATE C',
    layers: GAME_CONTENT.finalRound.gates.C,
  },
};

export default function FinalHybridRound({ onComplete }) {
  const { user } = useSimulation();
  const teamName = user?.teamName;
  const {
    state,
    chooseFinalPath,
    advanceFinalPath,
    updateTeamFlag,
    cooldown,
    setCooldown,
    isFrozen,
  } = useGameSystem(teamName);

  const [isValidating, setIsValidating] = useState(false);
  const inputRef = useRef(null);
  const [currentInput, setCurrentInput] = useState('');
  const [feedback, setFeedback] = useState('');

  // Vault state
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [isUnlockingVault, setIsUnlockingVault] = useState(false);

  const selectedGate = state.finalRound.teamPath[teamName];
  const gateConfig = selectedGate ? FINAL_GATES[selectedGate] : null;
  const currentStep = state.finalRound.teamPuzzleStep[teamName] || 0;
  
  // They are at the vault if they've completed all layers for their chosen gate
  const isAtVault = gateConfig && currentStep >= gateConfig.layers.length;

  // Cooldown logic is now handled in useGameSystem

  useEffect(() => {
    if (!isAtVault && cooldown <= 0 && !isFrozen) {
      inputRef.current?.focus();
    }
  }, [selectedGate, currentStep, isAtVault, cooldown, isFrozen]);

  const handleGateSelect = (gateId) => {
    // Unlock natively since we removed offline phase
    import('../utils/gameSystemState').then(module => {
      module.unlockFinalRound(teamName, 'V2016K');
      chooseFinalPath(teamName, gateId);
    });
  };

  const handleLayerSubmit = async (event) => {
    event.preventDefault();
    if (!gateConfig || currentStep >= gateConfig.layers.length || !currentInput.trim()) return;

    try {
      setIsValidating(true);
      setFeedback('');

      const data = await validateFinalGate(selectedGate, currentStep, currentInput.trim());

      setFeedback('FLAG ACCEPTED');
      
      // Advance step, but use a high max steps so it doesn't auto-win in local state just yet
      advanceFinalPath(teamName, 999);
      setCurrentInput('');

      setTimeout(() => setFeedback(''), 1500);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('COOLDOWN ACTIVE')) {
        const match = msg.match(/WAIT (\d+)s/);
        if (match) setCooldown(parseInt(match[1]));
      } else if (msg.includes('30S COOLDOWN')) {
        setCooldown(30);
      }
      setFeedback(msg.toUpperCase());
    } finally {
      setIsValidating(false);
    }
  };

  const handleVaultUnlock = async (event) => {
    event.preventDefault();
    try {
      setIsUnlockingVault(true);
      setVaultError('');
      
      await validateFinalEntry(vaultPassword);
      await completeFinalRound();
      
      updateTeamFlag(teamName, 'FINAL_ROUND_COMPLETE');
      
      // Fix local state winner since we bypassed it earlier
      import('../utils/gameSystemState').then(module => {
        module.advanceFinalPath(teamName, 1); // trigger winner check
      });

      onComplete?.();
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('COOLDOWN ACTIVE')) {
        const match = msg.match(/WAIT (\d+)s/);
        if (match) setCooldown(parseInt(match[1]));
      } else if (msg.includes('30S COOLDOWN')) {
        setCooldown(30);
      }
      setVaultError(msg.toUpperCase());
    } finally {
      setIsUnlockingVault(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 p-6">
      <div>
        <h1 className="premium-heading text-3xl">FINAL ROUND: VAULT BREACH</h1>
        <p className="premium-label text-xs mt-1 opacity-75">
          CHOOSE A GATE → SOLVE SECURITY LAYERS → UNLOCK THE CORE VAULT
        </p>
      </div>

      {!selectedGate && (
        <div className="premium-glass-card p-6 rounded-lg border border-red-500/20">
          <h2 className="premium-label text-red-500 mb-6 text-center text-xl tracking-[0.3em]">CHOOSE YOUR INFILTRATION GATE</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(FINAL_GATES).map(([gateId, config]) => (
              <button
                key={gateId}
                onClick={() => handleGateSelect(gateId)}
                className="group relative rounded-xl border border-white/10 bg-black/40 overflow-hidden text-left transition-all hover:border-red-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]"
              >
                {/* Visual Gate Decor */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="p-6">
                  <div className="text-4xl text-center mb-4 text-white/20 group-hover:text-red-500/50 transition-colors font-mono">
                    [{gateId}]
                  </div>
                  <p className="text-sm font-bold text-yellow-500 tracking-widest mb-3 text-center">{config.title}</p>
                  
                  <div className="mt-8 text-center">
                    <span className="inline-block px-4 py-1.5 border border-red-500/30 rounded text-[10px] font-mono text-red-500 group-hover:bg-red-500/10 transition-colors tracking-widest">
                      ENTER {gateId}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-white/40 font-mono tracking-widest mt-6 uppercase">
            Warning: Entering a gate permanently locks the others.
          </p>
        </div>
      )}

      {selectedGate && !isAtVault && gateConfig && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
          <div className="premium-glass-card border border-red-500/20 p-6 rounded-lg flex flex-col">
            <h2 className="premium-label text-xl mb-6 text-red-500 tracking-[0.2em]">{gateConfig.title}</h2>
            
            <div className="flex-1 space-y-4 text-sm font-mono flex flex-col overflow-y-auto pr-2 custom-scrollbar">
              {gateConfig.layers.map((layer, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;
                const isLocked = index > currentStep;
                
                return (
                  <div
                    key={index}
                    className={`p-4 rounded border transition-all ${
                      isCompleted 
                        ? 'border-green-500/30 bg-green-500/5 text-green-400/60' 
                        : isActive 
                          ? 'border-red-500 bg-red-500/10 text-white shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                          : 'border-white/5 bg-black/40 text-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs tracking-widest uppercase">
                        {isCompleted ? '[UNLOCKED]' : isActive ? '[ACTIVE]' : '[LOCKED]'}
                      </span>
                      <span className="font-bold">{layer.title}</span>
                    </div>
                    {isActive && (
                      <p className="text-[13px] leading-relaxed text-red-100 mt-3">{layer.question}</p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-red-500/20">
              <div className="flex justify-between text-xs font-mono text-red-400 mb-2 tracking-widest">
                <span>GATE PROGRESS</span>
                <span>{currentStep} / {gateConfig.layers.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-black/60 overflow-hidden">
                <div
                  className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] transition-all duration-700"
                  style={{ width: `${(currentStep / gateConfig.layers.length) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="premium-glass-card border border-red-500/20 p-6 rounded-lg flex flex-col justify-center">
            <form onSubmit={handleLayerSubmit} className="max-w-sm mx-auto w-full space-y-6">
              <div className="text-center font-mono text-red-400 tracking-widest text-sm mb-8">
                SOLVE SECURITY LAYER {currentStep + 1}
              </div>
              
              <div className="space-y-3 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500 font-mono">&gt;</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  placeholder={cooldown > 0 ? `LOCKED: ${cooldown}S` : "ENTER FLAG / PASSWORD"}
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isValidating || cooldown > 0}
                  className={`w-full bg-black/80 border-2 ${cooldown > 0 ? 'border-yellow-600/50' : 'border-red-900/50'} focus:border-red-500 pl-10 pr-4 py-4 rounded text-red-400 font-mono transition-all outline-none uppercase placeholder:text-red-900 shadow-[inset_0_0_20px_rgba(0,0,0,1)] ${cooldown > 0 ? 'opacity-50' : ''}`}
                />
              </div>

              {feedback && (
                <div className={`text-center text-xs font-mono tracking-widest uppercase ${feedback.includes('ACCEPTED') ? 'text-green-400' : 'text-yellow-500'}`}>
                  {feedback}
                </div>
              )}

              <button
                disabled={isValidating || !currentInput.trim() || cooldown > 0}
                className="w-full py-4 text-xs font-bold font-mono tracking-[0.2em] bg-red-900/40 text-red-100 border border-red-500 rounded hover:bg-red-900/80 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition-all disabled:opacity-50 disabled:hover:shadow-none"
              >
                {isValidating ? 'VALIDATING...' : cooldown > 0 ? `COOLDOWN: ${cooldown}S` : 'SUBMIT FLAG'}
              </button>
            </form>
          </div>
        </div>
      )}

      {selectedGate && isAtVault && (
        <div className="flex-1 flex items-center justify-center animate-fade-in py-10">
          <form onSubmit={handleVaultUnlock} className="premium-glass-card border border-yellow-500/40 bg-black/80 p-10 rounded-2xl max-w-lg w-full text-center relative overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.15)]">
            {/* Vault visual decor */}
            <div className="absolute inset-0 border-8 border-yellow-500/10 rounded-2xl pointer-events-none" />
            
            <div className="w-20 h-20 mx-auto border-4 border-yellow-500/30 rounded-full flex items-center justify-center mb-8 relative">
              <div className="w-12 h-12 border-2 border-dashed border-yellow-500/60 rounded-full animate-spin" style={{ animationDuration: '4s' }} />
              <div className="w-2 h-2 bg-yellow-400 rounded-full absolute" />
            </div>

            <h2 className="premium-heading text-3xl text-yellow-500 mb-2">FINAL VAULT UNLOCKED</h2>
            <p className="text-xs text-yellow-500/60 font-mono tracking-widest uppercase mb-8">
              WARNING: CORE VAULT PASSWORD REQUIRED TO RETRIEVE THE TROPHY
            </p>
            
            <div className="space-y-4 text-left">
              <label className="text-[10px] text-white/50 font-mono uppercase tracking-[0.3em] block ml-1">VAULT PASSWORD</label>
              <input
                type="password"
                value={vaultPassword}
                onChange={(event) => setVaultPassword(event.target.value)}
                className="w-full bg-black/90 border border-yellow-900/50 focus:border-yellow-500 px-5 py-4 rounded-lg text-yellow-500 font-mono tracking-widest transition-all outline-none text-center text-lg"
                placeholder="********"
                autoComplete="off"
              />
            </div>
            
            {vaultError && <p className="mt-4 text-red-500 text-xs font-mono tracking-widest uppercase">{vaultError}</p>}
            
            <button
              type="submit"
              disabled={isUnlockingVault || !vaultPassword || cooldown > 0}
              className="mt-8 relative group w-full py-5 rounded-lg text-sm font-bold font-mono tracking-[0.3em] text-black bg-gradient-to-r from-yellow-500 hover:from-yellow-400 hover:to-yellow-500 to-yellow-600 transition-all disabled:opacity-50 overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.3)] hover:shadow-[0_0_50px_rgba(234,179,8,0.5)]"
            >
              {/* Shine effect */}
              <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 group-hover:left-[100%] transition-all duration-1000 ease-in-out" />
              
              {isUnlockingVault ? 'DECRYPTING...' : cooldown > 0 ? `LOCKED: ${cooldown}S` : 'OPEN VAULT'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

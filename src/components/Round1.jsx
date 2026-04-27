import React, { useEffect, useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useGameSystem } from '../hooks/useGameSystem';
import { GAME_CONTENT } from '../config/gameContent';
import { validateRound1 } from '../lib/apiClient';

const ROUND1_IMAGE = GAME_CONTENT.round1.roundImage || '/assets/Round1.png';
const WIFI_NETWORKS = GAME_CONTENT.round1.wifiNetworks;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const SignalBars = ({ strength }) => (
  <div className="flex items-end gap-1" title={`Signal strength: ${strength}/5`}>
    {[6, 8, 10, 12, 14].map((height, idx) => {
      const isFilled = idx < strength;
      return (
      <div
        key={height}
        className="rounded-sm transition-all"
        style={{
          width: '3px',
          height: `${height}px`,
          background: isFilled ? '#10b981' : 'rgba(255,255,255,0.12)',
        }}
      />
      );
    })}
  </div>
);

export default function Round1({ onComplete }) {
  const { credentials, user } = useSimulation();
  const displayTeamName = user?.teamName || user?.team_id || credentials?.teamName || credentials?.team_id || 'UNKNOWN';

  // State
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [extractedPassword, setExtractedPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { cooldown, setCooldown } = useGameSystem(user?.teamName);

  // Cooldown logic is now handled in useGameSystem
  const [showImageFullscreen, setShowImageFullscreen] = useState(null);
  const [networkTelemetry, setNetworkTelemetry] = useState(() =>
    WIFI_NETWORKS.reduce((acc, network) => {
      acc[network.id] = {
        signal: network.baseSignal,
        speed: network.baseSpeed,
      };
      return acc;
    }, {})
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setNetworkTelemetry((prev) =>
        WIFI_NETWORKS.reduce((acc, network) => {
          const previous = prev[network.id] || {
            signal: network.baseSignal,
            speed: network.baseSpeed,
          };

          const signalDelta = Math.floor(Math.random() * 3) - 1;
          const speedVariance = Math.round(network.baseSpeed * 0.22);
          const speedDelta = Math.floor(Math.random() * (speedVariance * 2 + 1)) - speedVariance;

          acc[network.id] = {
            signal: clamp(previous.signal + signalDelta, 1, 5),
            speed: clamp(network.baseSpeed + speedDelta, 2, 260),
          };
          return acc;
        }, {})
      );
    }, 1800);

    return () => clearInterval(timer);
  }, []);

  const handleNetworkSelect = (networkId) => {
    setSelectedNetwork(networkId);
    setPasswordError('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!selectedNetwork) {
      setPasswordError('❌ SELECT A WIFI NETWORK FIRST');
      return;
    }

    try {
      setIsSubmitting(true);
      await validateRound1(selectedNetwork, extractedPassword.trim().toUpperCase());
      setPasswordSuccess(true);
      setPasswordError('');
      setTimeout(() => {
        onComplete?.();
      }, 1500);
    } catch (error) {
      const msg = error.message || '';
      if (msg.includes('COOLDOWN ACTIVE')) {
        const match = msg.match(/WAIT (\d+)s/);
        if (match) setCooldown(parseInt(match[1]));
      } else if (msg.includes('30S COOLDOWN')) {
        setCooldown(30);
      }
      setPasswordError(`❌ ${msg}`);
      setExtractedPassword('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-8 p-6" style={{ background: 'rgba(0,0,0,0.1)' }}>
      {/* ═══ HEADER ═══ */}
      <div className="space-y-2">
        <h1 className="premium-heading text-3xl">ROUND 1: THE DIGITAL FINGERPRINT</h1>
        <p className="premium-label" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
          MISSION: EXTRACT HIDDEN PASSWORD FROM THE IMAGE → IDENTIFY CORRECT WIFI NETWORK → GAIN ACCESS
        </p>
      </div>

      {/* ═══ MAIN CONTENT GRID ═══ */}
      <div className="flex-1 grid grid-cols-3 gap-6" style={{ minHeight: 0 }}>

        {/* ─────────────────────────────────────────────────────────
            LEFT COLUMN: IMAGE ANALYSIS (2/3 width)
            ───────────────────────────────────────────────────────── */}
        <div className="col-span-2 flex flex-col gap-4">
          {/* Image Display */}
          <div
            className="flex-1 relative rounded-lg overflow-hidden border border-white/10 bg-black/50 backdrop-blur-md cursor-pointer group transition-all"
            onClick={() => setShowImageFullscreen('round1')}
            style={{ minHeight: '320px' }}
          >
            <img
              src={ROUND1_IMAGE}
              alt="round 1 challenge"
              className="w-full h-full object-cover transition-all group-hover:opacity-75"
              style={{ filter: 'brightness(0.95)' }}
            />
            
            {/* Subtle Border Glow */}
            <div className="absolute inset-0 pointer-events-none border-2 border-yellow-500/10" />

            {/* Click to Zoom Hint */}
            <div className="absolute bottom-4 right-4 flex items-center gap-3">
              <a
                href={ROUND1_IMAGE}
                download="Round1_Challenge.png"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md bg-black/60 border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
              >
                📥 DOWNLOAD ASSET
              </a>
              <div className="text-[10px] text-yellow-500/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                [Click to expand]
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gradient-to-r from-yellow-500/5 to-red-500/5 border border-yellow-500/20 rounded-lg p-4 backdrop-blur-md">
            <div className="premium-label mb-2 text-yellow-500">💡 STEGANOGRAPHY HINT</div>
            <p className="text-xs text-white/70 font-mono leading-relaxed">
              Analyze the image carefully. The WiFi password may be hidden in text overlays, color
              variations, hidden patterns, or metadata. Extract the password and select the correct
              WiFi network below to proceed to Round 2.
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────
            RIGHT COLUMN: WIFI BREACH (1/3 width)
            ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* OPERATIVE STATUS PANEL */}
          <div className="premium-glass-card p-4 rounded-lg">
            <div className="premium-label mb-3">OPERATIVE STATUS</div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: '#10b981',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.6)',
                }}
              />
              <span className="text-xs text-green-400 font-mono">ONLINE</span>
            </div>
            <div className="text-xs font-mono text-white/70 space-y-1">
              <div>
                <span className="opacity-60">Team:</span>{' '}
                <span className="text-yellow-500 font-bold">{displayTeamName}</span>
              </div>
            </div>
          </div>

          {/* AVAILABLE NETWORKS PANEL */}
          <div className="premium-glass-card p-4 rounded-lg flex-1 flex flex-col">
            <div className="premium-label mb-3">AVAILABLE NETWORKS</div>

            {/* Network Selection List */}
            <div className="flex-1 space-y-2 overflow-y-auto mb-4 pr-2">
              {WIFI_NETWORKS.map((network) => {
                const telemetry = networkTelemetry[network.id] || {
                  signal: network.baseSignal,
                  speed: network.baseSpeed,
                };

                return (
                <div
                  key={network.id}
                  onClick={() => handleNetworkSelect(network.id)}
                  className="p-3 rounded-lg cursor-pointer transition-all border"
                  style={{
                    background: selectedNetwork === network.id
                      ? 'rgba(218, 24, 24, 0.2)'
                      : 'rgba(255, 255, 255, 0.03)',
                    border: selectedNetwork === network.id
                      ? '1px solid #da1818'
                      : '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-white/80 flex-1 min-w-0 truncate">
                      🔒 {network.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-cyan-300/90 w-[64px] text-right">
                        {telemetry.speed} Mbps
                      </span>
                      <SignalBars strength={telemetry.signal} />
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            {selectedNetwork && (
              <div className="mb-4 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-2">
                <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-300/90">
                  Live Link Speed:{' '}
                  {networkTelemetry[selectedNetwork]?.speed || WIFI_NETWORKS.find((net) => net.id === selectedNetwork)?.baseSpeed || 0} Mbps
                </p>
              </div>
            )}

            {/* Divider */}
            <div className="border-b border-white/10 mb-4" />

            {/* PASSWORD INPUT & SUBMIT */}
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <div>
                <label className="premium-label block mb-2">EXTRACTED PASSWORD</label>
                <input
                  type="password"
                  value={extractedPassword}
                  onChange={(e) => setExtractedPassword(e.target.value.toUpperCase())}
                  placeholder="Enter password..."
                  className="premium-input w-full px-3 py-2 rounded-lg text-xs"
                  disabled={!selectedNetwork}
                  autoComplete="off"
                />
              </div>

              {/* Error Message */}
              {passwordError && (
                <p className="premium-error text-xs">{passwordError}</p>
              )}

              {/* Success Message */}
              {passwordSuccess && (
                <p className="text-xs text-green-400 font-mono animate-pulse">
                  ✓ ACCESS GRANTED - CONNECTING TO ROUND 2...
                </p>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedNetwork || passwordSuccess || isSubmitting || cooldown > 0}
                className={`premium-button w-full py-2 px-3 text-xs rounded-lg ${cooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {passwordSuccess 
                  ? '✓ NETWORK CONNECTED' 
                  : isSubmitting 
                    ? 'VALIDATING...' 
                    : cooldown > 0 
                      ? `LOCKED: ${cooldown}s` 
                      : 'BREACH NETWORK'}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* ═══ FULLSCREEN IMAGE MODAL ═══ */}
      {showImageFullscreen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md p-6"
          onClick={() => setShowImageFullscreen(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col gap-4">
            {/* Full Size Image */}
            <img
              src={ROUND1_IMAGE}
              alt="Full resolution"
              className="w-full h-auto object-contain max-h-[80vh]"
            />

            {/* Close Button & Instructions */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/50 font-mono">
                Examine the image carefully to find the hidden password...
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={ROUND1_IMAGE}
                  download="Round1_Challenge.png"
                  onClick={(e) => e.stopPropagation()}
                  className="premium-button px-4 py-2 text-xs rounded-lg flex items-center gap-2"
                >
                  📥 DOWNLOAD IMAGE
                </a>
                <button
                  onClick={() => setShowImageFullscreen(null)}
                  className="premium-button px-4 py-2 text-xs rounded-lg"
                >
                  CLOSE [ESC]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close modal on ESC key */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        div[style*="z-[1000]"] {
          animation: fadeInUp 0.4s cubic-bezier(0.2, 1, 0.2, 1);
        }
      `}</style>
    </div>
  );
}

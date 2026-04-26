import React, { useState, useEffect, useRef } from 'react';
import { GAME_CONTENT } from '../config/gameContent';

const { clubs: CLUBS, clubLogos: CLUB_LOGOS, missionBriefing: MISSION_BRIEFING } = GAME_CONTENT.storyIntro;

export default function StoryIntro({ onComplete }) {
  const onCompleteRef = useRef(onComplete);
  const [phase, setPhase] = useState('clubs'); // 'clubs' → 'briefing' → 'encryption' → complete
  const [displayedBriefing, setDisplayedBriefing] = useState('');
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // ─── PHASE 1: Show club logos with glow ───
  useEffect(() => {
    if (phase === 'clubs') {
      const timer = setTimeout(() => setPhase('briefing'), 4000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ─── PHASE 2: Type out mission briefing ───
  useEffect(() => {
    if (phase !== 'briefing') return;

    if (charIndex < MISSION_BRIEFING.length) {
      const timeout = setTimeout(() => {
        setDisplayedBriefing(MISSION_BRIEFING.slice(0, charIndex + 1));
        setCharIndex(charIndex + 1);
      }, 20);
      return () => clearTimeout(timeout);
    } else {
      // Briefing complete, wait 2s then go to encryption
      const timer = setTimeout(() => setPhase('encryption'), 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, charIndex]);

  // ─── PHASE 3: Show encryption animation ───
  useEffect(() => {
    if (phase === 'encryption') {
      const timer = setTimeout(() => onCompleteRef.current?.(), 3000);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ─── Click to skip ───
  useEffect(() => {
    const handleClick = () => {
      if (phase !== 'encryption') onCompleteRef.current?.();
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black overflow-hidden">
      {/* ═══ PHASE 1: CLUB LOGOS ═══ */}
      {phase === 'clubs' && (
        <div className="text-center space-y-8">
          <div className="flex items-center justify-center gap-8">
            {CLUBS.map((club, idx) => (
              <React.Fragment key={club.shortCode}>
                {idx > 0 && (
                  <span
                    className="text-4xl font-black select-none"
                    style={{
                      color: '#f0c16b',
                      textShadow: '0 0 16px rgba(240, 193, 107, 0.6)',
                      animation: `fadeInUp 1s cubic-bezier(0.2, 1, 0.2, 1) ${(idx * 0.3) - 0.15}s both`,
                    }}
                  >
                    X
                  </span>
                )}

                <div
                  className="relative"
                  style={{
                    animation: `fadeInUp 1s cubic-bezier(0.2, 1, 0.2, 1) ${idx * 0.3}s both`,
                  }}
                >
                  {/* Logo Container with Glow */}
                  <div
                    className="relative w-32 h-32 flex items-center justify-center"
                    style={{
                      background: `radial-gradient(circle, rgba(218, 24, 24, 0.2) 0%, transparent 70%)`,
                      borderRadius: '50%',
                      boxShadow: '0 0 30px rgba(218, 24, 24, 0.3)',
                    }}
                  >
                    <img
                      src={CLUB_LOGOS[club.shortCode]}
                      alt={club.name}
                      className="w-24 h-24 object-contain filter drop-shadow-lg"
                      style={{
                        filter: 'drop-shadow(0 0 15px rgba(240, 193, 107, 0.4))',
                      }}
                    />
                  </div>

                  {/* Club Name */}
                  <p className="premium-label mt-4 text-center text-xs">{club.name}</p>
                </div>
              </React.Fragment>
            ))}
          </div>

          <p className="premium-label text-sm mt-8" style={{ animation: 'fadeInUp 1s ease 1.5s both' }}>
            MISSION UNIFIED
          </p>
        </div>
      )}

      {/* ═══ PHASE 2: MISSION BRIEFING ═══ */}
      {phase === 'briefing' && (
        <div className="max-w-2xl mx-auto p-8">
          <div className="premium-glass-card p-8 rounded-lg">
            <div className="premium-label mb-4 text-center">MISSION BRIEFING</div>
            <p
              className="text-sm leading-relaxed font-mono text-white/80 whitespace-pre-wrap"
              style={{
                minHeight: '120px',
                color: displayedBriefing.length > 0 ? '#f0f0f0' : 'rgba(255, 255, 255, 0.3)',
              }}
            >
              {displayedBriefing}
              {charIndex < MISSION_BRIEFING.length && <span className="animate-pulse">▌</span>}
            </p>
          </div>
          <p className="text-xs text-center text-white/40 mt-4 font-mono">
            [Click to skip]
          </p>
        </div>
      )}

      {/* ═══ PHASE 3: ENCRYPTION ANIMATION ═══ */}
      {phase === 'encryption' && (
        <div className="flex flex-col items-center justify-center gap-8">
          {/* Encryption Box Animation */}
          <div className="relative w-40 h-40">
            {/* Rotating encryption box */}
            <div
              className="absolute inset-0 border-2 border-yellow-500/40"
              style={{
                animation: 'spin 3s linear infinite',
              }}
            />
            <div
              className="absolute inset-2 border border-red-500/30"
              style={{
                animation: 'spin 2s linear reverse infinite',
              }}
            />

            {/* Center dots converging to line */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 200 200"
              style={{
                animation: 'fadeIn 1.5s ease',
              }}
            >
              {/* Particles converging */}
              {[...Array(12)].map((_, i) => {
                const angle = (i / 12) * Math.PI * 2;
                const startX = 100 + 80 * Math.cos(angle);
                const startY = 100 + 80 * Math.sin(angle);
                const endX = 100;
                const endY = 100;

                return (
                  <circle
                    key={i}
                    cx={startX}
                    cy={startY}
                    r="2"
                    fill="#f0c16b"
                    opacity="0.8"
                    style={{
                      animation: `particleConverge 2s ease-in-out infinite ${(i * 67)}ms`,
                    }}
                  />
                );
              })}

              {/* Center line */}
              <line
                x1="50"
                y1="100"
                x2="150"
                y2="100"
                stroke="#da1818"
                strokeWidth="2"
                opacity="0.5"
                style={{
                  animation: 'lineGrow 1.5s ease-out',
                }}
              />
            </svg>
          </div>

          <div className="text-center space-y-3">
            <p className="premium-label text-sm">INITIALIZING SECURE CHANNEL</p>
            <p className="text-xs text-white/50 font-mono">
              [████████░░] 80%
            </p>
          </div>
        </div>
      )}

      {/* ═══ ANIMATIONS ═══ */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes particleConverge {
          0%, 100% {
            opacity: 0.2;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes lineGrow {
          from {
            x1: 90;
            x2: 110;
            opacity: 0;
          }
          to {
            x1: 50;
            x2: 150;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}


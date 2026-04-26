import React, { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { useGameSystem } from '../hooks/useGameSystem';
import { GAME_CONTENT } from '../config/gameContent';
import { validateRound2 } from '../lib/apiClient';

const PDF_DOWNLOAD_URL = GAME_CONTENT.round2.pdfDownloadUrl;
const NETWORK_SCAN_MESSAGES = GAME_CONTENT.round2.networkScanMessages;

export default function Round2({ onComplete }) {
  const { credentials, user } = useSimulation();

  // State
  const [connectionPhase, setConnectionPhase] = useState('initializing'); // 'initializing' → 'success' → 'decrypted'
  const [statusMessage, setStatusMessage] = useState('Initializing connection...');
  const [showHiddenMessage, setShowHiddenMessage] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [extractedKey, setExtractedKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { cooldown, setCooldown } = useGameSystem(user?.teamName);

  // Cooldown logic is now handled in useGameSystem

  // ─── PHASE 1: Connect to WiFi ───
  useEffect(() => {
    if (connectionPhase === 'initializing') {
      const messages = NETWORK_SCAN_MESSAGES;

      let step = 0;
      const interval = setInterval(() => {
        if (step < messages.length) {
          setStatusMessage(messages[step]);
          step++;
        } else {
          clearInterval(interval);
          setConnectionPhase('success');
          setStatusMessage('✓ CONNECTED TO NETWORK');
        }
      }, 800);

      return () => clearInterval(interval);
    }
  }, [connectionPhase]);

  const handleDownloadPDF = () => {
    const link = document.createElement('a');
    link.href = PDF_DOWNLOAD_URL;
    link.download = 'ORT.pdf';
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setPdfDownloaded(true);
    setConnectionPhase('decrypted');
  };

  const handleKeySubmit = async (e) => {
    e.preventDefault();

    if (!extractedKey.trim()) {
      setKeyError('Enter the key extracted from the PDF');
      return;
    }

    try {
      setIsSubmitting(true);
      await validateRound2(extractedKey.toUpperCase().trim());
      setKeySuccess(true);
      setKeyError('');
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
      setKeyError(`❌ ${msg}`);
      setExtractedKey('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-8 p-6" style={{ background: 'rgba(0,0,0,0.1)' }}>
      {/* ═══ HEADER ═══ */}
      <div className="space-y-2">
        <h1 className="premium-heading text-3xl">ROUND 2: NETWORK INFILTRATION</h1>
        <p className="premium-label" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
          MISSION: ESTABLISH SECURE CONNECTION → RETRIEVE ENCRYPTED BRIEFING → EXTRACT TERMINAL KEY
        </p>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 grid grid-cols-2 gap-8 min-h-0">

        {/* ─────────────────────────────────────────────────────────
            LEFT: CONNECTION & NETWORK STATUS
            ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Network Status Panel */}
          <div className="premium-glass-card p-6 rounded-lg space-y-4">
            <div className="premium-label">NETWORK STATUS</div>

            {/* Status Indicator */}
            <div className="space-y-3">
              {['SSID_SCAN', 'AUTH_HANDSHAKE', 'ENCRYPTION_LEVEL'].map((item, idx) => (
                <div key={item} className="flex items-center gap-3">
                  <div
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                      background:
                        connectionPhase !== 'initializing'
                          ? '#10b981'
                          : idx === 0
                          ? '#f0c16b'
                          : 'rgba(255, 255, 255, 0.2)',
                      boxShadow:
                        connectionPhase !== 'initializing'
                          ? '0 0 8px #10b981'
                          : '',
                    }}
                  />
                  <span className="text-xs font-mono text-white/60">{item}</span>
                </div>
              ))}
            </div>

            {/* Connection Message */}
            <div
              className="p-3 rounded-lg text-xs font-mono text-center transition-all"
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: connectionPhase === 'success' ? '#10b981' : '#f0c16b',
              }}
            >
              {statusMessage}
            </div>
          </div>

          {/* Network Details */}
          <div className="premium-glass-card p-4 rounded-lg">
            <div className="premium-label mb-3">NETWORK INFORMATION</div>
            <div className="space-y-2 text-xs font-mono text-white/70">
              <div>
                <span className="opacity-60">SSID:</span> <span className="text-yellow-500">RCB_VAULT_NET</span>
              </div>
              <div>
                <span className="opacity-60">Security:</span> <span className="text-green-400">WPA3-Enterprise</span>
              </div>
              <div>
                <span className="opacity-60">Signal:</span> <span className="text-green-400">████████░░ 85%</span>
              </div>
              <div>
                <span className="opacity-60">Frequency:</span> <span className="text-blue-400">2.4GHz</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────
            RIGHT: BRIEFING DOWNLOAD & KEY EXTRACTION
            ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Briefing Download Panel */}
          <div className="premium-glass-card p-6 rounded-lg flex-1 flex flex-col">
            <div className="premium-label mb-4">ENCRYPTED BRIEFING</div>

            {connectionPhase === 'initializing' && (
              <div className="flex-1 flex items-center justify-center text-center">
                <p className="text-xs text-white/50 font-mono">Waiting for connection...</p>
              </div>
            )}

            {connectionPhase !== 'initializing' && (
              <>
                {/* Hidden Message Reveal */}
                {!showHiddenMessage && (
                  <p className="text-sm leading-relaxed text-white/80 mb-4 font-mono">
                    A secure briefing document has been prepared with a backend-managed password.
                    <br />
                    <span className="text-yellow-500 font-bold">[REDACTED SERVER-SIDE]</span>
                  </p>
                )}

                {pdfDownloaded && (
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
                    <div className="premium-label text-green-400 mb-2">✓ PDF EXTRACTED</div>
                    <p className="text-xs text-white/70 font-mono leading-relaxed">
                      Briefing contains a hidden terminal access key. 
                      <br />
                      Password for PDF: <span className="text-yellow-500 font-bold">[REDACTED SERVER-SIDE]</span>
                      <br />
                      <br />
                      Decrypt the PDF and extract the TERMINAL ACCESS KEY from hidden metadata.
                    </p>
                  </div>
                )}

                {/* Download Button */}
                {!pdfDownloaded && (
                  <button
                    onClick={handleDownloadPDF}
                    className="premium-button w-full py-3 px-4 rounded-lg text-sm mb-4"
                    style={{ marginTop: 'auto' }}
                  >
                    📥 DOWNLOAD ENCRYPTED BRIEFING
                  </button>
                )}

                {/* Key Input Form */}
                {pdfDownloaded && (
                  <form onSubmit={handleKeySubmit} className="space-y-3 mt-4">
                    <div>
                      <label className="premium-label block mb-2">TERMINAL ACCESS KEY</label>
                      <input
                        type="password"
                        value={extractedKey}
                        onChange={(e) => setExtractedKey(e.target.value)}
                        placeholder="Extract from PDF and enter here..."
                        className="premium-input w-full px-3 py-2 rounded-lg text-xs"
                        disabled={keySuccess || isSubmitting || cooldown > 0}
                      />
                    </div>

                    {keyError && (
                      <p className="premium-error text-xs">{keyError}</p>
                    )}

                    {keySuccess && (
                      <p className="text-xs text-green-400 font-mono animate-pulse">
                        ✓ KEY VERIFIED - PROCEEDING TO ROUND 3...
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={keySuccess || isSubmitting || cooldown > 0}
                      className={`premium-button w-full py-2 px-3 text-xs rounded-lg ${cooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {keySuccess 
                        ? '✓ AUTHENTICATED' 
                        : isSubmitting 
                          ? 'VALIDATING...' 
                          : cooldown > 0 
                            ? `LOCKED: ${cooldown}s` 
                            : 'SUBMIT KEY'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Instructions */}
          {connectionPhase !== 'initializing' && (
            <div className="bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border border-blue-500/20 rounded-lg p-4 text-xs text-white/70 font-mono leading-relaxed">
              <strong className="text-cyan-400">Instructions:</strong>
              <br />
              1. Download the encrypted briefing PDF
              <br />
              2. The PDF password is shown above
              <br />
              3. Extract the hidden "Terminal Access Key" from the PDF
              <br />
              4. Enter the key above to unlock Round 3
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

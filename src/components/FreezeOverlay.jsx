import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function FreezeOverlay({ isFrozen, expiryTime }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!isFrozen || !expiryTime) {
      setTimeLeft(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((expiryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isFrozen, expiryTime]);

  return (
    <AnimatePresence>
      {isFrozen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto"
        >
          {/* Glitchy Red Background Effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_red_0%,_transparent_70%)] animate-pulse" />
          </div>

          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="text-center p-8 border-2 border-red-600 bg-red-950/20 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.3)] max-w-md w-full"
          >
            <div className="mb-6">
              <svg 
                className="w-20 h-20 mx-auto text-red-600 animate-pulse" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
                />
              </svg>
            </div>

            <h1 className="text-4xl font-black text-red-500 tracking-tighter mb-2 italic">
              SYSTEM FROZEN
            </h1>
            <p className="text-red-400 font-mono text-sm tracking-widest uppercase mb-8">
              Admin Lockdown in Progress
            </p>

            <div className="space-y-4">
              <div className="bg-red-950/40 p-4 rounded border border-red-900/50">
                <span className="block text-xs text-red-700 uppercase font-bold tracking-widest mb-1">
                  Time Remaining
                </span>
                <span className="text-5xl font-mono font-black text-red-500 tabular-nums">
                  {timeLeft > 0 ? `${timeLeft}s` : 'WAITING...'}
                </span>
              </div>

              <div className="text-[10px] text-red-900 font-mono uppercase tracking-[0.3em] mt-4">
                Attempts to bypass will be logged // Unauthorized access denied
              </div>
            </div>
          </motion.div>

          {/* Scrolling background text */}
          <div className="absolute bottom-10 left-0 right-0 overflow-hidden whitespace-nowrap opacity-10 pointer-events-none">
            <div className="animate-marquee inline-block text-red-600 font-mono text-xs">
              ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED ACCESS_DENIED
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

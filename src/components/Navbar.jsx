import React from 'react';
import SuperCards from './SuperCards';
import Leaderboard from './Leaderboard';

export default function Navbar({ codename, onLogout }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-[120] flex items-center justify-between px-4 py-3 sm:px-6"
      style={{
        background: 'rgba(0,0,0,0.45)',
        borderBottom: '1px solid rgba(255,0,0,0.16)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-[#f0c16b]">
        Logged in as: <span className="text-white">{codename || 'INVESTIGATOR'}</span>
      </p>

      <div className="flex items-center gap-2 sm:gap-3">
        <SuperCards />
        <Leaderboard />
        <button
          type="button"
          onClick={onLogout}
          className="rounded-md border border-[#da1818] bg-[rgba(218,24,24,0.14)] px-4 py-2 text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#ffd6d6] transition hover:bg-[rgba(218,24,24,0.28)]"
        >
          Logout
        </button>
      </div>
    </header>
  );
}

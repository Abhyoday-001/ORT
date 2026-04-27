import React, { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { fetchLeaderboard, fetchLeaderboardVisibility } from '../lib/apiClient';

export default function Leaderboard() {
  const { user } = useSimulation();
  const [isOpen, setIsOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadLeaderboard = async (isFirstLoad = false) => {
      try {
        if (isFirstLoad) setLoading(true);
        const result = await fetchLeaderboard();
        setTeams(result.leaderboard || []);
      } catch (error) {
        console.error('Failed to load leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadVisibility = async () => {
      try {
        const result = await fetchLeaderboardVisibility();
        setIsVisible(Boolean(result.visible));
      } catch (error) {
        console.error('Failed to load leaderboard visibility:', error);
      }
    };

    loadLeaderboard(true);
    loadVisibility();
    const timer = setInterval(() => loadLeaderboard(false), 1000);
    const visibilityTimer = setInterval(loadVisibility, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(visibilityTimer);
    };
  }, []);

  const topTeams = Array.isArray(teams) ? teams.slice(0, 5) : [];
  const myTeamEntry = Array.isArray(teams) ? teams.find((t) => t.team_id === user?.teamName) : null;
  const displayedTeams =
    myTeamEntry && !topTeams.some((t) => t.team_id === myTeamEntry.team_id)
      ? [...topTeams, myTeamEntry]
      : topTeams;

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!isVisible}
        className={`px-3 py-1.5 rounded border uppercase tracking-[0.15em] text-xs transition-all ${
          isVisible
            ? 'border-emerald-500/40 bg-emerald-900/20 text-emerald-300 hover:bg-emerald-500/15'
            : 'border-white/20 bg-white/5 text-white/40 cursor-not-allowed'
        }`}
      >
        📊 LEADERBOARD {!isVisible && '(LOCKED)'}
      </button>

      {isOpen && isVisible && (
        <>
          {/* click-away overlay */}
          <div
            className="fixed inset-0 z-[149] bg-black/35"
            onClick={() => setIsOpen(false)}
          />

          {/* tray popup (participant view: top 5 only) */}
          <aside className="fixed left-3 top-[4.25rem] z-[150] w-[min(560px,calc(100vw-1.5rem))] rounded-2xl border border-emerald-500/25 bg-black/75 backdrop-blur-md shadow-xl shadow-emerald-500/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Unlocked</p>
                <h2 className="truncate text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                  Live Leaderboard
                </h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10"
                type="button"
              >
                Close
              </button>
            </div>

            <div className="px-4 py-3">
              {loading ? (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Loading…</p>
              ) : displayedTeams.length === 0 ? (
                <p className="text-xs text-white/50">No teams yet</p>
              ) : (
                <div className="space-y-2">
                  {displayedTeams.map((team, idx) => (
                    <div
                      key={team.id || team.team_id}
                      className={`flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs ${
                        user?.id === team.id ? 'bg-emerald-500/10 border-emerald-500/20' : ''
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <span className={`w-8 shrink-0 text-[11px] font-black ${
                          idx === 0 ? 'text-yellow-300' : idx === 1 ? 'text-cyan-300' : idx === 2 ? 'text-rose-300' : 'text-white/60'
                        }`}>
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-emerald-200">{team.team_id}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
                            team.online ? 'text-emerald-300' : 'text-white/40'
                          }`}>
                            {team.online ? 'ONLINE' : 'OFFLINE'}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] text-white/75 font-semibold">
                        {Math.max(0, Math.min(100, Number(team.progress_percent ?? 0)))}% completed
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <p className="mt-3 text-[10px] text-white/35 uppercase tracking-[0.18em]">
                Showing top 5 teams{myTeamEntry && !topTeams.some((t) => t.team_id === myTeamEntry.team_id) ? ' + your team' : ''}
              </p>
            </div>
          </aside>
        </>
      )}
    </>
  );
}

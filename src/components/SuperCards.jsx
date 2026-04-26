import React, { useState, useEffect } from 'react';
import { useSimulation } from '../context/SimulationContext';
import { fetchWonCards } from '../lib/apiClient';

export default function SuperCards() {
  const { user } = useSimulation();
  const [wonCards, setWonCards] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadWonCards = async () => {
      try {
        setLoading(true);
        const result = await fetchWonCards();
        setWonCards(result.cards || []);
        setError('');
      } catch (error) {
        console.error('Failed to load won cards:', error);
        setWonCards([]);
        setError(error?.message || 'Unable to load super cards');
      } finally {
        setLoading(false);
      }
    };

    loadWonCards();
    const timer = setInterval(loadWonCards, 5000);
    return () => clearInterval(timer);
  }, [user?.id]);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative px-3 py-1.5 rounded border border-purple-500/40 bg-purple-900/20 text-xs uppercase tracking-[0.15em] text-purple-300 hover:bg-purple-500/15 transition-all"
      >
        ◆ SUPER CARDS ({wonCards.length})
      </button>

      {isOpen && (
        <>
          {/* click-away overlay */}
          <div
            className="fixed inset-0 z-[149] bg-black/35"
            onClick={() => setIsOpen(false)}
          />

          {/* left tray */}
          <aside className="fixed left-3 top-[4.25rem] z-[150] w-[min(640px,calc(100vw-1.5rem))] rounded-2xl border border-purple-500/25 bg-black/75 backdrop-blur-md shadow-xl shadow-purple-500/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Inventory</p>
                <h2 className="truncate text-sm font-black uppercase tracking-[0.2em] text-purple-300">
                  Super Cards
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
              {loading && (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">Loading…</p>
              )}
              {!loading && error && (
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300">{error}</p>
              )}

              {!loading && wonCards.length === 0 ? (
                <div className="py-2">
                  <p className="text-xs text-white/55">No cards won yet. Win auctions to collect super cards.</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {wonCards.map((card) => (
                    <div
                      key={card.id}
                      className="min-w-[240px] max-w-[240px] shrink-0 rounded-xl border border-purple-500/20 bg-purple-900/10 p-3"
                    >
                      <h3 className="text-sm font-bold text-purple-300 line-clamp-1">{card.card_name}</h3>
                      <p className="mt-1 text-xs text-white/60 line-clamp-2">
                        {card.card_data?.description || card.card_data?.effect_type?.replace(/_/g, ' ')}
                      </p>
                      <div className="mt-2 flex gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${
                          card.card_data?.type === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : card.card_data?.type === 'negative'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {String(card.card_data?.type || 'neutral').toUpperCase()}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                          MIN: {card.card_data?.min_value ?? 0}
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] text-white/40">
                        Won {new Date(card.won_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </>
  );
}

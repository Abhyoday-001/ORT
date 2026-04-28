import React, { useEffect, useState } from 'react';
import { useSimulation } from '../context/SimulationContext';
import {
  fetchAuctionState,
  placeAuctionBid,
} from '../lib/apiClient';

function effectSummary(card) {
  if (!card) return 'No card selected';
  if (card.description) return card.description;
  const value = card.value;
  switch (card.effect_type) {
    case 'add_points': return `Gain ${value} points`;
    case 'deduct_points': return `Lose ${value} points`;
    case 'steal_points': return `Steal up to ${value} points`;
    case 'deduct_target_points': return `Reduce target by ${value}`;
    case 'freeze_target': return `Freeze target for ${card.duration || 0}s`;
    case 'protection': return `Protection for ${card.duration || 0}s`;
    case 'time_bonus': return `Time bonus ${value}s`;
    case 'time_penalty': return `Time penalty ${value}s`;
    default:
      return card.target_type === 'other' ? 'Target required' : `${card.effect_type.replace(/_/g, ' ')}`;
  }
}

function cardBadge(type) {
  if (type === 'positive') return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10';
  if (type === 'negative') return 'text-rose-300 border-rose-400/30 bg-rose-500/10';
  return 'text-cyan-300 border-cyan-400/30 bg-cyan-500/10';
}

export default function AuctionRound() {
  const { user } = useSimulation();
  const [auctionState, setAuctionState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bidInput, setBidInput] = useState('');

  const loadAuctionState = async () => {
    try {
      const nextState = await fetchAuctionState();
      setAuctionState(nextState);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load auction state');
    }
  };

  useEffect(() => {
    let mounted = true;

    const sync = async () => {
      if (!mounted) return;
      await loadAuctionState();
    };

    sync();
    const timer = setInterval(sync, 2500);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const runtime = auctionState?.runtime;
  const me = auctionState?.me;
  const bids = auctionState?.bids || [];
  const isOpen = Boolean(runtime?.active || runtime?.phase === 'targeting' || runtime?.phase === 'reveal');
  const userBid = bids.find((entry) => entry.team_id === me?.id)?.amount || 0;
  const topBid = bids[0] || null;
  const currentCard = runtime?.drawn_card || null;

  if (!isOpen) return null;

  const handleBid = async (event) => {
    event.preventDefault();
    const amount = Number(bidInput);
    if (!Number.isFinite(amount) || amount <= 0 || loading) return;

    setLoading(true);
    setError('');
    try {
      await placeAuctionBid(amount);
      setBidInput('');
      await loadAuctionState();
    } catch (err) {
      setError(err.message || 'Failed to place bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[950] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,6,23,0.92))] backdrop-blur-md p-2 sm:p-3">
      <div className="mx-auto flex h-[calc(100vh-1rem)] max-w-7xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-black/60 shadow-[0_0_80px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-yellow-400/30 bg-yellow-400/10 text-[0.5rem] font-black tracking-[0.3em] text-yellow-200">
              AUCTION
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.35em] text-white/40">Live card exchange</p>
              <h2 className="text-lg font-black tracking-[0.12em] text-yellow-300 sm:text-xl" style={{ fontFamily: 'var(--font-heading)' }}>
                ORBITAL AUCTION
              </h2>
            </div>
          </div>
          <div className="text-right text-[10px] font-mono text-white/70">
            <p>STATUS: <span className="text-yellow-300">{(runtime?.phase || 'idle').toUpperCase()}</span></p>
            <p>POINTS: <span className="text-cyan-300">{me?.points ?? 0}</span></p>
            <p>COINS: <span className="text-emerald-300">{me?.coins ?? 'N/A'}</span></p>
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[1.2fr_0.95fr] gap-0 overflow-hidden">
          {/* Card Display Section */}
          <section className="relative min-h-0 overflow-hidden border-b border-white/10 xl:border-b-0 xl:border-r xl:border-white/10 p-3 sm:p-4 flex flex-col">
            <div className="mb-3 flex flex-wrap gap-2 text-[9px] font-mono uppercase tracking-[0.22em] text-white/60">
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">Top bid {topBid ? `${topBid.team_code} / ${topBid.amount}` : 'none'}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">Your bid {userBid || 0}</span>
            </div>

            {/* Static Card Display */}
            <div className="flex-1 flex flex-col items-center justify-center min-h-0">
              {currentCard ? (
                <div className="w-full max-w-sm flex flex-col items-center gap-4">
                  {/* Card Visual */}
                  <div className="w-full rounded-2xl border-2 border-yellow-400/40 bg-gradient-to-b from-yellow-900/30 to-yellow-950/20 p-8 shadow-lg shadow-yellow-500/20">
                    <div className="text-center space-y-3">
                      <h3 className="text-2xl font-black text-yellow-200" style={{ fontFamily: 'var(--font-heading)' }}>
                        {currentCard.name}
                      </h3>
                      <p className="text-sm text-yellow-300/80">{effectSummary(currentCard)}</p>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs uppercase tracking-[0.15em]">
                        <span className={`rounded-full border px-3 py-1 ${cardBadge(currentCard.type)}`}>
                          {currentCard.type}
                        </span>
                        <span className="rounded-full border border-yellow-500/50 bg-yellow-500/10 px-3 py-1 text-yellow-300 font-bold">
                          MIN: {currentCard.min_value}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Stats */}
                  <div className="grid grid-cols-3 gap-2 w-full text-[10px] text-white/70">
                    <div className="rounded border border-white/10 bg-white/5 px-2 py-2 text-center">
                      <p className="text-white/40">WINNER</p>
                      <p className="text-emerald-300 font-bold">{runtime?.winner_team_id ? 'DECIDED' : 'PENDING'}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/5 px-2 py-2 text-center">
                      <p className="text-white/40">WINNING BID</p>
                      <p className="text-cyan-300 font-bold">{runtime?.winning_bid || 0}</p>
                    </div>
                    <div className="rounded border border-white/10 bg-white/5 px-2 py-2 text-center">
                      <p className="text-white/40">PHASE</p>
                      <p className="text-yellow-300 font-bold">{runtime?.phase?.toUpperCase() || 'IDLE'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-6xl opacity-20">🎴</div>
                  <h3 className="text-xl font-bold text-white/60">CARD IS YET TO DISPLAY</h3>
                  <p className="text-sm text-white/40">Waiting for admin to select a card...</p>
                </div>
              )}

              {error && <p className="mt-3 text-xs font-mono text-red-300">{error}</p>}
            </div>
          </section>

          {/* Bidding Section */}

          <section className="flex min-h-0 flex-col gap-3 overflow-hidden p-3 sm:p-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-[9px] uppercase tracking-[0.28em] text-white/45">Bidding terminal</p>
              {runtime?.phase === 'bidding' && currentCard ? (
                <form onSubmit={handleBid} className="mt-2 space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-yellow-200/70">
                    Next Bid Must Be: <span className="text-white font-bold">{Math.min(25000, Math.max(currentCard?.min_value || 0, (topBid?.amount || 0) + (topBid ? 500 : 0)))}</span> { (topBid?.amount >= 24500) && '(Max Cap: 25000)' }
                  </label>
                  <input
                    value={bidInput}
                    onChange={(event) => setBidInput(event.target.value)}
                    type="number"
                    max="25000"
                    className="premium-input w-full rounded-lg px-3 py-2 text-sm"
                    placeholder={topBid?.amount >= 25000 ? "Tie at 25000" : `Min. ${Math.min(25000, (topBid?.amount || 0) + (topBid ? 500 : currentCard?.min_value || 0))}`}
                  />
                  <button disabled={loading} type="submit" className="premium-button w-full rounded-lg py-2 text-[10px] uppercase tracking-[0.2em] disabled:opacity-60">
                    Place bid
                  </button>
                </form>
              ) : (
                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2 text-[10px] text-white/65">
                  {runtime?.phase === 'targeting'
                    ? 'Card effect target is applied by admin only. Contact admin.'
                    : currentCard
                    ? 'Bidding closed. Awaiting resolution.'
                    : 'Awaiting card display...'}
                </div>
              )}
              <p className="mt-2 text-[9px] text-white/50">Your bid: <span className="text-cyan-300">{userBid}</span></p>
            </div>

            <div className="flex min-h-0 flex-col rounded-xl border border-white/10 bg-black/40 p-3">
              <p className="text-[9px] uppercase tracking-[0.28em] text-white/45">Live bids</p>
              <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {bids.length === 0 && <p className="text-[10px] text-white/45">No bids</p>}
                {bids.map((entry) => (
                  <div key={entry.team_id} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-mono text-white/80">
                    <span>{entry.team_code}</span>
                    <span className={topBid?.team_id === entry.team_id ? 'text-emerald-300' : 'text-cyan-300'}>{entry.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

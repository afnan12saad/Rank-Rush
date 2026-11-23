import { useEffect, useState } from 'react';
import { Clock, Star, Users } from 'lucide-react';
import type { RoundState } from '../types/arena';
import { computeRoundPhase, formatCountdown } from '../utils/scoring';

interface RoundTimerBannerProps {
  round: RoundState | null;
  /** Measured server clock offset (server ms minus local ms) from subscribeRoundState. */
  serverOffsetMs?: number;
  variant?: 'banner' | 'projector' | 'compact';
}

// Shared round clock: one countdown for everyone, anchored to server time.
// The database enforces the window; this component only displays it.
export function RoundTimerBanner({
  round,
  serverOffsetMs = 0,
  variant = 'banner',
}: RoundTimerBannerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [
    round?.status,
    round?.presentEndsAtMs,
    round?.rateEndsAtMs,
  ]);

  const snap = computeRoundPhase(round, nowMs + serverOffsetMs);
  if (snap.phase === 'idle' || !round || round.roundNumber === 0) return null;

  const countdown = formatCountdown(snap.remainingSeconds);
  const roundLabel = round.roundName || `Round ${round.roundNumber}`;

  if (variant === 'compact') {
    const compactLabel =
      snap.phase === 'presenting'
        ? `${roundLabel} Presenting`
        : snap.phase === 'rating'
          ? `${roundLabel} Rate Now`
          : snap.phase === 'selecting'
            ? `${roundLabel} Selecting`
            : `${roundLabel} Closed`;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-sm font-medium ${
          snap.phase === 'rating'
            ? 'bg-amber-950/50 text-[#F5B942] border-[#F5B942]/50'
            : 'bg-[#0B1B2E] text-white border-[#1E3A5F]'
        }`}
      >
        <Clock className="w-4 h-4 text-[#F5B942] shrink-0" />
        {(snap.phase === 'presenting' || snap.phase === 'rating') && (
          <span className="font-mono-tabular font-bold text-base">
            {countdown}
          </span>
        )}
        <span className="text-xs text-slate-400">{compactLabel}</span>
      </div>
    );
  }

  if (variant === 'projector') {
    const colorClass =
      snap.phase === 'rating'
        ? 'bg-[#F5B942] text-[#092B59] border-[#F5B942] shadow-[0_0_40px_rgba(245,185,66,0.28)]'
        : snap.phase === 'presenting'
          ? 'bg-[#0B1B2E] text-white border-[#F5B942] shadow-[0_0_48px_rgba(245,185,66,0.22)]'
          : 'bg-[#0F233A] text-slate-200 border-[#1E3A5F]';
    const label =
      snap.phase === 'presenting'
        ? `${roundLabel} | Presentations In Progress`
        : snap.phase === 'rating'
          ? `${roundLabel} | Judges Rate Now`
          : snap.phase === 'selecting'
            ? `${roundLabel} | Judges Are Selecting Teams`
            : `${roundLabel} | Rating Window Closed`;
    return (
      <div
        role="status"
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-50 w-72 sm:w-80 flex items-center gap-4 px-5 py-4 rounded-2xl border-2 shadow-2xl transition-colors ${colorClass}`}
      >
        {snap.phase === 'rating' ? (
          <Star className="w-8 h-8 shrink-0" />
        ) : (
          <Clock className="w-8 h-8 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold opacity-90 leading-tight">
            {label}
          </div>
          <div className="font-mono-tabular text-4xl sm:text-5xl font-bold leading-none mt-1.5 tracking-wide">
            {snap.phase === 'presenting' || snap.phase === 'rating'
              ? countdown
              : snap.phase === 'selecting'
                ? 'Selecting'
                : 'Closed'}
          </div>
        </div>
      </div>
    );
  }

  const bannerClass =
    snap.phase === 'rating'
      ? 'bg-amber-950/70 border-[#F5B942] text-[#F5B942]'
      : snap.phase === 'presenting'
        ? 'bg-[#0B1B2E] border-[#24436B] text-white'
        : snap.phase === 'selecting'
          ? 'bg-[#0B1B2E] border-[#2563EB]/60 text-slate-100'
          : 'bg-[#0B1B2E] border-[#1E3A5F] text-slate-300';

  const label =
    snap.phase === 'presenting'
      ? `${roundLabel}: presentations in progress`
      : snap.phase === 'rating'
        ? `${roundLabel}: rate your team now`
        : snap.phase === 'selecting'
          ? `${roundLabel}: select your team`
          : `${roundLabel}: rating window closed`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full rounded-xl border px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 ${bannerClass}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {snap.phase === 'rating' ? (
          <Star className="w-5 h-5 shrink-0" />
        ) : snap.phase === 'selecting' ? (
          <Users className="w-5 h-5 shrink-0 text-[#2563EB]" />
        ) : (
          <Clock className="w-5 h-5 shrink-0 text-[#F5B942]" />
        )}
        <span className="text-sm font-semibold truncate">{label}</span>
      </div>
      {(snap.phase === 'presenting' || snap.phase === 'rating') && (
        <span className="font-mono-tabular text-2xl sm:text-3xl font-bold shrink-0">
          {countdown}
        </span>
      )}
    </div>
  );
}

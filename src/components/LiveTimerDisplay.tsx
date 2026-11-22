import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import type { EventSettings } from '../types/arena';
import {
  computeTimerSnapshot,
  formatHmsCountdown,
  splitSecondsToHms,
} from '../utils/scoring';
import { TrophyEmblem } from './TrophyEmblem';

interface LiveTimerDisplayProps {
  settings: EventSettings | null;
  variant?: 'compact' | 'projector' | 'split';
  eventName?: string;
}

export function LiveTimerDisplay({
  settings,
  variant = 'compact',
  eventName,
}: LiveTimerDisplayProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [
    settings?.timerRunning,
    settings?.timerStartedAtMs,
    settings?.timerRemainingSeconds,
  ]);

  const snap = computeTimerSnapshot(settings, nowMs);
  const { hours, minutes, seconds } = splitSecondsToHms(snap.remainingSeconds);
  const hrStr = String(hours).padStart(2, '0');
  const minStr = String(minutes).padStart(2, '0');
  const secStr = String(seconds).padStart(2, '0');
  const formatted = formatHmsCountdown(snap.remainingSeconds);
  const configuredZero = (settings?.timerDurationSeconds ?? 0) === 0;

  const statusLabel = configuredZero && !snap.isRunning
    ? 'Event Timer (00:00:00)'
    : snap.isExpired
      ? 'Event Time Ended'
      : snap.isWarning
        ? 'Final Time Remaining'
        : snap.isRunning
          ? 'Event Time Remaining'
          : 'Event Timer Paused';

  if (variant === 'split') {
    const tileClass =
      configuredZero && !snap.isRunning
        ? 'bg-[#091524] border-[#1F3A5C] text-slate-200'
        : snap.isExpired
          ? 'bg-red-950/85 border-red-500/80 text-red-100'
          : snap.isWarning
            ? 'bg-amber-950/75 border-[#F5B942] text-[#F5B942]'
            : 'bg-[#091524] border-[#24436B] text-white';

    return (
      <div
        className="w-full max-w-xl mx-auto rounded-xl border border-[#F5B942]/35 bg-[#0A1829] px-5 sm:px-8 py-5 shadow-xl shadow-black/35 relative overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% 0%, rgba(245, 185, 66, 0.16) 0%, rgba(10, 24, 41, 0) 68%)',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1D3554]">
          <div className="flex items-center gap-3 min-w-0">
            <TrophyEmblem tier="gold" className="w-9 h-9 shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-300">
                Whole Event Timer
              </div>
              <div className="text-sm sm:text-base font-display font-bold text-[#F5B942] truncate">
                {eventName || settings?.eventName || 'Rank Rush'}
              </div>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
              snap.isRunning
                ? 'bg-[#16A34A]/20 text-[#4ADE80]'
                : snap.isExpired && !configuredZero
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-[#122640] text-slate-300'
            }`}
          >
            {snap.isRunning
              ? 'Live Countdown'
              : configuredZero
                ? 'Ready (00:00:00)'
                : snap.isExpired
                  ? 'Completed'
                  : 'Paused'}
          </span>
        </div>

        <div className="pt-4 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 w-full">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#F5B942]/45" />
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <Clock className="w-3.5 h-3.5 text-[#F5B942]" />
              <span>{statusLabel}</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#F5B942]/45" />
          </div>

          <div
            aria-label={`Event countdown ${formatted}`}
            className="flex items-center justify-center gap-2 sm:gap-3"
          >
            {[
              { value: hrStr, label: 'Hours' },
              { value: minStr, label: 'Minutes' },
              { value: secStr, label: 'Seconds' },
            ].map((unit, idx) => (
              <div key={unit.label} className="flex items-center gap-2 sm:gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-lg border font-mono-tabular text-2xl sm:text-3xl font-bold flex items-center justify-center shadow-inner ${tileClass}`}
                  >
                    {unit.value}
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 mt-1">
                    {unit.label}
                  </span>
                </div>
                {idx < 2 && (
                  <span className="font-mono-tabular text-xl font-bold text-[#F5B942] -mt-4">
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'projector') {
    const colorClass =
      configuredZero && !snap.isRunning
        ? 'bg-[#0F233A] text-white border-[#1E3A5F]'
        : snap.isExpired
          ? 'bg-red-600 text-white border-red-500'
          : snap.isWarning
            ? 'bg-[#F5B942] text-[#092B59] border-[#F5B942]'
            : 'bg-[#0F233A] text-white border-[#1E3A5F]';

    return (
      <div
        className={`inline-flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-colors ${colorClass}`}
      >
        <Clock className="w-6 h-6 shrink-0" />
        <div>
          <div className="text-xs font-semibold opacity-85">{statusLabel}</div>
          <div className="font-mono-tabular text-3xl sm:text-4xl font-bold leading-none mt-1">
            {formatted}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-sm font-medium ${
        configuredZero && !snap.isRunning
          ? 'bg-[#0B1B2E] text-white border-[#1E3A5F]'
          : snap.isExpired
            ? 'bg-red-950/60 text-red-200 border-red-500/50'
            : snap.isWarning
              ? 'bg-amber-950/50 text-[#F5B942] border-[#F5B942]/50'
              : 'bg-[#0B1B2E] text-white border-[#1E3A5F]'
      }`}
    >
      <Clock className="w-4 h-4 text-[#F5B942] shrink-0" />
      <span className="font-mono-tabular font-bold text-base">{formatted}</span>
      <span className="text-xs text-slate-400">
        {configuredZero && !snap.isRunning
          ? 'Event Timer'
          : snap.isExpired
            ? 'Ended'
            : snap.isRunning
              ? 'Live'
              : 'Paused'}
      </span>
    </div>
  );
}

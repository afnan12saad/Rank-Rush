import { useEffect, useRef, useState } from 'react';
import { MAX_TOTAL_SCORE } from '../utils/scoring';
import { ArrowUp, Crown, Star } from 'lucide-react';
import { MotionConfig, animate, motion, useReducedMotion } from 'motion/react';
import type { LeaderboardEntry, Team } from '../types/arena';
import { TrophyEmblem } from './TrophyEmblem';

interface PodiumShowcaseProps {
  entries: LeaderboardEntry[];
  teams?: Team[];
  showProjectTitle?: boolean;
  subtitle?: string;
}

/** Counts a score from its previous value to the new one. Shows the final value at once if motion is reduced. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reduce || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => setShown(v),
      onComplete: () => {
        from.current = value;
        setShown(value);
      },
    });
    return () => {
      from.current = shown;
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return (
    <span>
      {shown.toFixed(2)}
      {suffix}
    </span>
  );
}

/** Teams whose rank improved since the previous update, kept for a few seconds so they can glow. */
function useRisers(entries: LeaderboardEntry[]): Map<string, number> {
  const prev = useRef<Map<string, number> | null>(null);
  const [risers, setRisers] = useState<Map<string, number>>(new Map());
  const key = entries
    .map((e) => `${e.teamId}:${e.submittedCount > 0 ? e.rank : 0}`)
    .join('|');
  useEffect(() => {
    const now = new Map(
      entries.map((e) => [e.teamId, e.submittedCount > 0 ? e.rank : 0]),
    );
    const before = prev.current;
    prev.current = now;
    if (!before) return;
    const up = new Map<string, number>();
    now.forEach((rank, id) => {
      const old = before.get(id);
      if (rank > 0 && old !== undefined && old > 0 && rank < old) up.set(id, old - rank);
    });
    if (up.size === 0) return;
    setRisers(up);
    const t = setTimeout(() => setRisers(new Map()), 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return risers;
}

function formatOrdinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}

export function PodiumShowcase({
  entries,
  teams = [],
  showProjectTitle = true,
  subtitle = 'Teams ranked 1st and 2nd (ties share a rank) are highlighted by their live average rating out of 25.',
}: PodiumShowcaseProps) {
  const risers = useRisers(entries);
  if (entries.length === 0) {
    return null;
  }

  const teamLogoMap = new Map(teams.map((t) => [t.id, t.logoUrl]));
  // Podium = every team ranked 1st or 2nd. Teams tied for a podium rank all
  // stand on the podium, so a tie never favours one team. With no ratings yet,
  // fall back to the first two entries.
  const ranked = entries.filter((e) => e.submittedCount > 0 && e.rank <= 2);
  const topTwo = ranked.length > 0 ? ranked : entries.slice(0, 2);
  const topIds = new Set(topTwo.map((e) => e.teamId));
  const rest = entries.filter((e) => !topIds.has(e.teamId));

  // Compute dynamic vertical elevation directly from each team's average rating
  // Higher-rated teams rise noticeably higher; tied teams stand at the exact same level.
  const maxAvg = Math.max(
    ...topTwo.map((e) => (e.submittedCount > 0 ? e.averageRating : 0)),
    0,
  );
  const minAvg = Math.min(
    ...topTwo.map((e) => (e.submittedCount > 0 ? e.averageRating : 0)),
    maxAvg,
  );

  const getSpotLiftPx = (entry: LeaderboardEntry, index: number): number => {
    if (entry.submittedCount === 0) return 0;
    const baseByScore = (entry.averageRating / MAX_TOTAL_SCORE) * 44;
    if (topTwo.length >= 2 && topTwo.every((e) => e.rank === topTwo[0].rank)) {
      return Math.round(baseByScore + 18);
    }
    const gapBoost =
      maxAvg > minAvg
        ? ((entry.averageRating - minAvg) / Math.max(0.01, maxAvg - minAvg)) *
          26
        : index === 0
          ? 20
          : 0;
    return Math.round(baseByScore + gapBoost);
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="space-y-10">
      {/* Top 2 Spotlight Stage (inspired by leader_1ae5b02a.webp) */}
      <section aria-label="Top Two Winning Teams" className="pt-2">
        <div
          className={`grid grid-cols-1 gap-6 sm:gap-10 mx-auto items-end ${
            topTwo.length >= 3
              ? 'md:grid-cols-3 max-w-5xl'
              : 'md:grid-cols-2 max-w-3xl'
          }`}
        >
          {topTwo.map((item, index) => {
            const isGold = index === 0 || item.rank === 1;
            const logoUrl = teamLogoMap.get(item.teamId);
            const liftPx = getSpotLiftPx(item, index);
            const displayRank = item.submittedCount > 0 ? item.rank : index + 1;

            return (
              <motion.div
                key={item.teamId}
                layout="position"
                initial={{ opacity: 0, y: 90, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 140,
                  damping: 16,
                  delay: index * 0.12,
                }}
                className="flex flex-col items-center relative"
                style={{ paddingBottom: `${liftPx}px` }}
              >
                {risers.has(item.teamId) && (
                  <motion.div
                    aria-hidden="true"
                    className="absolute inset-x-2 top-2 bottom-0 rounded-2xl pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: [0, 0.9, 0.35, 0.9, 0],
                      boxShadow: [
                        '0 0 0px rgba(245,185,66,0)',
                        '0 0 60px rgba(245,185,66,0.75)',
                        '0 0 30px rgba(245,185,66,0.35)',
                        '0 0 60px rgba(245,185,66,0.75)',
                        '0 0 0px rgba(245,185,66,0)',
                      ],
                    }}
                    transition={{ duration: 4, ease: 'easeInOut' }}
                  />
                )}
                {risers.has(item.teamId) && (
                  <motion.div
                    className="mb-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F5B942] text-[#071422] text-xs font-bold shadow-lg"
                    initial={{ opacity: 0, y: 10, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.3 }}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                    Moving up
                  </motion.div>
                )}
                {/* Vertical Spotlight Cone */}
                <div
                  className="w-full max-w-[300px] pt-5 pb-3 px-4 flex flex-col items-center text-center rounded-t-2xl"
                  style={{
                    background: isGold
                      ? 'linear-gradient(180deg, rgba(245, 185, 66, 0) 0%, rgba(245, 185, 66, 0.08) 55%, rgba(245, 185, 66, 0.22) 100%)'
                      : 'linear-gradient(180deg, rgba(16, 185, 129, 0) 0%, rgba(16, 185, 129, 0.08) 55%, rgba(16, 185, 129, 0.22) 100%)',
                  }}
                >
                  {/* Crown Crest */}
                  <div
                    className={`mb-2.5 flex items-center justify-center ${
                      isGold ? 'text-[#F5B942]' : 'text-[#10B981]'
                    }`}
                  >
                    <Crown className="w-8 h-8 fill-current" />
                  </div>

                  {/* Circular Team Avatar / Emblem */}
                  <div
                    className={`w-20 h-20 rounded-full p-1 flex items-center justify-center shadow-lg ${
                      isGold
                        ? 'bg-[#091829] ring-2 ring-[#F5B942] shadow-[#F5B942]/20'
                        : 'bg-[#091829] ring-2 ring-[#10B981] shadow-[#10B981]/20'
                    }`}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${item.teamName} logo`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-[#0D1E33] flex items-center justify-center">
                        <TrophyEmblem
                          tier={isGold ? 'gold' : 'silver'}
                          className="w-11 h-11"
                        />
                      </div>
                    )}
                  </div>

                  {/* Team Name & Project Title */}
                  <div className="mt-4 space-y-1 min-h-[54px] flex flex-col justify-center">
                    <div className="flex items-center justify-center gap-2">
                      <h3 className="text-lg sm:text-xl font-display font-bold text-white">
                        {item.teamName}
                      </h3>
                      {item.isTied && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                          Tied
                        </span>
                      )}
                    </div>
                    {showProjectTitle && (
                      <p className="text-xs text-slate-300 line-clamp-2 max-w-[240px] mx-auto">
                        {item.projectTitle}
                      </p>
                    )}
                  </div>

                  {/* Rank Circle Badge */}
                  <div
                    className={`mt-3 w-10 h-10 rounded-full font-mono-tabular text-base font-bold flex items-center justify-center shadow-md ${
                      isGold
                        ? 'bg-[#C89328] text-[#071422] ring-2 ring-[#FDE68A]/70'
                        : 'bg-[#109B72] text-white ring-2 ring-[#6EE7B7]/60'
                    }`}
                  >
                    {displayRank}
                  </div>
                </div>

                {/* Glowing Horizontal Score Plinth Bar */}
                <div
                  className={`w-full max-w-[300px] rounded-lg px-4 py-3 text-center shadow-lg border ${
                    isGold
                      ? 'bg-gradient-to-r from-[#4E3A12] via-[#7A5B1C] to-[#4E3A12] border-[#F5B942]/70 text-[#FDE68A]'
                      : 'bg-gradient-to-r from-[#0C3B34] via-[#125C50] to-[#0C3B34] border-[#10B981]/65 text-[#6EE7B7]'
                  }`}
                >
                  <div className="inline-flex items-center justify-center gap-2 font-mono-tabular text-xl sm:text-2xl font-bold">
                    <Star
                      className={`w-5 h-5 shrink-0 ${
                        isGold
                          ? 'fill-[#F5B942] text-[#F5B942]'
                          : 'fill-[#10B981] text-[#10B981]'
                      }`}
                    />
                    <span>
                      {item.submittedCount > 0 ? (
                        <CountUp value={Number(item.averageFormatted)} suffix=" / 25" />
                      ) : (
                        'Pending'
                      )}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-200/85 mt-0.5">
                    {item.submittedCount} / {item.totalJudges} ratings submitted
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Center Callout Heading (matching leader_1ae5b02a.webp) */}
        <div className="text-center max-w-xl mx-auto mt-8 space-y-1.5">
          <h3 className="text-base sm:text-lg font-display font-bold text-[#F5B942]">
            Official Rank Rush Standings
          </h3>
          <p className="text-xs sm:text-sm text-slate-400">{subtitle}</p>
        </div>
      </section>

      {/* Remaining Teams Ranked List (Rank 3+) */}
      {rest.length > 0 && (
        <section
          aria-label="Additional Ranked Teams"
          className="max-w-4xl mx-auto space-y-2.5"
        >
          <div className="flex items-center justify-between px-3 pb-1 text-xs font-semibold text-slate-400">
            <div className="flex items-center gap-6">
              <span className="w-8 text-center">Rank</span>
              <span>Team & Project</span>
            </div>
            <div className="flex items-center gap-8">
              <span className="hidden sm:inline">Submissions</span>
              <span className="w-24 text-right">Rating</span>
            </div>
          </div>

          <div className="space-y-2">
            {rest.map((entry) => {
              const logoUrl = teamLogoMap.get(entry.teamId);
              const scorePct =
                entry.submittedCount > 0
                  ? Math.min(100, Math.round((entry.averageRating / MAX_TOTAL_SCORE) * 100))
                  : 0;

              return (
                <motion.div
                  key={entry.teamId}
                  layout="position"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                  style={
                    risers.has(entry.teamId)
                      ? { boxShadow: '0 0 0 1px rgba(245,185,66,0.8), 0 0 24px rgba(245,185,66,0.35)' }
                      : undefined
                  }
                  className="rounded-xl bg-[#0D1A2B] border border-[#1B314E] px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#102238] transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-lg bg-[#13253D] border border-[#233F63] font-mono-tabular text-xs font-bold text-slate-200 flex items-center justify-center shrink-0">
                      {entry.submittedCount > 0 ? entry.rank : '-'}
                    </span>

                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${entry.teamName} logo`}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded-full object-cover shrink-0 bg-[#081422]"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[#142D4C] text-[#F5B942] font-display font-bold text-xs flex items-center justify-center shrink-0">
                        {entry.teamName
                          .replace(/^team\s+/i, '')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold text-sm sm:text-base text-white truncate">
                          {entry.teamName}
                        </span>
                        <span className="text-[11px] font-mono-tabular text-slate-400">
                          {entry.submittedCount > 0
                            ? formatOrdinal(entry.rank)
                            : 'Pending'}
                        </span>
                        {entry.isTied && (
                          <span className="text-[11px] font-semibold text-slate-200 bg-white/10 px-1.5 py-0.5 rounded">
                            Tie
                          </span>
                        )}
                      </div>
                      {showProjectTitle && (
                        <div className="text-xs text-slate-400 truncate">
                          {entry.projectTitle}
                        </div>
                      )}
                      {/* Dynamic rating bar so spot strength scales with rating */}
                      <div className="mt-1.5 w-full max-w-xs h-1.5 bg-[#071422] rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] transition-all duration-700 ease-out"
                          style={{ width: `${scorePct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                    <span className="hidden sm:inline font-mono-tabular text-xs font-semibold text-slate-300">
                      {entry.submittedCount}/{entry.totalJudges}
                    </span>

                    <div className="w-24 text-right font-mono-tabular text-sm sm:text-base font-bold text-[#10B981]">
                      {entry.submittedCount > 0 ? (
                        <CountUp value={Number(entry.averageFormatted)} suffix=" / 25" />
                      ) : (
                        '-'
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}
    </div>
    </MotionConfig>
  );
              }

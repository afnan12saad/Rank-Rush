import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  LogOut,
  Search,
  ShieldAlert,
  Star,
  Users,
} from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { RoundTimerBanner } from '../components/RoundTimerBanner';
import { useArenaAuth } from '../context/ArenaAuthContext';
import {
  selectTeamForRound,
  subscribeMyEvaluations,
  subscribeMyTeamSelection,
  subscribeRoundState,
} from '../services/arenaService';
import type { Evaluation, RoundState, TeamSelection } from '../types/arena';
import { computeRoundPhase } from '../utils/scoring';

type FilterMode = 'all' | 'pending' | 'submitted';

export function JudgeDashboardPage() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    judgeProfile,
    teams,
    settings,
    logoutAll,
  } = useArenaAuth();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [round, setRound] = useState<RoundState | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [mySelection, setMySelection] = useState<TeamSelection | null>(null);
  const [selectingTeamId, setSelectingTeamId] = useState('');
  const [selectError, setSelectError] = useState('');

  useEffect(() => {
    return subscribeRoundState((r, offset) => {
      setRound(r);
      setServerOffsetMs(offset);
    });
  }, []);

  const roundNumber = round?.roundNumber ?? 0;
  useEffect(() => {
    if (!user || !judgeProfile || roundNumber === 0) {
      setMySelection(null);
      return;
    }
    return subscribeMyTeamSelection(user.uid, roundNumber, setMySelection);
  }, [user, judgeProfile, roundNumber]);

  const roundPhase = computeRoundPhase(
    round,
    Date.now() + serverOffsetMs,
  ).phase;

  const handleSelectTeam = async (teamId: string) => {
    if (!judgeProfile) return;
    setSelectError('');
    setSelectingTeamId(teamId);
    try {
      await selectTeamForRound(judgeProfile.id, teamId);
      navigate(`/judge/evaluate/${teamId}`);
    } catch (err) {
      setSelectError(
        err instanceof Error ? err.message : 'Could not select that team.',
      );
    } finally {
      setSelectingTeamId('');
    }
  };

  useEffect(() => {
    if (authReady && (!user || !judgeProfile)) {
      navigate('/judge/login', { replace: true });
    }
  }, [authReady, user, judgeProfile, navigate]);

  useEffect(() => {
    if (!user || !judgeProfile) return;
    return subscribeMyEvaluations(user.uid, (rows) => {
      setEvaluations(rows);
    });
  }, [user, judgeProfile]);

  const evalByTeam = useMemo(() => {
    const map = new Map<string, Evaluation>();
    for (const ev of evaluations) {
      map.set(ev.teamId, ev);
    }
    return map;
  }, [evaluations]);

  const filteredTeams = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return teams.filter((team) => {
      const hasEval = evalByTeam.has(team.id);
      if (filterMode === 'pending' && hasEval) return false;
      if (filterMode === 'submitted' && !hasEval) return false;
      if (!q) return true;
      return (
        team.name.toLowerCase().includes(q) ||
        team.projectTitle.toLowerCase().includes(q)
      );
    });
  }, [teams, evalByTeam, filterMode, searchTerm]);

  if (!authReady || !judgeProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">
          Loading Judge Dashboard...
        </main>
        <SiteFooter />
      </div>
    );
  }

  const completedCount = teams.filter((t) => evalByTeam.has(t.id)).length;
  const totalTeams = teams.length;
  const progressPct =
    totalTeams > 0 ? Math.round((completedCount / totalTeams) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Judge Header Card */}
        <section className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#F5B942]">
              Judge Session | {judgeProfile.email}
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white">
              Welcome, {judgeProfile.name}
            </h1>
            <p className="text-sm text-slate-300">
              Select a participating team below to score it on five criteria
              (0 to 5 each, total out of 25).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <RoundTimerBanner
              round={round}
              serverOffsetMs={serverOffsetMs}
              variant="compact"
            />
            <button
              type="button"
              onClick={() => void logoutAll()}
              className="min-h-[42px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#24436B] bg-[#091829] text-sm font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </section>

        {/* Judge Progress + Submission Status Notice */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-semibold text-white">
                Your Evaluation Progress
              </span>
              <span className="font-mono-tabular font-bold text-[#F5B942]">
                {completedCount} / {totalTeams} Teams Submitted ({progressPct}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#071422] rounded-md overflow-hidden">
              <div
                className="h-full bg-[#16A34A] transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium text-slate-400">
                Rating Window
              </div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  settings?.submissionsOpen === false
                    ? 'text-red-400'
                    : 'text-[#4ADE80]'
                }`}
              >
                {settings?.submissionsOpen === false
                  ? 'Submissions Closed'
                  : 'Open for Evaluation'}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <div>Editing</div>
              <div className="font-semibold text-white">
                {settings?.editingAllowed ? 'Allowed' : 'Locked'}
              </div>
            </div>
          </div>
        </section>

        {/* Shared Round Clock */}
        <RoundTimerBanner round={round} serverOffsetMs={serverOffsetMs} />

        {roundPhase === 'selecting' && !mySelection && (
          <div className="rounded-xl border border-[#2563EB]/60 bg-[#0B1B2E] px-4 py-3 text-sm text-slate-100 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-[#2563EB] shrink-0" />
            Pick the team you are judging in Round {roundNumber} below.
          </div>
        )}
        {selectError && (
          <div
            role="alert"
            className="rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-sm text-red-200 flex items-center gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{selectError}</span>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search teams or project titles..."
              aria-label="Search teams or project titles"
              className="w-full min-h-[44px] pl-10 pr-4 py-2 rounded-lg border border-[#1E3A5F] bg-[#0D1E33] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div
            role="group"
            aria-label="Filter teams by submission status"
            className="inline-flex items-center p-1 bg-[#0B1B2E] border border-[#1E3A5F] rounded-lg self-start sm:self-auto"
          >
            {(
              [
                { key: 'all', label: 'All Teams' },
                { key: 'pending', label: 'Pending' },
                { key: 'submitted', label: 'Submitted' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterMode(tab.key)}
                className={`min-h-[44px] sm:min-h-[36px] px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterMode === tab.key
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Team Selection Grid */}
        {filteredTeams.length === 0 ? (
          <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-10 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <h2 className="text-base font-display font-bold text-white">
              No Matching Teams Found
            </h2>
            <p className="text-sm text-slate-400">
              {teams.length === 0
                ? 'The event administrator has not added participating teams yet.'
                : 'Adjust your search query or status filter to view teams.'}
            </p>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTeams.map((team) => {
              const existingEval = evalByTeam.get(team.id);
              const isMyPick = mySelection?.teamId === team.id;

              return (
                <article
                  key={team.id}
                  className="bg-[#0D1E33] rounded-xl border border-[#1E3A5F] p-5 flex flex-col justify-between gap-5 transition-colors hover:border-[#2C5282]"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {team.logoUrl ? (
                          <img
                            src={team.logoUrl}
                            alt={`${team.name} emblem`}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-lg object-cover shrink-0 bg-[#081422]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#142D4C] text-[#F5B942] font-display font-bold text-sm flex items-center justify-center shrink-0">
                            {team.name
                              .replace(/^team\s+/i, '')
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="text-base font-display font-bold text-white truncate">
                            {team.name}
                          </h2>
                          <div className="text-xs text-slate-400">
                            Team #{team.orderIndex}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                        {team.projectTitle}
                      </h3>
                      {team.description && (
                        <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                          {team.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#183152] space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Your Status</span>
                      {existingEval ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#4ADE80]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Submitted ({existingEval.total ?? `${existingEval.rating} (old 1-5 scale)`}{existingEval.total !== undefined ? '/25' : ''})
                        </span>
                      ) : isMyPick ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#F5B942]">
                          <Star className="w-3.5 h-3.5" />
                          Your Team for Round {roundNumber}
                        </span>
                      ) : (
                        <span className="font-semibold text-slate-300">
                          Not Evaluated
                        </span>
                      )}
                    </div>

                    {existingEval ? (
                      <Link
                        to={`/judge/evaluate/${team.id}`}
                        className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          settings?.editingAllowed
                            ? 'bg-[#102640] border border-[#24436B] text-white hover:bg-[#173355]'
                            : 'bg-[#091829] text-slate-300 hover:bg-[#102640]'
                        }`}
                      >
                        <Star className="w-4 h-4" />
                        {settings?.editingAllowed
                          ? 'Review or Update Rating'
                          : 'View Submitted Rating'}
                      </Link>
                    ) : isMyPick ? (
                      <Link
                        to={`/judge/evaluate/${team.id}`}
                        className={`w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                          roundPhase === 'rating'
                            ? 'bg-[#F5B942] text-[#092B59] hover:bg-[#e5a92e]'
                            : 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
                        }`}
                      >
                        <Star className="w-4 h-4" />
                        {roundPhase === 'rating'
                          ? 'Rate This Team Now'
                          : 'Open Evaluation'}
                      </Link>
                    ) : roundPhase === 'selecting' ? (
                      <button
                        type="button"
                        disabled={selectingTeamId !== ''}
                        onClick={() => void handleSelectTeam(team.id)}
                        className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors bg-[#2563EB] text-white hover:bg-[#1d4ed8] disabled:opacity-50"
                      >
                        <Star className="w-4 h-4" />
                        {selectingTeamId === team.id
                          ? 'Selecting...'
                          : `Select for Round ${roundNumber}`}
                      </button>
                    ) : (
                      <div className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#091829] text-slate-400 border border-[#1E3A5F]">
                        {roundPhase === 'presenting' || roundPhase === 'rating'
                          ? 'Round In Progress'
                          : 'Wait for the Next Round'}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

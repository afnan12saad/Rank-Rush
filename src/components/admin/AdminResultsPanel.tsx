import { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Lock,
  Search,
  Star,
} from 'lucide-react';
import { publishOrHideResults } from '../../services/arenaService';
import { PodiumShowcase } from '../PodiumShowcase';
import type {
  Evaluation,
  EventSettings,
  Judge,
  LeaderboardEntry,
  Team,
} from '../../types/arena';
import {
  exportFullWorkbookXlsx,
  exportLeaderboardCsv,
  exportLeaderboardPdf,
} from '../../utils/exportReports';
import { LegacyRatingsNotice } from './LegacyRatingsNotice';
import { CRITERIA } from '../../utils/scoring';

interface AdminResultsPanelProps {
  leaderboard: LeaderboardEntry[];
  teams: Team[];
  judges: Judge[];
  evaluations: Evaluation[];
  settings: EventSettings;
  totalSubmitted: number;
  totalPossible: number;
  onNotify: (msg: string) => void;
}

export function AdminResultsPanel({
  leaderboard,
  teams,
  judges,
  evaluations,
  settings,
  totalSubmitted,
  totalPossible,
  onNotify,
}: AdminResultsPanelProps) {
  const [auditSearch, setAuditSearch] = useState('');
  const [releaseBusy, setReleaseBusy] = useState(false);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges]);

  const filteredEvaluations = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return evaluations;
    return evaluations.filter((ev) => {
      const teamName = teamMap.get(ev.teamId)?.name ?? '';
      const judge = judgeMap.get(ev.judgeId);
      return (
        ev.judgeId.toLowerCase().includes(q) ||
        (judge?.name.toLowerCase().includes(q) ?? false) ||
        teamName.toLowerCase().includes(q) ||
        ev.comment.toLowerCase().includes(q)
      );
    });
  }, [evaluations, auditSearch, teamMap, judgeMap]);

  const handleToggleRelease = async () => {
    setReleaseBusy(true);
    try {
      const nextPublish = !settings.resultsPublished;
      await publishOrHideResults({
        publish: nextPublish,
        teams,
        judges,
        evaluations,
        settings,
      });
      onNotify(
        nextPublish
          ? 'Final results released! Judges, participants, and public visitors can now view the leaderboard.'
          : 'Final results hidden. Only administrators can view standings.',
      );
    } finally {
      setReleaseBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <LegacyRatingsNotice entries={leaderboard} />
      {/* Release Control Banner */}
      <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              settings.resultsPublished
                ? 'bg-[#16A34A]/20 text-[#4ADE80]'
                : 'bg-[#142D4C] text-[#F5B942]'
            }`}
          >
            {settings.resultsPublished ? (
              <Eye className="w-5 h-5" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-white">
              {settings.resultsPublished
                ? 'Results Released to All Users'
                : 'Admin-Only Standings (Hidden from Judges & Participants)'}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
              {settings.resultsPublished
                ? 'Any judge, participant, or visitor can currently view the official leaderboard and final results.'
                : 'Only administrators can inspect live scores right now. When judging finishes, click Release Final Results so judges and participants can view them.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={releaseBusy}
          onClick={() => void handleToggleRelease()}
          className={`min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors shrink-0 disabled:opacity-60 ${
            settings.resultsPublished
              ? 'border border-[#2B4E7A] bg-[#142D4C] text-white hover:bg-[#1b3a61]'
              : 'bg-[#16A34A] text-white hover:bg-[#15803d]'
          }`}
        >
          {settings.resultsPublished ? (
            <>
              <EyeOff className="w-4 h-4" />
              {releaseBusy ? 'Updating...' : 'Hide Results (Admin Only)'}
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" />
              {releaseBusy ? 'Releasing...' : 'Release Final Results'}
            </>
          )}
        </button>
      </div>

      {/* Top 2 Spotlight & Live Spot Preview (Admin Visible) */}
      {leaderboard.length > 0 && (
        <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl p-6 space-y-5">
          <div className="border-b border-[#183152] pb-3">
            <h2 className="text-base font-display font-bold text-white">
              Top 2 Spotlight & Dynamic Standings Preview
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live visual preview showing how spots elevate according to rating.
            </p>
          </div>
          <PodiumShowcase
            entries={leaderboard}
            teams={teams}
            showProjectTitle
          />
        </div>
      )}

      {/* Export Bar & Admin Private Leaderboard */}
      <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="p-6 bg-[#0D1E33] border-b border-[#1E3A5F] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              Admin Standings & Official Exports
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Live average calculations restricted to administrators until
              released.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                exportFullWorkbookXlsx(
                  leaderboard,
                  teams,
                  judges,
                  evaluations,
                  settings,
                )
              }
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] text-white text-xs font-semibold hover:bg-[#15803d] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => exportLeaderboardCsv(leaderboard, settings)}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-xs font-semibold hover:bg-[#102640] transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() =>
                exportLeaderboardPdf(
                  leaderboard,
                  settings,
                  totalSubmitted,
                  totalPossible,
                )
              }
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D1E33] border-b border-[#1E3A5F] text-xs font-semibold text-slate-400">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Team</th>
                <th className="py-3 px-4">Project Title</th>
                <th className="py-3 px-4 text-right">Sum</th>
                <th className="py-3 px-4 text-right">Submissions</th>
                <th className="py-3 px-4 text-right">Average (/25)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152B46] text-sm">
              {leaderboard.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 px-4 text-center text-slate-400"
                  >
                    No teams registered yet.
                  </td>
                </tr>
              ) : (
                leaderboard.map((entry, idx) => (
                  <tr
                    key={entry.teamId}
                    className={`${
                      idx % 2 === 0 ? 'bg-[#0B1C30]' : 'bg-[#081423]'
                    } hover:bg-[#102742]`}
                  >
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#F5B942]">
                      {entry.submittedCount > 0 ? `#${entry.rank}` : '-'}
                      {entry.isTied && (
                        <span className="ml-1.5 text-xs font-medium text-slate-400">
                          (Tie)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-semibold text-white">
                      {entry.teamName}
                    </td>
                    <td className="py-3 px-4 text-slate-300">
                      {entry.projectTitle}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-300">
                      {entry.ratingSum}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-slate-200">
                      {entry.submittedCount} / {entry.totalJudges}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-bold text-white">
                      {entry.submittedCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="w-4 h-4 fill-[#F5B942] text-[#F5B942]" />
                          {entry.averageFormatted} / 25
                        </span>
                      ) : (
                        'Pending'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Evaluations Audit Log (Admin Only) */}
      <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="p-6 bg-[#0D1E33] border-b border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-display font-bold text-white">
              Individual Judge Submissions ({evaluations.length})
            </h3>
            <p className="text-xs text-slate-400">
              Confidential audit view restricted strictly to administrators.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              placeholder="Filter by judge, team, or comment..."
              className="w-full min-h-[38px] pl-9 pr-3 py-1.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D1E33] border-b border-[#1E3A5F] text-xs font-semibold text-slate-400">
                <th className="py-2.5 px-4">Judge</th>
                <th className="py-2.5 px-4">Team</th>
                <th className="py-2.5 px-4">Rating</th>
                <th className="py-2.5 px-4">Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152B46] text-sm">
              {filteredEvaluations.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 px-4 text-center text-slate-400"
                  >
                    No submitted evaluations match your filter.
                  </td>
                </tr>
              ) : (
                filteredEvaluations.map((ev, idx) => {
                  const judge = judgeMap.get(ev.judgeId);
                  return (
                    <tr
                      key={ev.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-[#0B1C30]' : 'bg-[#081423]'
                      } hover:bg-[#102742]`}
                    >
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-white">
                          {judge?.name || ev.judgeId}
                        </span>
                        {judge?.email && (
                          <span className="block text-xs text-slate-400 font-mono-tabular">
                            {judge.email}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-white">
                        {teamMap.get(ev.teamId)?.name ?? ev.teamId}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular font-bold text-white">
                        {ev.total !== undefined ? `${ev.total} / 25` : `${ev.rating} / 5`}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          {ev.criteria
                            ? `(${CRITERIA.map(({ id }) => ev.criteria?.[id]).join(' + ')})`
                            : '(old 1-5 rating, not in standings)'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-300 max-w-md">
                        {ev.comment || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
              }

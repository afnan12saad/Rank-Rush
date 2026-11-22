import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { LiveTimerDisplay } from '../components/LiveTimerDisplay';
import { PodiumShowcase } from '../components/PodiumShowcase';
import { useArenaAuth } from '../context/ArenaAuthContext';
import {
  DEFAULT_EVENT_SETTINGS,
  subscribeAllEvaluations,
  subscribeAllJudges,
  subscribePublishedLeaderboard,
} from '../services/arenaService';
import type { Evaluation, Judge, PublishedLeaderboard } from '../types/arena';
import { calculateLeaderboard } from '../utils/scoring';

export function FinalResultsPage() {
  const { settings, teams, isAdmin, judgeProfile, publicSummary } =
    useArenaAuth();
  const [adminJudges, setAdminJudges] = useState<Judge[]>([]);
  const [adminEvaluations, setAdminEvaluations] = useState<Evaluation[]>([]);
  const [publishedBoard, setPublishedBoard] =
    useState<PublishedLeaderboard | null>(null);

  // Once the admin releases results, the published standings become readable
  // by everyone; until then this page stays locked for non-admins.
  const resultsPublished = Boolean(settings?.resultsPublished);

  useEffect(() => {
    if (isAdmin || !resultsPublished) {
      setPublishedBoard(null);
      return;
    }
    return subscribePublishedLeaderboard(setPublishedBoard, true);
  }, [isAdmin, resultsPublished]);

  useEffect(() => {
    if (!isAdmin) {
      setAdminJudges([]);
      setAdminEvaluations([]);
      return;
    }
    const unsubJudges = subscribeAllJudges(setAdminJudges);
    const unsubEvals = subscribeAllEvaluations(setAdminEvaluations);
    return () => {
      unsubJudges();
      unsubEvals();
    };
  }, [isAdmin]);

  const adminLiveEntries = useMemo(() => {
    if (!isAdmin) return [];
    const activeCount = adminJudges.filter((j) => j.active).length;
    return calculateLeaderboard(
      teams,
      adminEvaluations,
      activeCount || publicSummary?.totalJudges || 0,
      settings?.tieBreakerMode ?? 'tie',
    );
  }, [
    isAdmin,
    teams,
    adminEvaluations,
    adminJudges,
    publicSummary?.totalJudges,
    settings?.tieBreakerMode,
  ]);

  const eventName = settings?.eventName || DEFAULT_EVENT_SETTINGS.eventName;
  const collegeName =
    settings?.collegeName || DEFAULT_EVENT_SETTINGS.collegeName;

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <p className="text-xs font-semibold text-[#F5B942]">
            Official Event Standings
          </p>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
            {eventName}
          </h1>
          <p className="text-sm text-slate-400">{collegeName}</p>
        </div>

        {/* Whole Event Countdown Card */}
        <div className="flex justify-center">
          <LiveTimerDisplay
            settings={settings}
            variant="split"
            eventName={eventName}
          />
        </div>

        {isAdmin ? (
          <div className="space-y-8 animate-reveal">
            <div className="p-5 rounded-xl bg-[#0D1E33] border border-[#F5B942]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#142D4C] text-[#F5B942] flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-display font-bold text-white">
                    Live Standings (Admin Only)
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                    Only signed-in admins can see these standings. Judges and
                    other users cannot open them.
                  </p>
                </div>
              </div>
            </div>

            {adminLiveEntries.length > 0 ? (
              <PodiumShowcase
                entries={adminLiveEntries}
                teams={teams}
                showProjectTitle
              />
            ) : (
              <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-8 text-center text-sm text-slate-400">
                No teams registered yet (0 Teams, 0 Judges, 0 Ratings).
              </div>
            )}
          </div>
        ) : resultsPublished ? (
          <div className="space-y-8 animate-reveal">
            {publishedBoard && publishedBoard.entries.length > 0 ? (
              <PodiumShowcase
                entries={publishedBoard.entries}
                teams={teams}
                showProjectTitle
              />
            ) : (
              <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-8 text-center text-sm text-slate-400">
                Official results have been released. Standings will appear
                here shortly.
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-xl mx-auto bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-8 sm:p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-lg bg-[#142D4C] text-[#F5B942] flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-display font-bold text-white">
              Results Not Yet Released
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Standings and scores are hidden while judging is underway. Once
              the Event Admin releases the official results, everyone can view
              them here.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-3">
              {judgeProfile && (
                <Link
                  to="/judge/dashboard"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
                >
                  Return to Judge Dashboard
                </Link>
              )}
              <Link
                to="/home"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-sm font-semibold hover:bg-[#102640] transition-colors"
              >
                Return Home
              </Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Calendar,
  Lock,
  MapPin,
  MonitorPlay,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { BrandMark } from '../components/BrandMark';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { LiveTimerDisplay } from '../components/LiveTimerDisplay';
import { useArenaAuth } from '../context/ArenaAuthContext';
import { DEFAULT_EVENT_SETTINGS } from '../services/arenaService';

export function HomePage() {
  const { settings, publicSummary, teams, dataReady, isAdmin, judgeProfile } =
    useArenaAuth();

  const eventName = settings?.eventName || DEFAULT_EVENT_SETTINGS.eventName;
  const collegeName =
    settings?.collegeName || DEFAULT_EVENT_SETTINGS.collegeName;
  const tagline = settings?.tagline || DEFAULT_EVENT_SETTINGS.tagline;
  const venue = settings?.venue || DEFAULT_EVENT_SETTINGS.venue;
  const eventDate = settings?.eventDate || DEFAULT_EVENT_SETTINGS.eventDate;

  const totalJudges = publicSummary?.totalJudges ?? 0;
  const totalTeams = teams.length;
  const totalSubmissions = teams.reduce(
    (sum, t) => sum + (t.submittedCount || 0),
    0,
  );
  // Standings stay admin-only while judging; once the admin releases results,
  // everyone can view them.
  const resultsReleased = Boolean(settings?.resultsPublished);
  const canSeeLeaderboard = isAdmin;

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-[#183152]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#F5B942]">
                <BrandMark className="h-8 w-auto" />
                <span>Smart Project Evaluation System</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight text-white leading-tight [text-wrap:balance]">
                RANK RUSH
              </h1>

              <p className="text-lg sm:text-xl font-display font-semibold text-[#F5B942]">
                {tagline}
              </p>

              <p className="text-base text-slate-300 max-w-2xl leading-relaxed">
                Welcome to the official evaluation portal for{' '}
                <span className="text-white font-semibold">{eventName}</span> at{' '}
                <span className="text-white font-semibold">{collegeName}</span>.
                Judges enter quickly with their name and email to evaluate each
                team on five criteria, each scored 0 to 5 (total out of 25). Rankings remain
                confidential to administrators until final results are released.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link
                  to={judgeProfile ? '/judge/dashboard' : '/judge/login'}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <UserCheck className="w-4 h-4" />
                  {judgeProfile ? 'Open Judge Dashboard' : 'Judge Login'}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to={isAdmin ? '/admin' : '/admin/login'}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#102640] border border-[#24436B] text-white hover:bg-[#173355] text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4 text-[#F5B942]" />
                  {isAdmin ? 'Admin Dashboard' : 'Admin Login'}
                </Link>

                {canSeeLeaderboard && (
                  <Link
                    to={resultsReleased ? '/results' : '/projector'}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#1E3A5F] bg-[#0B1B2E] text-slate-200 hover:bg-[#112640] hover:text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    <MonitorPlay className="w-4 h-4 text-[#F5B942]" />
                    {resultsReleased
                      ? 'View Final Results'
                      : 'Admin Leaderboard Preview'}
                  </Link>
                )}
              </div>
            </div>

            {/* Event Information Summary Card */}
            <div className="lg:col-span-5 bg-[#0D1E33] text-slate-100 rounded-xl border border-[#1E3A5F] p-6 sm:p-7 space-y-5">
              <div className="border-b border-[#183152] pb-4">
                <p className="text-xs font-semibold text-[#F5B942]">
                  Event Information
                </p>
                <h2 className="text-lg font-display font-bold text-white mt-1">
                  {eventName}
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">{collegeName}</p>
              </div>

              <div className="space-y-2.5 text-sm text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#F5B942] shrink-0" />
                  <span>{eventDate}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-[#F5B942] shrink-0" />
                  <span>{venue}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#183152] flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-slate-400">
                  Whole Event Timer
                </span>
                <LiveTimerDisplay settings={settings} variant="compact" />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#183152]">
                <div>
                  <div className="text-xs text-slate-400">Teams</div>
                  <div className="font-mono-tabular text-xl font-bold text-white">
                    {dataReady ? totalTeams : 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Judges</div>
                  <div className="font-mono-tabular text-xl font-bold text-white">
                    {dataReady ? totalJudges : 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Ratings</div>
                  <div className="font-mono-tabular text-xl font-bold text-[#4ADE80]">
                    {dataReady ? totalSubmissions : 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How Evaluation Works */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="max-w-2xl mb-8">
            <h2 className="text-2xl font-display font-bold text-white">
              Streamlined Five-Criteria Evaluation
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-2 leading-relaxed">
              Designed for rapid mobile judging during live college project
              exhibitions, with strict confidentiality until final results release.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-[#1E3A5F] bg-[#0D1E33]">
              <div className="text-xs font-semibold text-[#F5B942] mb-2">
                01. Sign In & Select Team
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">
                Instant Name & Email Entry
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Enter your full name and email address without passwords or ID
                codes, browse participating teams, and select the project you
                are evaluating.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#1E3A5F] bg-[#0D1E33]">
              <div className="text-xs font-semibold text-[#F5B942] mb-2">
                02. Rate Five Criteria
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">
                Five Criteria, Total Out of 25
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Score innovation, problem relevance, technical work,
                presentation and feasibility from 0 to 5 each, with optional written feedback. Duplicate
                submissions are automatically prevented.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#1E3A5F] bg-[#0D1E33]">
              <div className="text-xs font-semibold text-[#F5B942] mb-2">
                03. Top 2 Winner Release
              </div>
              <h3 className="text-lg font-display font-bold text-white mb-2">
                Admin-Only Leaderboard
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Live rankings and results are visible exclusively to Event
                Admins during judging. Once released at the end, everyone can
                view the Top 2 winners and standings.
              </p>
            </div>
          </div>

          <div className="mt-10 p-6 rounded-xl bg-[#0D1E33] border border-[#1E3A5F] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#142D4C] text-[#F5B942] flex items-center justify-center shrink-0">
                {resultsReleased || isAdmin ? (
                  <Award className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-white">
                  {resultsReleased
                    ? 'Official Results Have Been Released'
                    : isAdmin
                      ? 'Admin Results & Projector Preview'
                      : 'Leaderboard & Results Locked During Judging'}
                </h3>
                <p className="text-sm text-slate-300">
                  {resultsReleased
                    ? 'View the Top 2 winners and official event standings.'
                    : isAdmin
                      ? 'Standings are currently visible only to administrators until you release final results.'
                      : 'Rankings and results remain hidden from judges and participants until released by the Event Admin.'}
                </p>
              </div>
            </div>

            {(canSeeLeaderboard || resultsReleased) && (
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  to="/results"
                  className="px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors whitespace-nowrap"
                >
                  {resultsReleased ? 'View Final Results' : 'Admin Results View'}
                </Link>
                {canSeeLeaderboard && (
                  <Link
                    to="/projector"
                    className="px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-sm font-semibold hover:bg-[#102640] transition-colors whitespace-nowrap"
                  >
                    Open Projector
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

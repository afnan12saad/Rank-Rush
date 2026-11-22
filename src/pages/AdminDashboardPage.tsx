import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  LogOut,
  MonitorPlay,
  ShieldCheck,
} from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { LiveTimerDisplay } from '../components/LiveTimerDisplay';
import { PodiumShowcase } from '../components/PodiumShowcase';
import { LegacyRatingsNotice } from '../components/admin/LegacyRatingsNotice';
import { AdminTeamsPanel } from '../components/admin/AdminTeamsPanel';
import { AdminJudgesPanel } from '../components/admin/AdminJudgesPanel';
import { AdminControlsPanel } from '../components/admin/AdminControlsPanel';
import { AdminQrPanel } from '../components/admin/AdminQrPanel';
import { AdminArchivesPanel } from '../components/admin/AdminArchivesPanel';
import { AdminResultsPanel } from '../components/admin/AdminResultsPanel';
import { AdminSettingsPanel } from '../components/admin/AdminSettingsPanel';
import { parseAdminTab, type AdminTab } from '../components/admin/adminNav';
import { useArenaAuth } from '../context/ArenaAuthContext';
import {
  DEFAULT_EVENT_SETTINGS,
  initializeDefaultEventData,
  initializeEverythingToZeroWith15Teams,
  subscribeAllAdmins,
  subscribeAllEvaluations,
  subscribeAllJudges,
  getAdminSlotUsage,
  type AdminSlotUsage,
} from '../services/arenaService';
import type {
  AdminUser,
  Evaluation,
  EventSettings,
  Judge,
} from '../types/arena';
import {
  calculateDashboardMetrics,
  calculateLeaderboard,
  MAX_ADMIN_USERS,
} from '../utils/scoring';

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    dataReady,
    isAdmin,
    adminQuota,
    settings,
    teams,
    adminRequests,
    approveRequest,
    rejectRequest,
    logoutAll,
  } = useArenaAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseAdminTab(searchParams.get('tab'));
  const setActiveTab = (tab: AdminTab) => {
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [toast, setToast] = useState('');
  const zeroInitAttempted = useRef(false);
  const [slotUsage, setSlotUsage] = useState<AdminSlotUsage | null>(null);
  useEffect(() => {
    if (!isAdmin) return;
    void getAdminSlotUsage().then(setSlotUsage).catch(() => setSlotUsage(null));
  }, [isAdmin, admins.length]);
  const adminLimitReached =
    admins.length >= MAX_ADMIN_USERS ||
    (slotUsage !== null && (!slotUsage.reconciled || slotUsage.free.length === 0));

  const pendingRequests = useMemo(
    () => adminRequests.filter((r) => r.status === 'pending'),
    [adminRequests],
  );

  useEffect(() => {
    if (authReady && !isAdmin) {
      navigate('/admin/login', { replace: true });
    }
  }, [authReady, isAdmin, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubAdmins = subscribeAllAdmins(setAdmins);
    const unsubJudges = subscribeAllJudges(setJudges);
    const unsubEvals = subscribeAllEvaluations(setEvaluations);
    return () => {
      unsubAdmins();
      unsubJudges();
      unsubEvals();
    };
  }, [isAdmin]);

  // Ensure initial 15 teams and zeroed settings exist once an admin opens the workspace
  useEffect(() => {
    if (isAdmin && dataReady && !zeroInitAttempted.current) {
      if (!settings || teams.length === 0) {
        zeroInitAttempted.current = true;
        void initializeEverythingToZeroWith15Teams(settings, {
          onlyIfNoRatings: true,
        });
      }
    }
  }, [isAdmin, dataReady, settings, teams.length]);

  const effectiveSettings: EventSettings = settings ?? {
    ...DEFAULT_EVENT_SETTINGS,
  };

  const metrics = useMemo(
    () => calculateDashboardMetrics(teams, judges, evaluations),
    [teams, judges, evaluations],
  );

  const leaderboard = useMemo(
    () =>
      calculateLeaderboard(
        teams,
        evaluations,
        metrics.totalJudges,
        effectiveSettings.tieBreakerMode,
      ),
    [teams, evaluations, metrics.totalJudges, effectiveSettings.tieBreakerMode],
  );

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? '' : prev));
    }, 3500);
  };

  if (!authReady || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">
          Verifying administrator access...
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Workspace Context Bar */}
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#F5B942]">
              Admin Control Console | {user?.email}
            </div>
            <h1 className="text-xl sm:text-2xl font-display font-bold text-white mt-0.5">
              {effectiveSettings.eventName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <LiveTimerDisplay settings={settings} variant="compact" />
            <Link
              to="/projector"
              target="_blank"
              rel="noreferrer"
              className="min-h-[40px] inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors whitespace-nowrap"
            >
              <MonitorPlay className="w-4 h-4" />
              Open Projector Display
            </Link>
            <button
              type="button"
              onClick={() => void logoutAll()}
              className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>

        {toast && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-[#16A34A]/15 text-[#4ADE80] text-sm font-semibold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Pending Admin Requests Alert Banner */}
        {pendingRequests.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-100 space-y-3 animate-reveal">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-bold text-sm text-[#F5B942]">
                <ShieldCheck className="w-5 h-5 text-[#F5B942]" />
                Incoming Administrator Join Request ({pendingRequests.length})
              </div>
              <span className="text-xs text-amber-300 font-semibold">
                Approval Required
              </span>
            </div>
            <p className="text-xs text-amber-200">
              Email addresses are not verified by the app. Approve only people you have
              confirmed outside the app (in person, or a message you trust); the name and
              email below are whatever the requester typed.
            </p>
            {adminLimitReached && (
              <p className="text-xs text-amber-200">
                {admins.length} of {MAX_ADMIN_USERS} admin accounts. Adding another admin is not possible right now. Remove an admin, or see Event Settings for details.
              </p>
            )}
            <div className="divide-y divide-amber-900/40 space-y-2">
              {pendingRequests.map((req) => (
                <div
                  key={req.uid}
                  className="pt-2 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {req.name}{' '}
                      <span className="text-xs font-normal text-amber-200">
                        ({req.email})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await approveRequest(req);
                          showToast(`Approved ${req.name} as Administrator.`);
                        } catch (err) {
                          showToast(
                            err instanceof Error && /admin limit|maximum of/i.test(err.message)
                              ? err.message
                              : 'Unable to approve admin request.',
                          );
                        }
                      }}
                      disabled={adminLimitReached}
                      className="min-h-[44px] px-4 py-2 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Accept & Add Admin
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await rejectRequest(req.uid);
                          showToast(`Declined request for ${req.email}.`);
                        } catch {
                          showToast('Unable to decline request.');
                        }
                      }}
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-amber-700/50 bg-black/20 text-xs font-semibold text-amber-200 hover:bg-black/40 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content (admin navigation lives in the header sidebar) */}
        <div>
          <section className="space-y-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-400">
                      Active Judges
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
                      {metrics.totalJudges}
                    </div>
                  </div>
                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-400">
                      Participating Teams
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-white mt-1">
                      {metrics.totalTeams}
                    </div>
                  </div>
                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-400">
                      Submitted Ratings
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#4ADE80] mt-1">
                      {metrics.totalSubmitted}
                    </div>
                  </div>
                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5">
                    <div className="text-xs font-medium text-slate-400">
                      Pending Ratings
                    </div>
                    <div className="font-mono-tabular text-2xl font-bold text-[#F5B942] mt-1">
                      {metrics.totalPending}
                    </div>
                  </div>
                </div>

                {/* Progress + Whole Event Timer & Result Release Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-3">
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-display font-bold text-white">
                        Evaluation Completion
                      </h2>
                      <span className="font-mono-tabular text-lg font-bold text-[#F5B942]">
                        {metrics.completionPercent}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#071422] rounded-md overflow-hidden">
                      <div
                        className="h-full bg-[#16A34A] transition-all duration-300"
                        style={{ width: `${metrics.completionPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 font-mono-tabular">
                      {metrics.totalSubmitted} of {metrics.totalPossible} total
                      possible judge-team evaluations submitted
                    </p>
                  </div>

                  <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 flex flex-col justify-between gap-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-slate-400">
                          Whole Event Timer & Visibility
                        </div>
                        <div className="text-sm font-bold mt-0.5 text-[#F5B942]">
                          Leaderboard Admin-Only
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#183152]">
                      <LiveTimerDisplay settings={settings} variant="compact" />
                      <button
                        type="button"
                        onClick={() => setActiveTab('controls')}
                        className="inline-flex items-center min-h-[44px] text-xs font-semibold text-[#F5B942] hover:underline whitespace-nowrap"
                      >
                        Manage Event Timer
                      </button>
                    </div>
                  </div>
                </div>

                {/* Live Admin Leaderboard Preview (Top 2 Spotlight + Dynamic Spots) */}
                <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#183152] pb-4">
                    <div>
                      <h2 className="text-base font-display font-bold text-white">
                        Live Admin Leaderboard
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Updates immediately as judges submit ratings. Spots rise
                        dynamically according to average score.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('results')}
                      className="inline-flex items-center min-h-[44px] text-xs font-semibold text-[#F5B942] hover:underline self-start sm:self-center"
                    >
                      Open Audit Log & Exports
                    </button>
                  </div>

                  <LegacyRatingsNotice entries={leaderboard} />
                  {leaderboard.length === 0 ? (
                    <div className="py-8 text-center space-y-2">
                      <p className="text-sm text-slate-300 font-medium">
                        No teams registered yet (0 Teams, 0 Judges, 0 Ratings).
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('teams')}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1d4ed8]"
                      >
                        Add Teams to Get Started
                      </button>
                    </div>
                  ) : (
                    <PodiumShowcase
                      entries={leaderboard}
                      teams={teams}
                      showProjectTitle
                    />
                  )}
                </div>

                {/* Team-Wise Live Ratings Table */}
                {leaderboard.length > 0 && (
                  <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-[#1E3A5F] flex items-center justify-between">
                      <h2 className="text-base font-display font-bold text-white">
                        Live Score Breakdown
                      </h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#0D1E33] border-b border-[#1E3A5F] text-xs font-semibold text-slate-400">
                            <th className="py-3 px-5">Spot</th>
                            <th className="py-3 px-5">Team</th>
                            <th className="py-3 px-5 text-right">
                              Ratings Received
                            </th>
                            <th className="py-3 px-5 text-right">
                              Average (/25)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#152B46] text-sm">
                          {leaderboard.map((entry, idx) => (
                            <tr
                              key={entry.teamId}
                              className={`${
                                idx % 2 === 0 ? 'bg-[#0B1C30]' : 'bg-[#081423]'
                              } hover:bg-[#102742]`}
                            >
                              <td className="py-3 px-5 font-mono-tabular font-bold text-[#F5B942]">
                                {entry.submittedCount > 0
                                  ? `#${entry.rank}`
                                  : '-'}
                              </td>
                              <td className="py-3 px-5">
                                <div className="font-semibold text-white">
                                  {entry.teamName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {entry.projectTitle}
                                </div>
                              </td>
                              <td className="py-3 px-5 text-right font-mono-tabular text-slate-200">
                                {entry.submittedCount} / {entry.totalJudges}
                              </td>
                              <td className="py-3 px-5 text-right font-mono-tabular font-bold text-[#F5B942]">
                                {entry.submittedCount > 0
                                  ? `${entry.averageFormatted} / 25`
                                  : 'Pending'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'teams' && (
              <AdminTeamsPanel
                teams={teams}
                settings={effectiveSettings}
                onNotify={showToast}
              />
            )}

            {activeTab === 'judges' && (
              <AdminJudgesPanel
                judges={judges}
                evaluations={evaluations}
                totalTeams={teams.length}
                onNotify={showToast}
              />
            )}

            {activeTab === 'controls' && (
              <AdminControlsPanel
                settings={effectiveSettings}
                teams={teams}
                judges={judges}
                evaluations={evaluations}
                onNotify={showToast}
              />
            )}

            {activeTab === 'qr' && (
              <AdminQrPanel settings={effectiveSettings} onNotify={showToast} />
            )}

            {activeTab === 'results' && (
              <AdminResultsPanel
                leaderboard={leaderboard}
                teams={teams}
                judges={judges}
                evaluations={evaluations}
                settings={effectiveSettings}
                totalSubmitted={metrics.totalSubmitted}
                totalPossible={metrics.totalPossible}
                onNotify={showToast}
              />
            )}

            {activeTab === 'archives' && <AdminArchivesPanel />}

            {activeTab === 'settings' && (
              <AdminSettingsPanel
                settings={effectiveSettings}
                admins={admins}
                adminQuota={adminQuota}
                adminRequests={adminRequests}
                currentUid={user?.uid ?? ''}
                onApproveRequest={approveRequest}
                onRejectRequest={rejectRequest}
                onNotify={showToast}
              />
            )}
          </section>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
            }

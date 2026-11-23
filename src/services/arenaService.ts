// Rank Rush data layer - Supabase/Postgres implementation.
// Same exported API as the former Firestore implementation; security is
// enforced server-side by RLS + RPCs (supabase/schema.sql), not by the client.
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type {
  AdminQuota,
  AdminRequest,
  AdminUser,
  CriteriaScores,
  Evaluation,
  EventSettings,
  Judge,
  JudgeCredential,
  LeaderboardEntry,
  PresentationStatus,
  PublicSummary,
  PublishedLeaderboard,
  RoundState,
  Team,
  TeamSelection,
} from '../types/arena';
import {
  CRITERIA,
  INITIAL_15_TEAMS,
  MAX_CRITERION_SCORE,
  MIN_CRITERION_SCORE,
  calculateLeaderboard,
  generateVerificationCode,
  isValidCriteriaScores,
  slugifyTeamId,
  sumCriteria,
  validateJudgeNameAndEmail,
} from '../utils/scoring';

export type Unsubscribe = () => void;

export const DEFAULT_EVENT_SETTINGS: Omit<EventSettings, 'updatedAt'> = {
  eventName: 'Annual Engineering Project Showcase',
  collegeName: 'Department of Computer Science & Engineering',
  tagline: 'Innovate. Present. Inspire.',
  venue: 'Main Auditorium, Academic Block A',
  eventDate: 'November 20, 2026',
  customDomain: '',
  submissionsOpen: true,
  editingAllowed: false,
  resultsPublished: false,
  tieBreakerMode: 'tie',
  currentTeamId: '',
  timerDurationSeconds: 0,
  timerWarningSeconds: 0,
  timerRemainingSeconds: 0,
  timerRunning: false,
  timerStartedAtMs: 0,
};

// ---------- row mappers (snake_case rows -> camelCase app types) ----------

function mapSettings(r: any): EventSettings {
  return {
    eventName: r.event_name,
    collegeName: r.college_name,
    tagline: r.tagline,
    venue: r.venue,
    eventDate: r.event_date,
    customDomain: r.custom_domain,
    submissionsOpen: r.submissions_open,
    editingAllowed: r.editing_allowed,
    resultsPublished: r.results_published,
    tieBreakerMode: r.tie_breaker_mode,
    currentTeamId: r.current_team_id,
    timerDurationSeconds: r.timer_duration_seconds,
    timerWarningSeconds: r.timer_warning_seconds,
    timerRemainingSeconds: r.timer_remaining_seconds,
    timerRunning: r.timer_running,
    timerStartedAtMs: Number(r.timer_started_at_ms),
    updatedAt: r.updated_at,
  };
}

function mapTeam(r: any): Team {
  return {
    id: r.id,
    name: r.name,
    projectTitle: r.project_title,
    description: r.description,
    logoUrl: r.logo_url,
    presentationStatus: r.presentation_status as PresentationStatus,
    orderIndex: r.order_index,
    tieBreakerRank: r.tie_breaker_rank,
    submittedCount: r.submitted_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapJudge(r: any): Judge {
  return {
    id: r.id,
    judgeCode: r.judge_code,
    name: r.name,
    department: r.department,
    email: r.email,
    uid: r.uid,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapEvaluation(r: any): Evaluation {
  return {
    id: r.id,
    judgeId: r.judge_id,
    judgeUid: r.judge_uid,
    teamId: r.team_id,
    scoreVersion: r.score_version,
    criteria: r.criteria as CriteriaScores,
    total: r.total,
    comment: r.comment,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAdmin(r: any): AdminUser {
  return {
    uid: r.uid,
    email: r.email,
    name: r.name,
    isFirstAdmin: r.is_first_admin,
    createdAt: r.created_at,
  };
}

function mapAdminRequest(r: any): AdminRequest {
  return {
    id: r.id,
    uid: r.uid,
    email: r.email,
    name: r.name,
    verificationCode: r.verification_code,
    status: r.status,
    firstAdminEmail: r.first_admin_email ?? '',
    firstAdminUid: r.first_admin_uid ?? '',
    requestedAt: r.requested_at ?? r.created_at,
    updatedAt: r.updated_at,
  } as AdminRequest;
}

function mapLeaderboard(r: any): PublishedLeaderboard {
  return {
    published: r.published,
    totalJudges: r.total_judges,
    totalTeams: r.total_teams,
    totalSubmissions: r.total_submissions,
    entries: (r.entries ?? []) as LeaderboardEntry[],
    updatedAt: r.updated_at,
  };
}

// ---------- generic subscription helper ----------
// Initial fetch, then re-fetch on any postgres change to the table(s).
// RLS applies to every fetch, so a revoked permission degrades to empty data
// instead of a crash (matches the old onSnapshot error handling).

// Supabase reuses channels by topic. Each subscription owns a unique topic,
// including while an earlier instance is still asynchronously unsubscribing.
let subscriptionSequence = 0;
const REFETCH_COALESCE_MS = 250;
const refreshers = new Map<string, Set<() => Promise<void>>>();

/** Refetch subscribed tables right now, without waiting for the realtime echo. Call after this client's own writes. */
export function refreshTablesNow(...tables: string[]): void {
  for (const t of tables) for (const run of refreshers.get(t) ?? []) void run();
}

function subscribeTable<T>(
  channelName: string,
  tables: string[],
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
): Unsubscribe {
  let disposed = false;
  let inFlight = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = async () => {
    if (disposed) return;
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    lastRunAt = Date.now();
    try {
      const data = await fetcher();
      if (!disposed) onData(data);
    } catch (err) {
      console.error(`[rank-rush] subscription fetch failed for ${channelName}`, err);
    } finally {
      inFlight = false;
      if (dirty && !disposed) {
        dirty = false;
        schedule();
      }
    }
  };
  // Bursts of row changes (many judges submitting at once) collapse into one
  // refetch per window instead of one per row.
  // Leading edge: the first change after a quiet period refetches at once;
  // changes inside the window collapse into one trailing refetch.
  let lastRunAt = 0;
  const schedule = () => {
    if (timer || disposed) return;
    const wait = Math.max(0, REFETCH_COALESCE_MS - (Date.now() - lastRunAt));
    timer = setTimeout(() => {
      timer = null;
      void run();
    }, wait);
  };
  for (const table of tables) {
    let set = refreshers.get(table);
    if (!set) refreshers.set(table, (set = new Set()));
    set.add(run);
  }
  void run();
  const channel: RealtimeChannel = supabase.channel(
    `${channelName}:${++subscriptionSequence}`,
  );
  for (const table of tables) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => schedule(),
    );
  }
  // Register every callback before subscribing. Refresh on join to cover any
  // changes between the initial fetch and the realtime connection becoming ready.
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') void run();
  });
  return () => {
    if (disposed) return;
    disposed = true;
    if (timer) clearTimeout(timer);
    for (const table of tables) refreshers.get(table)?.delete(run);
    void supabase.removeChannel(channel);
  };
}

// ---------- settings / summary / quota ----------

export function subscribeEventSettings(
  onData: (settings: EventSettings) => void,
): Unsubscribe {
  return subscribeTable('settings_event', ['settings_event'], async () => {
    const { data, error } = await supabase
      .from('settings_event')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapSettings(data) : { ...DEFAULT_EVENT_SETTINGS };
  }, onData);
}

export function subscribePublicSummary(
  onData: (summary: PublicSummary) => void,
): Unsubscribe {
  return subscribeTable('public_summary', ['public_summary'], async () => {
    const { data, error } = await supabase
      .from('public_summary')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    return { totalJudges: data?.total_judges ?? 0, updatedAt: data?.updated_at };
  }, onData);
}

export function subscribeAdminQuota(
  onData: (quota: AdminQuota) => void,
): Unsubscribe {
  return subscribeTable('admin_quota', ['admin_quota'], async () => {
    const { data, error } = await supabase
      .from('admin_quota')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    return {
      count: data?.count ?? 0,
      firstAdminEmail: data?.first_admin_email ?? undefined,
      firstAdminUid: data?.first_admin_uid ?? undefined,
      updatedAt: data?.updated_at,
    };
  }, onData);
}

export function subscribeAllAdmins(
  onData: (admins: AdminUser[]) => void,
): Unsubscribe {
  return subscribeTable('admins', ['admins'], async () => {
    const { data, error } = await supabase.from('admins').select('*');
    if (error) throw error;
    return (data ?? []).map(mapAdmin);
  }, onData);
}

export function subscribeAdminRequests(
  onData: (requests: AdminRequest[]) => void,
): Unsubscribe {
  return subscribeTable('admin_requests', ['admin_requests'], async () => {
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapAdminRequest);
  }, onData);
}

export function subscribeMyPendingAdminRequest(
  uid: string,
  onData: (request: AdminRequest | null) => void,
): Unsubscribe {
  return subscribeTable(`my_admin_request_${uid}`, ['admin_requests'], async () => {
    const { data, error } = await supabase
      .from('admin_requests')
      .select('*')
      .eq('uid', uid)
      .eq('status', 'pending')
      .maybeSingle();
    if (error) throw error;
    return data ? mapAdminRequest(data) : null;
  }, onData);
}

export async function getLiveAdminQuotaCount(): Promise<number> {
  const { data, error } = await supabase
    .from('admin_quota')
    .select('count')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return data?.count ?? 0;
}

export async function getFirstAdminInfo(): Promise<{
  email: string;
  uid: string;
  count: number;
} | null> {
  const [{ data: admin }, { data: quota }] = await Promise.all([
    supabase.from('admins').select('*').eq('is_first_admin', true).maybeSingle(),
    supabase.from('admin_quota').select('*').eq('id', true).maybeSingle(),
  ]);
  if (!admin) return null;
  return { email: admin.email, uid: admin.uid, count: quota?.count ?? 0 };
}

// ---------- admin join requests (no fixed cap; any existing admin may approve) ----------

export async function createAdminJoinRequest(params: {
  uid: string;
  email: string;
  name: string;
}): Promise<AdminRequest> {
  const quota = await supabase
    .from('admin_quota')
    .select('first_admin_email, first_admin_uid')
    .eq('id', true)
    .maybeSingle();
  const existing = await supabase
    .from('admin_requests')
    .select('*')
    .eq('uid', params.uid)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing.data) return mapAdminRequest(existing.data); // idempotent

  const row = {
    uid: params.uid,
    email: params.email.trim().toLowerCase().slice(0, 160),
    name: params.name.trim().slice(0, 100),
    verification_code: generateVerificationCode(),
    status: 'pending' as const,
    first_admin_email: quota.data?.first_admin_email ?? '',
    first_admin_uid: quota.data?.first_admin_uid ?? null,
  };
  const { data, error } = await supabase
    .from('admin_requests')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return mapAdminRequest(data);
}

export async function approveAdminJoinRequest(
  requestUid: string,
  approvedBy: string,
): Promise<void> {
  const { error } = await supabase.rpc('approve_admin_request', {
    p_uid: requestUid,
    p_approved_by: approvedBy.slice(0, 160),
  });
  if (error) throw new Error(error.message);
}

export async function rejectAdminJoinRequest(requestUid: string): Promise<void> {
  const { error } = await supabase
    .from('admin_requests')
    .update({ status: 'rejected' })
    .eq('uid', requestUid)
    .eq('status', 'pending');
  if (error) throw error;
}

/**
 * Re-request admin access after a rejection. The RPC only moves the caller's
 * own rejected row back to pending; it never grants a role or touches quota.
 */
export async function resubmitAdminJoinRequest(): Promise<void> {
  const { error } = await supabase.rpc('resubmit_admin_request');
  if (error) throw new Error(error.message);
}

export async function removeAdminAccount(targetUid: string): Promise<void> {
  const { error } = await supabase.rpc('remove_admin', { p_uid: targetUid });
  if (error) throw new Error(error.message);
}

// ---------- teams ----------

export function subscribeTeams(onData: (teams: Team[]) => void): Unsubscribe {
  return subscribeTable('teams', ['teams'], async () => {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapTeam);
  }, onData);
}

export async function saveTeamRecord(params: {
  existingTeam?: Team;
  id?: string;
  name: string;
  projectTitle: string;
  description: string;
  logoUrl?: string;
  presentationStatus: PresentationStatus;
  orderIndex?: number;
  tieBreakerRank?: number;
}): Promise<string> {
  const id = params.existingTeam?.id ?? params.id ?? slugifyTeamId(params.name);
  // Editing a known team with explicit ordering needs no lookups: skip the two
  // extra round trips before the write.
  const needLookup =
    !params.existingTeam ||
    params.orderIndex === undefined ||
    params.tieBreakerRank === undefined;
  const [{ data: existing }, { data: maxRow }] = needLookup
    ? await Promise.all([
        supabase
          .from('teams')
          .select('order_index, tie_breaker_rank')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('teams')
          .select('order_index')
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];
  const nextOrder = params.orderIndex ?? existing?.order_index ?? ((maxRow?.order_index ?? 0) + 1);
  const { error } = await supabase.from('teams').upsert({
    id,
    name: params.name.trim().slice(0, 100),
    project_title: params.projectTitle.trim().slice(0, 160),
    description: params.description.trim().slice(0, 500),
    logo_url: params.logoUrl ?? params.existingTeam?.logoUrl ?? '',
    presentation_status: params.presentationStatus,
    order_index: nextOrder,
    tie_breaker_rank: params.tieBreakerRank ?? existing?.tie_breaker_rank ?? nextOrder,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  refreshTablesNow('teams');
  return id;
}

export async function deleteTeamAndEvaluations(
  teamId: string,
  _settings?: unknown,
): Promise<void> {
  // evaluations reference teams with ON DELETE CASCADE.
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
  refreshTablesNow('teams', 'evaluations');
}

// ---------- judges ----------

export function subscribeAllJudges(
  onData: (judges: Judge[]) => void,
): Unsubscribe {
  return subscribeTable('judges', ['judges'], async () => {
    const { data, error } = await supabase
      .from('judges')
      .select('*')
      .order('judge_code', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapJudge);
  }, onData);
}

// Legacy judge-code credentials do not exist in the Supabase backend.
export function subscribeAllJudgeCredentials(
  onData: (creds: JudgeCredential[]) => void,
): Unsubscribe {
  onData([]);
  return () => {};
}

export async function registerJudgeByNameEmail(
  user: { uid: string },
  rawName: string,
  rawEmail: string,
): Promise<Judge> {
  const errMsg = validateJudgeNameAndEmail(rawName, rawEmail);
  if (errMsg) throw new Error(errMsg);
  const { data, error } = await supabase.rpc('register_judge', {
    p_name: rawName.trim(),
    p_email: rawEmail.trim(),
  });
  if (error) throw new Error(error.message);
  return mapJudge(data);
}

export async function saveJudgeRecord(params: {
  existingJudge?: Judge;
  id?: string;
  judgeCode?: string;
  name: string;
  department?: string;
  email: string;
  accessCode?: string;
  active: boolean;
  allJudgesCountAfter?: number;
}): Promise<void> {
  const row = {
    name: params.name.trim().slice(0, 100),
    department: (params.department ?? '').trim().slice(0, 100),
    email: params.email.trim().toLowerCase().slice(0, 160),
    active: params.active,
    updated_at: new Date().toISOString(),
  };
  if (params.existingJudge) {
    const { error } = await supabase
      .from('judges')
      .update(row)
      .eq('id', params.existingJudge.id);
    if (error) throw error;
    return;
  }
  // Admin pre-added judge: no auth account yet (uid NULL). The judge binds
  // the row on first registration via register_judge's email match.
  const id = params.judgeCode ?? `J_${Date.now().toString(36).toUpperCase()}`;
  const { error } = await supabase.from('judges').insert({
    id,
    judge_code: params.judgeCode ?? id,
    uid: null,
    ...row,
  });
  if (error) throw error;
  if (params.allJudgesCountAfter != null) {
    await syncJudgeCountSummary(params.allJudgesCountAfter);
  }
}

// Unlinking a judge's auth account is modeled as deactivation in the new
// backend: the record (and their scores) stay, access stops.
export async function unlinkJudgeAccount(judgeId: string): Promise<void> {
  const { error } = await supabase
    .from('judges')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', judgeId);
  if (error) throw error;
}

export async function deleteJudgeAndEvaluations(
  judge: Judge | string,
  _remainingActive?: number,
): Promise<void> {
  const judgeId = typeof judge === 'string' ? judge : judge.id;
  const wasActive = typeof judge === 'string' ? true : judge.active;
  const { error: evalError } = await supabase
    .from('evaluations')
    .delete()
    .eq('judge_id', judgeId);
  if (evalError) throw evalError;
  const { error } = await supabase.from('judges').delete().eq('id', judgeId);
  if (error) throw error;
  if (wasActive) {
    const { data } = await supabase
      .from('public_summary')
      .select('total_judges')
      .eq('id', true)
      .maybeSingle();
    await supabase
      .from('public_summary')
      .update({
        total_judges: Math.max(0, (data?.total_judges ?? 1) - 1),
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
  }
}

// ---------- evaluations ----------

export function subscribeMyEvaluations(
  judgeUid: string,
  onData: (evaluations: Evaluation[]) => void,
): Unsubscribe {
  return subscribeTable(`my_evals_${judgeUid}`, ['evaluations'], async () => {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*')
      .eq('judge_uid', judgeUid);
    if (error) throw error;
    return (data ?? []).map(mapEvaluation);
  }, onData);
}

export function subscribeAllEvaluations(
  onData: (evaluations: Evaluation[]) => void,
): Unsubscribe {
  return subscribeTable('evaluations', ['evaluations'], async () => {
    const { data, error } = await supabase.from('evaluations').select('*');
    if (error) throw error;
    return (data ?? []).map(mapEvaluation);
  }, onData);
}

export async function submitCriteriaScores(params: {
  judgeId: string;
  judgeUid: string;
  teamId: string;
  criteria: CriteriaScores;
  comment: string;
  isEdit: boolean;
}): Promise<void> {
  const { judgeId, teamId, criteria, comment } = params;
  if (!isValidCriteriaScores(criteria)) {
    throw new Error(
      `Score every criterion from ${MIN_CRITERION_SCORE} to ${MAX_CRITERION_SCORE}.`,
    );
  }
  const clean = Object.fromEntries(
    CRITERIA.map(({ id }) => [id, criteria[id]]),
  ) as CriteriaScores;
  const { error } = await supabase.rpc('submit_score', {
    p_judge_id: judgeId,
    p_team_id: teamId,
    p_criteria: clean,
    p_comment: comment.trim().slice(0, 1000),
  });
  if (error) throw new Error(error.message);
}


// ---------- shared round clock ----------

export const DEFAULT_ROUND_STATE: Omit<RoundState, 'updatedAt'> = {
  roundNumber: 0,
  status: 'idle',
  presentSeconds: 600,
  rateSeconds: 60,
  presentEndsAtMs: 0,
  rateEndsAtMs: 0,
};

function mapRoundState(r: any): RoundState {
  return {
    roundName: r.round_name ?? '',
    roundNumber: r.round_number,
    status: r.status,
    presentSeconds: r.present_seconds,
    rateSeconds: r.rate_seconds,
    presentEndsAtMs: r.present_ends_at
      ? new Date(r.present_ends_at).getTime()
      : 0,
    rateEndsAtMs: r.rate_ends_at ? new Date(r.rate_ends_at).getTime() : 0,
    updatedAt: r.updated_at,
  };
}

function mapTeamSelection(r: any): TeamSelection {
  return {
    roundNumber: r.round_number,
    judgeId: r.judge_id,
    judgeUid: r.judge_uid,
    teamId: r.team_id,
    selectedAt: r.selected_at,
  };
}

// Round clock subscription. Also reports the measured server clock offset
// (server updated_at minus local receive time) so countdowns can anchor to
// the database clock instead of the device's.
export function subscribeRoundState(
  onData: (round: RoundState, serverOffsetMs: number) => void,
): Unsubscribe {
  return subscribeTable(
    'round_state',
    ['round_state'],
    async () => {
      const { data, error } = await supabase
        .from('round_state')
        .select('*')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      return {
        round: data ? mapRoundState(data) : { ...DEFAULT_ROUND_STATE },
        serverOffsetMs: data?.updated_at
          ? new Date(data.updated_at).getTime() - Date.now()
          : 0,
      };
    },
    (v) => onData(v.round, v.serverOffsetMs),
  );
}

export function subscribeMyTeamSelection(
  judgeUid: string,
  roundNumber: number,
  onData: (selection: TeamSelection | null) => void,
): Unsubscribe {
  return subscribeTable(
    `my_selection_${judgeUid}_${roundNumber}`,
    ['judge_team_selections'],
    async () => {
      const { data, error } = await supabase
        .from('judge_team_selections')
        .select('*')
        .eq('judge_uid', judgeUid)
        .eq('round_number', roundNumber)
        .maybeSingle();
      if (error) throw error;
      return data ? mapTeamSelection(data) : null;
    },
    onData,
  );
}

// Admin: every judge's pick for one round (drives the round overview).
export function subscribeRoundSelections(
  roundNumber: number,
  onData: (selections: TeamSelection[]) => void,
): Unsubscribe {
  return subscribeTable(
    `round_selections_${roundNumber}`,
    ['judge_team_selections'],
    async () => {
      const { data, error } = await supabase
        .from('judge_team_selections')
        .select('*')
        .eq('round_number', roundNumber);
      if (error) throw error;
      return (data ?? []).map(mapTeamSelection);
    },
    onData,
  );
}

export async function selectTeamForRound(
  judgeId: string,
  teamId: string,
): Promise<void> {
  const { error } = await supabase.rpc('select_team_for_round', {
    p_judge_id: judgeId,
    p_team_id: teamId,
  });
  if (error) throw new Error(error.message);
}

async function roundAdminRpc(name: string, params?: Record<string, unknown>) {
  const { error } = await supabase.rpc(name, params ?? {});
  if (error) throw new Error(error.message);
  refreshTablesNow('round_state', 'judge_team_selections');
}

export function startRoundSelection(): Promise<void> {
  return roundAdminRpc('start_round_selection');
}

export function startRoundClock(): Promise<void> {
  return roundAdminRpc('start_round_clock');
}

export function extendRoundClock(seconds: number): Promise<void> {
  return roundAdminRpc('extend_round_clock', { p_seconds: seconds });
}

export function reopenRatingWindow(): Promise<void> {
  return roundAdminRpc('reopen_rating_window');
}

export function endRound(): Promise<void> {
  return roundAdminRpc('end_round');
}

// ---------- published leaderboard ----------

export function subscribePublishedLeaderboard(
  onData: (board: PublishedLeaderboard | null) => void,
  canRead: boolean,
): Unsubscribe {
  if (!canRead) {
    onData(null);
    return () => {};
  }
  return subscribeTable('public_leaderboard', ['public_leaderboard'], async () => {
    // RLS: non-admins see the row only when published = true; zero rows -> null.
    const { data, error } = await supabase
      .from('public_leaderboard')
      .select('*')
      .eq('id', true)
      .maybeSingle();
    if (error) throw error;
    return data ? mapLeaderboard(data) : null;
  }, onData);
}

export async function publishOrHideResults(params: {
  publish: boolean;
  teams: Team[];
  judges: Judge[];
  evaluations: Evaluation[];
  settings: EventSettings;
}): Promise<void> {
  const { publish, teams, judges, evaluations, settings } = params;
  const activeJudges = judges.filter((j) => j.active).length;
  const entries = publish
    ? calculateLeaderboard(teams, evaluations, activeJudges, settings.tieBreakerMode)
    : [];
  const { error } = await supabase.rpc('publish_results', {
    p_publish: publish,
    p_total_judges: activeJudges,
    p_total_teams: teams.length,
    p_total_submissions: evaluations.length,
    p_entries: entries,
  });
  if (error) throw new Error(error.message);
}

// ---------- event settings ----------

export async function saveEventSettings(
  settings: Omit<EventSettings, 'updatedAt'>,
): Promise<void> {
  const { error } = await supabase
    .from('settings_event')
    .update({
      event_name: settings.eventName,
      college_name: settings.collegeName,
      tagline: settings.tagline,
      venue: settings.venue,
      event_date: settings.eventDate,
      custom_domain: settings.customDomain,
      submissions_open: settings.submissionsOpen,
      editing_allowed: settings.editingAllowed,
      results_published: settings.resultsPublished,
      tie_breaker_mode: settings.tieBreakerMode,
      current_team_id: settings.currentTeamId,
      timer_duration_seconds: settings.timerDurationSeconds,
      timer_warning_seconds: settings.timerWarningSeconds,
      timer_remaining_seconds: settings.timerRemainingSeconds,
      timer_running: settings.timerRunning,
      timer_started_at_ms: settings.timerStartedAtMs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}

export async function initializeDefaultEventData(): Promise<void> {
  // Already seeded server-side; this is insurance for a wiped database.
  const { count } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;
  const { error } = await supabase.from('teams').insert(
    INITIAL_15_TEAMS.map((t, i) => ({
      id: t.id,
      name: t.name,
      project_title: t.projectTitle,
      description: t.description,
      presentation_status: 'Waiting',
      order_index: i + 1,
      tie_breaker_rank: i + 1,
    })),
  );
  if (error) throw error;
}

// ---------- reset / archive ----------

export interface ResetState {
  status: string;
  archiveId: string;
  expectedRatingCount: number;
  startedBy: string;
  updatedAtMs: number;
}

// The Supabase reset is one atomic RPC, so there is no resumable partial state.
export async function getResetState(): Promise<ResetState | null> {
  return null;
}

export interface EventArchive {
  id: string;
  eventName: string;
  archivedAt?: unknown;
  archivedBy: string;
  totalJudges: number;
  totalTeams: number;
  totalSubmissions: number;
  entries: LeaderboardEntry[];
  scoreMax: number;
}

export async function listEventArchives(): Promise<EventArchive[]> {
  const { data, error } = await supabase
    .from('event_archives')
    .select('*')
    .order('archived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    eventName: r.event_name,
    archivedAt: r.archived_at,
    archivedBy: r.archived_by,
    totalJudges: r.total_judges,
    totalTeams: r.total_teams,
    totalSubmissions: r.total_submissions,
    entries: (r.entries ?? []) as LeaderboardEntry[],
    scoreMax: r.score_max,
  }));
}

// Permanently delete ONE archived event (its saved standings only). The server
// re-checks admin role and the exact event name, and deletes a single row.
export async function deleteEventArchive(id: string, eventName: string): Promise<void> {
  const { error } = await supabase.rpc('delete_event_archive', {
    p_id: id,
    p_event_name: eventName,
  });
  if (error) throw new Error(error.message);
}

// Archive current standings, then reset for a new event: one atomic RPC.
// The server closes submissions first and refuses if the rating count moved,
// so an archive can never silently miss late scores.
export async function archiveAndStartNewEvent(
  settings: EventSettings,
  archivedBy: string,
): Promise<string> {
  const [{ data: teams }, { data: judges }, { data: evals }, { count: evalCount }] =
    await Promise.all([
      supabase.from('teams').select('*').order('order_index', { ascending: true }),
      supabase.from('judges').select('*'),
      supabase.from('evaluations').select('*'),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }),
    ]);
  const teamList = (teams ?? []).map(mapTeam);
  const judgeList = (judges ?? []).map(mapJudge);
  const evalList = (evals ?? []).map(mapEvaluation);
  const activeJudges = judgeList.filter((j) => j.active).length;
  const entries = calculateLeaderboard(teamList, evalList, activeJudges, settings.tieBreakerMode);

  const { data, error } = await supabase.rpc('archive_and_reset_event', {
    p_event_name: settings.eventName,
    p_archived_by: archivedBy,
    p_entries: entries,
    p_total_judges: activeJudges,
    p_total_teams: teamList.length,
    p_total_submissions: evalList.length,
    p_expected_evals: evalCount ?? 0,
    p_default_teams: INITIAL_15_TEAMS.map((t, i) => ({
      id: t.id,
      name: t.name,
      projectTitle: t.projectTitle,
      description: t.description,
      orderIndex: i + 1,
      tieBreakerRank: i + 1,
    })),
    p_settings: { timerDurationSeconds: DEFAULT_EVENT_SETTINGS.timerDurationSeconds },
  });
  if (error) throw new Error(error.message);
  return data as string;
}

// Archive-only (no reset), used by the admin Archives view.
export async function archiveCurrentEventResults(params: {
  settings: EventSettings;
  teams: Team[];
  judges: Judge[];
  evaluations: Evaluation[];
  archivedBy: string;
}): Promise<string> {
  const { settings, teams, judges, evaluations, archivedBy } = params;
  const activeJudges = judges.filter((j) => j.active).length;
  const entries = calculateLeaderboard(
    teams,
    evaluations,
    activeJudges,
    settings.tieBreakerMode,
  );
  const id = `ev_${Date.now()}`;
  const { error } = await supabase.from('event_archives').insert({
    id,
    event_name: settings.eventName,
    archived_by: archivedBy,
    total_judges: activeJudges,
    total_teams: teams.length,
    total_submissions: evaluations.length,
    entries,
    score_max: 25,
  });
  if (error) throw error;
  refreshTablesNow('teams');
  return id;
}

export async function syncJudgeCountSummary(totalJudges: number): Promise<void> {
  const { error } = await supabase
    .from('public_summary')
    .update({ total_judges: totalJudges, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw error;
}

// ---------- compatibility shims over removed legacy machinery ----------

// Old slot-based admin claiming is gone: an approved request materializes as
// an admins row (via approve_admin_request), so "claiming" is just a lookup.
export async function claimAdminSlot(
  user: { uid: string },
  _name?: string,
): Promise<AdminUser> {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('uid', user.uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      'Your admin access is not active yet. An existing administrator must approve your request.',
    );
  }
  return mapAdmin(data);
}

// Judge-code login is not supported on the new backend; judges register with
// name + email (anonymous sign-in), same as the current app's primary flow.
export async function claimJudgeSlot(): Promise<never> {
  throw new Error(
    'Judge codes are no longer used. Register with your name and email instead.',
  );
}

// Slot reconciliation was needed to repair the old 5-slot model; the new
// backend has no slots, so there is nothing to reconcile.
export async function reconcileAdminSlots(): Promise<{ slotted: number }> {
  return { slotted: 0 };
}

// Danger-zone full reset: archives current standings first (same atomic RPC
// as Start New Event), then reseeds the 15 default teams.
export async function initializeEverythingToZeroWith15Teams(
  settings: EventSettings | null,
  meta?: { requestedBy?: string; onlyIfNoRatings?: boolean },
): Promise<void> {
  if (meta?.onlyIfNoRatings) {
    const [{ count: teamCount }, { count: evalCount }] = await Promise.all([
      supabase.from('teams').select('id', { count: 'exact', head: true }),
      supabase.from('evaluations').select('id', { count: 'exact', head: true }),
    ]);
    // Nothing to initialize when data already exists.
    if ((teamCount ?? 0) > 0 || (evalCount ?? 0) > 0) return;
  }
  await archiveAndStartNewEvent(
    settings ?? { ...DEFAULT_EVENT_SETTINGS },
    meta?.requestedBy ?? 'admin',
  );
  }

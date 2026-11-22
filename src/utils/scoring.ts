import type {
  CriteriaScores,
  CriterionId,
  Evaluation,
  EventSettings,
  Judge,
  LeaderboardEntry,
  RatingStatusLabel,
  Team,
  TieBreakerMode,
} from '../types/arena';

export const STAR_LABELS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Very Good',
  5: 'Excellent',
};

export const CRITERIA: { id: CriterionId; label: string }[] = [
  { id: 'c1', label: 'Innovation & Originality' },
  { id: 'c2', label: 'Problem Relevance & Impact' },
  { id: 'c3', label: 'Technical Implementation' },
  { id: 'c4', label: 'Presentation & Communication' },
  { id: 'c5', label: 'Feasibility & Scalability' },
];
// Per-criterion range 0-5 (user-confirmed: zero is allowed). Keep in sync
// with the criteria range in firestore.rules.
export const MIN_CRITERION_SCORE = 0;
export const MAX_CRITERION_SCORE = 5;
export const MAX_TOTAL_SCORE = CRITERIA.length * MAX_CRITERION_SCORE;

export function isValidCriterionScore(v: unknown): v is number {
  return (
    typeof v === 'number' &&
    Number.isInteger(v) &&
    v >= MIN_CRITERION_SCORE &&
    v <= MAX_CRITERION_SCORE
  );
}

export function isValidCriteriaScores(c: unknown): c is CriteriaScores {
  if (!c || typeof c !== 'object') return false;
  const rec = c as Record<string, unknown>;
  return CRITERIA.every(({ id }) => isValidCriterionScore(rec[id]));
}

export function sumCriteria(c: CriteriaScores): number {
  return CRITERIA.reduce((acc, { id }) => acc + c[id], 0);
}

/** True for evaluations on the five-criteria scale with a consistent total. */
export function isScoredEvaluation(ev: Evaluation): boolean {
  return (
    ev.scoreVersion === 2 &&
    isValidCriteriaScores(ev.criteria) &&
    ev.total === sumCriteria(ev.criteria)
  );
}

export function isValidStarRating(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export function calculateLeaderboard(
  teams: Team[],
  evaluations: Evaluation[],
  totalJudges: number,
  // Kept only so older callers still compile. Ties ALWAYS share a rank (1,1,3):
  // the legacy 'admin_order' mode is ignored, even if it is stored in settings.
  _legacyTieBreakerMode?: TieBreakerMode,
): LeaderboardEntry[] {
  const grouped = new Map<
    string,
    { sum: number; count: number; legacy: number }
  >();

  for (const team of teams) {
    grouped.set(team.id, { sum: 0, count: 0, legacy: 0 });
  }

  for (const ev of evaluations) {
    const bucket = grouped.get(ev.teamId);
    if (!bucket) continue;
    if (isScoredEvaluation(ev)) {
      bucket.sum += ev.total as number;
      bucket.count += 1;
    } else if (isValidStarRating(ev.rating)) {
      // Old single 1-5 rating: a different scale, never mixed into the total.
      bucket.legacy += 1;
    }
  }

  const raw = teams.map((team) => {
    const stats = grouped.get(team.id) ?? { sum: 0, count: 0, legacy: 0 };
    // Rank and display use the SAME value: the average rounded to 2 decimals.
    const averageRating =
      stats.count > 0
        ? Math.round((stats.sum / stats.count) * 100 + 1e-9) / 100
        : 0;
    return {
      team,
      ratingSum: stats.sum,
      submittedCount: stats.count,
      legacyCount: stats.legacy,
      averageRating,
      averageFormatted: stats.count > 0 ? averageRating.toFixed(2) : '0.00',
    };
  });

  raw.sort((a, b) => {
    const aHas = a.submittedCount > 0;
    const bHas = b.submittedCount > 0;
    if (aHas !== bHas) return aHas ? -1 : 1;

    const diff = b.averageRating - a.averageRating;
    if (Math.abs(diff) > 1e-9) {
      return diff;
    }

    const orderDiff = a.team.orderIndex - b.team.orderIndex;
    if (orderDiff !== 0) return orderDiff;
    return a.team.name.localeCompare(b.team.name);
  });

  const entries: LeaderboardEntry[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    let rank = i + 1;
    let isTied = false;

    if (i > 0) {
      const prev = raw[i - 1];
      const sameScore =
        item.submittedCount > 0 &&
        prev.submittedCount > 0 &&
        Math.abs(item.averageRating - prev.averageRating) <= 1e-9;
      if (sameScore) {
        rank = entries[i - 1].rank;
        isTied = true;
        entries[i - 1].isTied = true;
      }
    }

    entries.push({
      rank,
      isTied,
      teamId: item.team.id,
      teamName: item.team.name,
      projectTitle: item.team.projectTitle,
      presentationStatus: item.team.presentationStatus,
      averageRating: Number(item.averageRating.toFixed(4)),
      averageFormatted: item.averageFormatted,
      ratingSum: item.ratingSum,
      submittedCount: item.submittedCount,
      legacyCount: item.legacyCount,
      totalJudges,
    });
  }

  return entries;
}

export interface DashboardMetrics {
  totalJudges: number;
  totalTeams: number;
  totalSubmitted: number;
  totalPending: number;
  totalPossible: number;
  completionPercent: number;
}

export function calculateDashboardMetrics(
  teams: Team[],
  judges: Judge[],
  evaluations: Evaluation[],
): DashboardMetrics {
  const activeJudges = judges.filter((j) => j.active);
  const totalJudges = activeJudges.length;
  const totalTeams = teams.length;
  const teamIds = new Set(teams.map((t) => t.id));
  const judgeIds = new Set(activeJudges.map((j) => j.id));

  let totalSubmitted = 0;
  for (const ev of evaluations) {
    if (
      teamIds.has(ev.teamId) &&
      judgeIds.has(ev.judgeId) &&
      isScoredEvaluation(ev)
    ) {
      totalSubmitted += 1;
    }
  }

  const totalPossible = totalJudges * totalTeams;
  const totalPending = Math.max(0, totalPossible - totalSubmitted);
  const completionPercent =
    totalPossible > 0
      ? Math.min(100, Math.round((totalSubmitted / totalPossible) * 100))
      : 0;

  return {
    totalJudges,
    totalTeams,
    totalSubmitted,
    totalPending,
    totalPossible,
    completionPercent,
  };
}

export function getTeamStatusForJudge(
  team: Team,
  hasSubmitted: boolean,
): RatingStatusLabel {
  if (hasSubmitted) return 'Submitted';
  if (
    team.presentationStatus === 'Presenting' ||
    team.presentationStatus === 'Completed'
  ) {
    return 'Evaluation Pending';
  }
  return 'Not Evaluated';
}

export interface TimerSnapshot {
  remainingSeconds: number;
  isRunning: boolean;
  isWarning: boolean;
  isExpired: boolean;
}

export function computeTimerSnapshot(
  settings: Pick<
    EventSettings,
    | 'timerDurationSeconds'
    | 'timerWarningSeconds'
    | 'timerRemainingSeconds'
    | 'timerRunning'
    | 'timerStartedAtMs'
  > | null,
  nowMs: number,
): TimerSnapshot {
  if (!settings) {
    return {
      remainingSeconds: 0,
      isRunning: false,
      isWarning: false,
      isExpired: false,
    };
  }

  let remaining = Math.max(0, settings.timerRemainingSeconds);
  if (settings.timerRunning && settings.timerStartedAtMs > 0) {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((nowMs - settings.timerStartedAtMs) / 1000),
    );
    remaining = Math.max(0, settings.timerRemainingSeconds - elapsedSeconds);
  }

  return {
    remainingSeconds: remaining,
    isRunning: settings.timerRunning && remaining > 0,
    isWarning: remaining > 0 && remaining <= settings.timerWarningSeconds,
    isExpired: remaining === 0,
  };
}

export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function buildJudgePortalUrl(
  customDomain: string,
  fallbackOrigin: string,
): string {
  const trimmed = customDomain.trim().replace(/\/+$/, '');
  const base =
    trimmed.length > 0
      ? /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`
      : fallbackOrigin.replace(/\/+$/, '');
  return `${base}/judge/login`;
}

export function generateNextJudgeCode(existingJudges: Judge[]): string {
  let maxNum = 0;
  for (const judge of existingJudges) {
    const match = /^JUDGE(\d+)$/i.exec(judge.judgeCode);
    if (match) {
      const n = Number.parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = maxNum + 1;
  return `JUDGE${String(next).padStart(2, '0')}`;
}

export function slugifyTeamId(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || `team-${Date.now()}`;
}

export const INITIAL_15_TEAMS: Array<{
  id: string;
  name: string;
  projectTitle: string;
  description: string;
}> = [
  {
    id: 'team-01',
    name: 'Team 01',
    projectTitle: 'AI Smart Campus Navigator',
    description:
      'Autonomous indoor navigation, accessibility routing, and real-time lecture hall wayfinding system.',
  },
  {
    id: 'team-02',
    name: 'Team 02',
    projectTitle: 'GreenPulse Microgrid Energy Optimizer',
    description:
      'IoT-driven electrical load monitoring, predictive battery discharge, and automated peak shaving.',
  },
  {
    id: 'team-03',
    name: 'Team 03',
    projectTitle: 'MedLink Emergency Dispatch & Telemetry',
    description:
      'Real-time paramedic vital telemetry streaming, dynamic ambulance dispatching, and automated ER triage routing.',
  },
  {
    id: 'team-04',
    name: 'Team 04',
    projectTitle: 'AquaSense River Quality Sentinel',
    description:
      'Solar-powered optical turbidity, dissolved oxygen, and pH telemetry probes with real-time pollution anomaly alarms.',
  },
  {
    id: 'team-05',
    name: 'Team 05',
    projectTitle: 'NeuroGait Biomechanical Symmetry Analyzer',
    description:
      'Computer vision kinematic gait symmetry assessment for stroke recovery and clinical physical therapy monitoring.',
  },
  {
    id: 'team-06',
    name: 'Team 06',
    projectTitle: 'CyberSentinel Zero-Trust Identity Gateway',
    description:
      'Decentralized cryptographic credential verification pipeline with risk-adaptive session token revocation.',
  },
  {
    id: 'team-07',
    name: 'Team 07',
    projectTitle: 'AgriDrone Autonomous Canopy Health Forecaster',
    description:
      'Multispectral crop imaging UAV with on-edge NDVI computation and localized irrigation deficiency mapping.',
  },
  {
    id: 'team-08',
    name: 'Team 08',
    projectTitle: 'VocalShield Acoustic Biomarker Screener',
    description:
      'Edge acoustic neural network for early neurodegenerative vocal tremor screening and speech rehabilitation.',
  },
  {
    id: 'team-09',
    name: 'Team 09',
    projectTitle: 'SolarGrid Adaptive Inverter Synchronizer',
    description:
      'High-frequency digital phase-locked loop inverter for microgrids operating under intermittent renewable loads.',
  },
  {
    id: 'team-10',
    name: 'Team 10',
    projectTitle: 'BioWaste Anaerobic Digester Telemetry',
    description:
      'Biomass gas-phase methane concentration sensors with automated thermal regulation for community biodigesters.',
  },
  {
    id: 'team-11',
    name: 'Team 11',
    projectTitle: 'TransitSync Municipal Fleet Optimizer',
    description:
      'Live GPS headway regularity manager and predictive passenger congestion estimator for rapid transit bus lines.',
  },
  {
    id: 'team-12',
    name: 'Team 12',
    projectTitle: 'RoboWeld Ultrasonic Structural Joint Scanner',
    description:
      'Automated phased-array ultrasonic crawler inspecting pipeline weld seam integrity with instant volumetric defect reconstruction.',
  },
  {
    id: 'team-13',
    name: 'Team 13',
    projectTitle: 'PureAir Urban Particulate Filtration Pod',
    description:
      'Self-regenerating HEPA-photocatalytic air column tracking PM2.5 and volatile organic compounds along pedestrian corridors.',
  },
  {
    id: 'team-14',
    name: 'Team 14',
    projectTitle: 'SecureLedger Pharmaceutical Cold-Chain Tracker',
    description:
      'Cryptographically signed temperature and tamper logging beacon enforcing pharmaceutical supply chain cold storage compliance.',
  },
  {
    id: 'team-15',
    name: 'Team 15',
    projectTitle: 'VisionAssist Spatial Audio Obstacle Headset',
    description:
      'Dual stereo depth camera headset converting environmental 3D spatial geometry into intuitive binaural acoustic cues.',
  },
];

// Maximum admin accounts in total (owner included). Enforced server-side by the
// approve_admin_request RPC and the admin_quota table (row lock), see supabase/schema.sql.
export const MAX_ADMIN_USERS = 5;
export const ADMIN_SLOT_IDS = ['s1', 's2', 's3', 's4', 's5'] as const;

export function generateVerificationCode(): string {
  // 6-digit random verification code
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function buildAdminApprovalEmailUrl(params: {
  firstAdminEmail: string;
  candidateName: string;
  candidateEmail: string;
  /** Unused: codes no longer approve anything. Kept so old callers still compile. */
  code?: string;
  appUrl: string;
}): string {
  const subject = encodeURIComponent(
    '[RANK RUSH] Administrator access request waiting for approval',
  );
  const body = encodeURIComponent(
    `Hello,

A new organizer has requested administrator access to the Rank Rush Evaluation Console.

Requester Details:
- Name: ${params.candidateName}
- Email: ${params.candidateEmail}

To approve: open the Admin Console at ${params.appUrl || window.location.origin}/admin and click "Accept & Add Admin" in the join request. Only an existing admin can approve, and the console allows at most 5 admin accounts.

If you do not recognise this person, decline the request.

RANK RUSH`,
  );
  return `mailto:${params.firstAdminEmail}?subject=${subject}&body=${body}`;
}

export function validateAdminRegistrationInput(params: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  currentAdminCount?: number;
}): string | null {
  const cleanName = params.name.trim();
  if (cleanName.length < 2) {
    return 'Enter your full name (minimum 2 characters).';
  }

  const cleanEmail = params.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Enter a valid email address.';
  }

  if (params.password.length < 8) {
    return 'Password must be at least 8 characters long.';
  }

  if (params.password !== params.confirmPassword) {
    return 'Password and Confirm Password do not match.';
  }

  return null;
}

export const MIN_TIMER_SECONDS = 10;
export const MAX_TIMER_SECONDS = 7200;

export function clampTimerDurationSeconds(
  minutes: number,
  seconds: number,
): number {
  const safeMins = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const safeSecs = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const total = safeMins * 60 + safeSecs;
  return Math.min(MAX_TIMER_SECONDS, Math.max(MIN_TIMER_SECONDS, total));
}

export function clampTimerWarningSeconds(
  minutes: number,
  seconds: number,
  maxDurationSeconds: number,
): number {
  const safeMins = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const safeSecs = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const total = safeMins * 60 + safeSecs;
  return Math.min(3600, Math.max(0, Math.min(maxDurationSeconds, total)));
}

export function splitSecondsToMinutesAndSeconds(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  return {
    minutes: Math.floor(safe / 60),
    seconds: safe % 60,
  };
}

export const MAX_WHOLE_EVENT_TIMER_SECONDS = 86400; // 24 hours max

export function clampWholeEventTimerSeconds(
  hours: number,
  minutes: number,
  seconds: number,
): number {
  const safeH = Number.isFinite(hours) ? Math.max(0, Math.floor(hours)) : 0;
  const safeM = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
  const safeS = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const total = safeH * 3600 + safeM * 60 + safeS;
  return Math.min(MAX_WHOLE_EVENT_TIMER_SECONDS, Math.max(0, total));
}

export function splitSecondsToHms(totalSeconds: number): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const safe = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const hours = Math.floor(safe / 3600);
  const rem = safe % 3600;
  const minutes = Math.floor(rem / 60);
  const seconds = rem % 60;
  return { hours, minutes, seconds };
}

export function formatHmsCountdown(totalSeconds: number): string {
  const { hours, minutes, seconds } = splitSecondsToHms(totalSeconds);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
    2,
    '0',
  )}:${String(seconds).padStart(2, '0')}`;
}

export function validateJudgeNameAndEmail(
  name: string,
  email: string,
): string | null {
  const cleanName = name.trim();
  if (cleanName.length < 2) {
    return 'Please enter your full name (minimum 2 characters).';
  }
  const cleanEmail = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function generateJudgeIdFromUid(uid: string): string {
  const cleaned = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 18);
  return `J_${cleaned || Date.now().toString(36).toUpperCase()}`;
}

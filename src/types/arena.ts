export type PresentationStatus = 'Waiting' | 'Presenting' | 'Completed';
export type TieBreakerMode = 'tie' | 'admin_order';
export type RatingStatusLabel = 'Not Evaluated' | 'Evaluation Pending' | 'Submitted';

export interface EventSettings {
  eventName: string;
  collegeName: string;
  tagline: string;
  venue: string;
  eventDate: string;
  customDomain: string;
  submissionsOpen: boolean;
  editingAllowed: boolean;
  resultsPublished: boolean;
  tieBreakerMode: TieBreakerMode;
  currentTeamId: string;
  timerDurationSeconds: number;
  timerWarningSeconds: number;
  timerRemainingSeconds: number;
  timerRunning: boolean;
  timerStartedAtMs: number;
  updatedAt?: unknown;
}

export interface PublicSummary {
  totalJudges: number;
  updatedAt?: unknown;
}

export interface Team {
  id: string;
  name: string;
  projectTitle: string;
  description: string;
  logoUrl: string;
  presentationStatus: PresentationStatus;
  orderIndex: number;
  tieBreakerRank: number;
  submittedCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Judge {
  id: string;
  judgeCode: string;
  name: string;
  department: string;
  email: string;
  uid: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JudgeCredential {
  judgeId: string;
  accessCode: string;
  updatedAt?: unknown;
}

export interface JudgeSession {
  uid: string;
  judgeId: string;
  accessCode: string;
  createdAt?: unknown;
}

export type CriterionId = 'c1' | 'c2' | 'c3' | 'c4' | 'c5';
export type CriteriaScores = Record<CriterionId, number>;

export interface Evaluation {
  id: string;
  judgeId: string;
  judgeUid: string;
  teamId: string;
  /** Legacy single 1-5 overall rating. Absent on scoreVersion 2 evaluations. */
  rating?: number;
  /** scoreVersion 2: five criteria scores plus their sum. */
  scoreVersion?: 2;
  criteria?: CriteriaScores;
  total?: number;
  comment: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LeaderboardEntry {
  rank: number;
  isTied: boolean;
  teamId: string;
  teamName: string;
  projectTitle: string;
  presentationStatus: PresentationStatus;
  averageRating: number;
  averageFormatted: string;
  ratingSum: number;
  submittedCount: number;
  /** Old single-rating evaluations for this team; NOT included in the score. */
  legacyCount?: number;
  totalJudges: number;
}

export interface PublishedLeaderboard {
  published: boolean;
  totalJudges: number;
  totalTeams: number;
  totalSubmissions: number;
  entries: LeaderboardEntry[];
  updatedAt?: unknown;
}

export interface AdminUser {
  uid: string;
  email: string;
  name: string;
  isFirstAdmin?: boolean;
  createdAt?: unknown;
}

export interface AdminQuota {
  count: number;
  firstAdminEmail?: string;
  firstAdminUid?: string;
  updatedAt?: unknown;
}

export type AdminRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminRequest {
  id: string;
  uid: string;
  email: string;
  name: string;
  verificationCode: string;
  status: AdminRequestStatus;
  firstAdminEmail: string;
  firstAdminUid: string;
  requestedAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  approvedBy?: string;
}

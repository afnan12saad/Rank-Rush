import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { CriteriaScoreInput } from '../components/CriteriaScoreInput';
import { RoundTimerBanner } from '../components/RoundTimerBanner';
import { useArenaAuth } from '../context/ArenaAuthContext';
import {
  submitCriteriaScores,
  subscribeMyEvaluations,
  subscribeMyTeamSelection,
  subscribeRoundState,
} from '../services/arenaService';
import type {
  CriteriaScores,
  Evaluation,
  RoundState,
  TeamSelection,
} from '../types/arena';
import {
  MAX_CRITERION_SCORE,
  MAX_TOTAL_SCORE,
  MIN_CRITERION_SCORE,
  computeRoundPhase,
  isScoredEvaluation,
  isValidCriteriaScores,
  sumCriteria,
} from '../utils/scoring';

export function JudgeEvaluatePage() {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, authReady, judgeProfile, teams, settings } = useArenaAuth();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [evalsLoaded, setEvalsLoaded] = useState(false);
  const [scores, setScores] = useState<Partial<CriteriaScores>>({});
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [round, setRound] = useState<RoundState | null>(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [mySelection, setMySelection] = useState<TeamSelection | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    return subscribeRoundState((r, offset) => {
      setRound(r);
      setServerOffsetMs(offset);
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const roundNumber = round?.roundNumber ?? 0;
  useEffect(() => {
    if (!user || !judgeProfile || roundNumber === 0) {
      setMySelection(null);
      return;
    }
    return subscribeMyTeamSelection(user.uid, roundNumber, setMySelection);
  }, [user, judgeProfile, roundNumber]);

  useEffect(() => {
    if (authReady && (!user || !judgeProfile)) {
      navigate('/judge/login', { replace: true });
    }
  }, [authReady, user, judgeProfile, navigate]);

  useEffect(() => {
    if (!user || !judgeProfile) return;
    return subscribeMyEvaluations(user.uid, (rows) => {
      setEvaluations(rows);
      setEvalsLoaded(true);
    });
  }, [user, judgeProfile]);

  const team = teams.find((t) => t.id === teamId);
  const existingEval = evaluations.find((ev) => ev.teamId === teamId);

  useEffect(() => {
    if (existingEval) {
      setScores(existingEval.criteria ?? {});
      setComment(existingEval.comment || '');
    }
  }, [existingEval]);

  if (!authReady || !judgeProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-6 text-sm text-slate-400">
          Loading evaluation page...
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
        <SiteHeader />
        <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
          <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-8 text-center space-y-4">
            <h1 className="text-xl font-display font-bold text-white">
              Team Not Found
            </h1>
            <p className="text-sm text-slate-300">
              This team is no longer registered in the current event.
            </p>
            <Link
              to="/judge/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8]"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Team Selection
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const isLegacyExisting = Boolean(existingEval) && !isScoredEvaluation(existingEval as Evaluation);
  const scoresComplete = isValidCriteriaScores(scores);
  const isLockedExisting = Boolean(existingEval) && !settings?.editingAllowed;
  const submissionsClosed = settings?.submissionsOpen === false;

  // Shared round clock: a NEW score is only possible during the shared
  // 1-minute rating window, and only for the team this judge picked.
  const roundSnap = computeRoundPhase(round, nowMs + serverOffsetMs);
  const isMyPickedTeam = mySelection?.teamId === team.id;
  const ratingOpenForThisTeam =
    roundSnap.phase === 'rating' && isMyPickedTeam;
  const newScoreBlocked = !existingEval && !ratingOpenForThisTeam;
  const readOnly =
    isLockedExisting || submissionsClosed || submittedSuccess || newScoreBlocked;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) return;
    if (submissionsClosed) {
      setError('Rating submissions are currently closed by the administrator.');
      return;
    }
    if (isLockedExisting) {
      setError(
        'You have already submitted a rating for this team and editing is disabled.',
      );
      return;
    }
    if (isLegacyExisting) {
      setError(
        'This team already has an old single-score rating that an admin must clear before it can be re-scored.',
      );
      return;
    }
    if (newScoreBlocked) {
      setError(
        roundSnap.phase === 'rating' && !isMyPickedTeam
          ? 'This is not the team you selected for this round.'
          : roundSnap.phase === 'closed' || roundSnap.phase === 'idle'
            ? 'The rating window for this round is closed.'
            : 'The rating window has not opened yet. Wait for the countdown.',
      );
      return;
    }
    if (!isValidCriteriaScores(scores)) {
      setError('Please score all five criteria.');
      return;
    }

    setBusy(true);
    try {
      await submitCriteriaScores({
        judgeId: judgeProfile.id,
        judgeUid: user.uid,
        teamId: team.id,
        criteria: scores,
        comment,
        isEdit: Boolean(existingEval),
      });
      setSubmittedSuccess(true);
      window.setTimeout(() => {
        navigate('/judge/dashboard');
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to submit your rating. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-10 space-y-5">
        <Link
          to="/judge/dashboard"
          className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-slate-300 hover:text-[#F5B942] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Team Selection
        </Link>

        <section className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-xl shadow-black/25 space-y-6">
          {/* Team & Judge Identification */}
          <div className="border-b border-[#183152] pb-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
              <span className="text-[#F5B942]">Overall Team Evaluation</span>
              <span className="text-slate-300">
                Judge: {judgeProfile.name}
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              {team.name}
            </h1>
            <p className="text-base font-medium text-slate-200">
              {team.projectTitle}
            </p>
            {team.description && (
              <p className="text-sm text-slate-400 leading-relaxed">
                {team.description}
              </p>
            )}
          </div>

          {!existingEval && (
            <RoundTimerBanner round={round} serverOffsetMs={serverOffsetMs} />
          )}

          {!existingEval && !submittedSuccess && (
            <>
              {roundSnap.phase === 'selecting' && (
                <div className="p-4 rounded-lg bg-[#081422] border border-[#1E3A5F] text-sm text-slate-200">
                  {isMyPickedTeam
                    ? 'Team selected. The admin starts the shared 10-minute presentation timer next; the 1-minute rating window opens right after it.'
                    : 'You have not picked a team for this round yet. Go back and select one while selection is open.'}
                </div>
              )}
              {roundSnap.phase === 'presenting' && isMyPickedTeam && (
                <div className="p-4 rounded-lg bg-[#081422] border border-[#1E3A5F] text-sm text-slate-200">
                  Presentation in progress. The rating form unlocks for 1 minute
                  when the countdown ends.
                </div>
              )}
              {roundSnap.phase === 'rating' && !isMyPickedTeam && (
                <div className="p-4 rounded-lg bg-amber-950/60 text-amber-200 text-sm">
                  This is not the team you selected for this round, so you
                  cannot rate it.
                </div>
              )}
              {(roundSnap.phase === 'closed' || roundSnap.phase === 'idle') && (
                <div className="p-4 rounded-lg bg-amber-950/60 text-amber-200 text-sm">
                  The rating window for this round is closed. An administrator
                  can reopen it from the Event Controls panel if the event ran
                  over time.
                </div>
              )}
            </>
          )}

          {submittedSuccess && (
            <div
              role="status"
              className="p-4 rounded-lg bg-[#16A34A]/15 text-[#4ADE80] flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-bold">Rating Submitted Successfully</div>
                <p className="text-slate-200 mt-0.5">
                  Your scores for {team.name} have been recorded{scoresComplete ? ` (${sumCriteria(scores)}/${MAX_TOTAL_SCORE})` : ''}.
                  Returning to Team Selection Dashboard...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-950/60 text-red-200 text-sm flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isLockedExisting && !submittedSuccess && (
            <div className="p-4 rounded-lg bg-[#081422] flex items-start gap-3 text-sm text-slate-200">
              <Lock className="w-4 h-4 text-[#F5B942] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-white">
                  Evaluation Already Submitted
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Each judge may submit one set of five scores per team. Editing is
                  currently disabled by the administrator.
                </p>
              </div>
            </div>
          )}

          {submissionsClosed && !isLockedExisting && !submittedSuccess && (
            <div className="p-4 rounded-lg bg-amber-950/60 text-amber-200 text-sm">
              Rating submissions are currently closed by the event
              administrator.
            </div>
          )}

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            <div>
              <h2 className="text-lg font-display font-bold text-white mb-1">
                Score This Team on Five Criteria
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Give each criterion a score from {MIN_CRITERION_SCORE} to{' '}
                {MAX_CRITERION_SCORE}. The total out of {MAX_TOTAL_SCORE} is
                calculated for you.
              </p>
              {isLegacyExisting && (
                <p className="text-xs text-amber-300 mb-3">
                  Your earlier single {existingEval?.rating}/5 rating for this
                  team uses the old scale and cannot be edited here.
                </p>
              )}

              <CriteriaScoreInput
                value={scores}
                onChange={(id, v) => setScores((prev) => ({ ...prev, [id]: v }))}
                disabled={readOnly || isLegacyExisting || !evalsLoaded}
              />
            </div>

            <div>
              <label
                htmlFor="judge-feedback-input"
                className="block text-sm font-semibold text-slate-200 mb-1.5"
              >
                Optional Comments / Feedback
              </label>
              <textarea
                id="judge-feedback-input"
                rows={3}
                maxLength={1000}
                disabled={readOnly || !evalsLoaded}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share concise remarks for the event committee (optional)..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] disabled:opacity-60"
              />
              <div className="text-right text-[11px] text-slate-400 mt-1 font-mono-tabular">
                {comment.length} / 1000
              </div>
            </div>

            {/* Review Before Submission */}
            {scoresComplete && !submittedSuccess && (
              <div className="p-4 rounded-lg bg-[#081422] space-y-1.5 text-sm">
                <div className="text-xs font-semibold text-[#F5B942]">
                  Submission Review
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Team</span>
                  <strong className="text-white">{team.name}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total score</span>
                  <strong className="font-mono-tabular text-[#F5B942]">
                    {sumCriteria(scores as CriteriaScores)} / {MAX_TOTAL_SCORE}
                  </strong>
                </div>
              </div>
            )}

            {!readOnly && (
              <button
                type="submit"
                disabled={busy || !scoresComplete || isLegacyExisting || !evalsLoaded}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                {busy
                  ? 'Saving Rating...'
                  : existingEval
                  ? 'Update Rating'
                  : 'Submit Rating'}
              </button>
            )}
          </form>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
                }

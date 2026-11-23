import { useEffect, useState } from 'react';
import {
  ListChecks,
  Pause,
  Play,
  PlusCircle,
  Star,
  TimerReset,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import { useArenaAuth } from '../../context/ArenaAuthContext';
import {
  archiveAndStartNewEvent,
  endRound,
  extendRoundClock,
  getResetState,
  reopenRatingWindow,
  saveEventSettings,
  startRoundClock,
  startRoundSelection,
  subscribeRoundSelections,
  subscribeRoundState,
} from '../../services/arenaService';
import type {
  Evaluation,
  EventSettings,
  Judge,
  RoundState,
  Team,
  TeamSelection,
} from '../../types/arena';
import { computeRoundPhase, formatCountdown } from '../../utils/scoring';
import { RoundTimerBanner } from '../RoundTimerBanner';
import { supabase } from '../../services/supabaseClient';

interface AdminControlsPanelProps {
  settings: EventSettings;
  teams: Team[];
  judges: Judge[];
  evaluations: Evaluation[];
  onNotify: (msg: string) => void;
}

export function AdminControlsPanel({
  settings,
  teams,
  judges,
  evaluations,
  onNotify,
}: AdminControlsPanelProps) {
  const { user } = useArenaAuth();
  const [busy, setBusy] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const refreshResetState = () =>
    getResetState()
      .then((r) => setResetPending(r !== null))
      .catch(() => {});
  useEffect(() => {
    refreshResetState();
  }, []);

  // ---------- shared round clock ----------
  const [round, setRound] = useState<RoundState | null>(null);
  const [roundOffsetMs, setRoundOffsetMs] = useState(0);
  const [roundSelections, setRoundSelections] = useState<TeamSelection[]>([]);
  const [roundBusy, setRoundBusy] = useState(false);
  const [roundNameInput, setRoundNameInput] = useState('');
  const [timerEditorOpen, setTimerEditorOpen] = useState(false);
  const [presentInput, setPresentInput] = useState('600');
  const [rateInput, setRateInput] = useState('60');
  const [timeLeftInput, setTimeLeftInput] = useState('60');
  const [editPhase, setEditPhase] = useState<'presenting' | 'rating' | null>(null);
  const [editRound, setEditRound] = useState(0);
  const [endAction, setEndAction] = useState<'presentation' | 'round' | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    return subscribeRoundState((r, offset) => {
      setRound(r);
      setRoundOffsetMs(offset);
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  const roundNumber = round?.roundNumber ?? 0;
  const roundLabel = round?.roundName || `Round ${roundNumber}`;
  useEffect(() => {
    if (roundNumber === 0) {
      setRoundSelections([]);
      return;
    }
    return subscribeRoundSelections(roundNumber, setRoundSelections);
  }, [roundNumber]);

  const roundSnap = computeRoundPhase(round, nowMs + roundOffsetMs);
  const judgeNameById = new Map(judges.map((j) => [j.id, j.name]));
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const pickedJudgeIds = new Set(roundSelections.map((sel) => sel.judgeId));
  const unpickedJudges = judges.filter(
    (j) => j.active && !pickedJudgeIds.has(j.id),
  );

  const runRoundAction = async (
    action: () => Promise<void>,
    successMsg: string,
  ) => {
    setRoundBusy(true);
    try {
      await action();
      onNotify(successMsg);
      setTimerEditorOpen(false);
      setEndAction(null);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Round action failed.');
    } finally {
      setRoundBusy(false);
    }
  };

  const timerRpc = async (name: string, params: Record<string, unknown>) => {
    const { error } = await supabase.rpc(name, params);
    if (error) throw new Error(error.message);
  };
  const parseSeconds = (value: string, max: number) => {
    const seconds = Number(value);
    if (!value.trim() || !Number.isInteger(seconds) || seconds < 10 || seconds > max) {
      throw new Error(`Enter a whole number from 10 to ${max} seconds.`);
    }
    return seconds;
  };
  const openTimerEditor = () => {
    setRoundNameInput(round?.roundName ?? '');
    setPresentInput(String(round?.presentSeconds ?? 600));
    setRateInput(String(round?.rateSeconds ?? 60));
    setTimeLeftInput(String(Math.max(10, roundSnap.remainingSeconds)));
    setEditPhase(roundSnap.phase === 'presenting' || roundSnap.phase === 'rating' ? roundSnap.phase : null);
    setEditRound(roundNumber);
    setTimerEditorOpen(true);
  };

  const handleToggleSubmissions = async () => {
    setBusy(true);
    try {
      const next = !settings.submissionsOpen;
      await saveEventSettings({ ...settings, submissionsOpen: next });
      onNotify(
        next ? 'Opened rating submissions.' : 'Closed rating submissions.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleToggleEditing = async () => {
    setBusy(true);
    try {
      const next = !settings.editingAllowed;
      await saveEventSettings({ ...settings, editingAllowed: next });
      onNotify(
        next ? 'Enabled rating editing for judges.' : 'Locked submitted ratings.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResetAllZero = async () => {
    setBusy(true);
    try {
      await archiveAndStartNewEvent(settings, user?.email || 'admin');
      setResetConfirmOpen(false);
      onNotify(
        'Results archived. New event ready: ratings and judges cleared, 15 default teams, admin accounts kept.',
      );
    } catch (err) {
      setResetConfirmOpen(false);
      onNotify(err instanceof Error ? err.message : 'The reset failed.');
    } finally {
      setBusy(false);
      refreshResetState();
    }
  };

  return (
    <div className="space-y-6">
      {/* Shared Round Clock: 10 min presentation + 1 min rating window */}
      <section className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#183152] pb-4">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              Presentation Rounds
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Judges pick a team, you start one shared presentation clock, then a
              shared rating window opens. Admins can edit durations or end early. The same countdown shows on
              the judge screens and the projector.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#091829] border border-[#24436B] text-xs font-semibold text-slate-200 shrink-0">
            <ListChecks className="w-3.5 h-3.5 text-[#F5B942]" />
            {roundNumber === 0 ? 'No round started' : roundLabel}
          </span>
        </div>

        <RoundTimerBanner round={round} serverOffsetMs={roundOffsetMs} />
        {(roundSnap.phase === 'presenting' || roundSnap.phase === 'rating') && (
          <div className="text-center text-xs text-slate-400 font-mono-tabular -mt-2">
            {roundSnap.phase === 'presenting'
              ? `Rating window opens in ${formatCountdown(roundSnap.remainingSeconds)}`
              : `Rating window closes in ${formatCountdown(roundSnap.remainingSeconds)}`}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={roundBusy || !round} onClick={openTimerEditor}
            className="min-h-[44px] px-4 py-2.5 rounded-lg bg-[#102640] border border-[#24436B] text-white text-sm font-semibold disabled:opacity-50">
            Edit Timer
          </button>
          {roundSnap.phase === 'presenting' && (
            <button type="button" disabled={roundBusy} onClick={() => setEndAction('presentation')}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-[#F5B942] text-[#092B59] text-sm font-semibold disabled:opacity-50">
              End Presentation &amp; Open Rating
            </button>
          )}
          {(roundSnap.phase === 'idle' ||
            roundSnap.phase === 'closed' ||
            roundNumber === 0) && (
            <button
              type="button"
              disabled={roundBusy}
              onClick={() =>
                void runRoundAction(
                  startRoundSelection,
                  `Opened team selection for Round ${roundNumber + 1}.`,
                )
              }
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              Open Round {roundNumber + 1} Team Selection
            </button>
          )}

          {roundSnap.phase === 'selecting' && (
            <button
              type="button"
              disabled={roundBusy}
              onClick={() =>
                void runRoundAction(
                  startRoundClock,
                  `Started Round ${roundNumber}: ${formatCountdown(round?.presentSeconds ?? 600)} presentation, then ${formatCountdown(round?.rateSeconds ?? 60)} rating.`,
                )
              }
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#16A34A] hover:bg-[#15803d] text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start {formatCountdown(round?.presentSeconds ?? 600)} Clock
            </button>
          )}

          {(roundSnap.phase === 'presenting' || roundSnap.phase === 'rating') && (
            <>
              <button
                type="button"
                disabled={roundBusy}
                onClick={() =>
                  void runRoundAction(
                    () => extendRoundClock(60),
                    'Added 1 minute to the shared clock.',
                  )
                }
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#102640] border border-[#24436B] hover:bg-[#173355] text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <TimerReset className="w-4 h-4" />
                Extend +1 Min
              </button>
              <button
                type="button"
                disabled={roundBusy}
                onClick={() => setEndAction('round')}
                className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#091829] border border-red-500/50 hover:bg-red-950/50 text-red-200 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Pause className="w-4 h-4" />
                End Round
              </button>
            </>
          )}

          {roundSnap.phase === 'closed' && (
            <button
              type="button"
              disabled={roundBusy}
              onClick={() =>
                void runRoundAction(
                  reopenRatingWindow,
                  `Reopened the rating window for Round ${roundNumber}.`,
                )
              }
              className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#F5B942] hover:bg-[#e5a92e] text-[#092B59] text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <Star className="w-4 h-4" />
              Reopen {formatCountdown(round?.rateSeconds ?? 60)} Rating Window
            </button>
          )}
        </div>

        {timerEditorOpen && (
          <div className="rounded-xl border border-[#24436B] bg-[#091829] p-4 space-y-5">
            <form className="space-y-3" onSubmit={(event) => {
              event.preventDefault();
              void runRoundAction(() => timerRpc('name_round', { p_round_number: editRound, p_name: roundNameInput.trim() }), 'Round name saved on all screens.');
            }}>
              <label className="block text-sm text-slate-200">Round name
                <input maxLength={80} value={roundNameInput} onChange={(e) => setRoundNameInput(e.target.value)} placeholder={`Round ${roundNumber}`}
                  className="mt-1 block w-full rounded-lg border border-[#24436B] bg-[#0D1E33] px-3 py-2 text-white" />
              </label>
              <p className="text-xs text-slate-400">Shown on admin, judge and projector screens. Leave blank to use the round number. The name clears when the next round opens.</p>
              <button disabled={roundBusy || roundNumber === 0} className="min-h-[44px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Round Name</button>
            </form>
            <form onSubmit={(event) => {
              event.preventDefault();
              void runRoundAction(() => timerRpc('configure_round_clock', {
                p_present_seconds: parseSeconds(presentInput, 7200),
                p_rate_seconds: parseSeconds(rateInput, 3600),
              }), 'Saved timer durations. The running countdown was not changed.');
            }} className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Timer durations</h3>
              <p className="text-xs text-slate-400">Used when starting a clock, reopening rating, or ending a presentation early. Saving does not change the running countdown.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm text-slate-200">Presentation (seconds)
                  <input type="number" min="10" max="7200" step="1" required value={presentInput} onChange={(e) => setPresentInput(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#24436B] bg-[#0D1E33] px-3 py-2 text-white" />
                </label>
                <label className="text-sm text-slate-200">Rating (seconds)
                  <input type="number" min="10" max="3600" step="1" required value={rateInput} onChange={(e) => setRateInput(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#24436B] bg-[#0D1E33] px-3 py-2 text-white" />
                </label>
              </div>
              <button disabled={roundBusy} className="min-h-[44px] rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save Durations</button>
            </form>
            {editPhase && (
              <form onSubmit={(event) => {
                event.preventDefault();
                void runRoundAction(() => timerRpc('edit_round_time_left', {
                  p_round_number: editRound, p_phase: editPhase,
                  p_seconds: parseSeconds(timeLeftInput, editPhase === 'presenting' ? 7200 : 3600),
                }), 'Updated the shared countdown on all screens.');
              }} className="border-t border-[#24436B] pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-white">Edit running {editPhase === 'presenting' ? 'presentation' : 'rating'} timer</h3>
                <p className="text-xs text-slate-400">Sets time left from when you press Apply. Does not change saved durations. If the phase or round changes, reopen this editor.</p>
                <label className="block text-sm text-slate-200">Time left (seconds)
                  <input type="number" min="10" max={editPhase === 'presenting' ? 7200 : 3600} step="1" required value={timeLeftInput} onChange={(e) => setTimeLeftInput(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-[#24436B] bg-[#0D1E33] px-3 py-2 text-white" />
                </label>
                <button disabled={roundBusy} className="min-h-[44px] rounded-lg bg-[#F5B942] px-4 py-2 text-sm font-semibold text-[#092B59] disabled:opacity-50">Apply Time Left</button>
              </form>
            )}
            <button type="button" disabled={roundBusy} onClick={() => setTimerEditorOpen(false)} className="min-h-[44px] px-3 text-sm text-slate-300">Close Editor</button>
          </div>
        )}

        {roundNumber > 0 && (
          <div className="border-t border-[#183152] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                {roundLabel} Team Picks
              </h3>
              <span className="text-xs font-mono-tabular text-slate-400">
                {roundSelections.length} / {judges.filter((j) => j.active).length} judges picked
              </span>
            </div>
            {roundSelections.length === 0 ? (
              <p className="text-xs text-slate-400">
                No picks yet. Judges choose their team from their dashboard
                while selection is open.
              </p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roundSelections.map((sel) => (
                  <li
                    key={`${sel.roundNumber}_${sel.judgeId}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-[#091829] border border-[#1E3A5F] px-3 py-2 text-xs"
                  >
                    <span className="font-semibold text-slate-200 truncate">
                      {judgeNameById.get(sel.judgeId) ?? sel.judgeId}
                    </span>
                    <span className="text-[#F5B942] font-medium truncate">
                      {teamNameById.get(sel.teamId) ?? sel.teamId}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {roundSnap.phase !== 'idle' && unpickedJudges.length > 0 && (
              <p className="text-xs text-slate-400">
                No pick yet: {unpickedJudges.map((j) => j.name).join(', ')}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Evaluation & Visibility Controls */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-4">
          <h3 className="text-base font-display font-bold text-white">
            Judging Submission Rules
          </h3>

          <div className="flex items-center justify-between gap-4 py-2 border-b border-[#183152]">
            <div>
              <div className="text-sm font-semibold text-white">
                Accept Rating Submissions
              </div>
              <div className="text-xs text-slate-400">
                Allow judges to submit five-criteria scores.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleSubmissions()}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                settings.submissionsOpen
                  ? 'bg-[#16A34A] text-white hover:bg-[#15803d]'
                  : 'bg-[#172B44] text-slate-300 hover:bg-[#1e3756]'
              }`}
            >
              {settings.submissionsOpen ? 'Open' : 'Closed'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 py-2 border-b border-[#183152]">
            <div>
              <div className="text-sm font-semibold text-white">
                Allow Rating Editing
              </div>
              <div className="text-xs text-slate-400">
                Permit judges to modify an already submitted rating.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleToggleEditing()}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                settings.editingAllowed
                  ? 'bg-[#2563EB] text-white hover:bg-[#1d4ed8]'
                  : 'bg-[#172B44] text-slate-300 hover:bg-[#1e3756]'
              }`}
            >
              {settings.editingAllowed ? 'Editing Enabled' : 'Locked'}
            </button>
          </div>

          <p className="pt-1 text-xs text-slate-400 leading-relaxed">
            Ranking uses the average rounded to 2 decimals. Teams with equal
            rounded averages share the same rank (for example 1, 1, 3).
          </p>
        </div>

        {/* Result Publication & Full Zero Reset */}
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <h3 className="text-base font-display font-bold text-white">
              Leaderboard Visibility (Admin Only)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              The live leaderboard is visible only to signed-in admins. Judges
              and other users cannot open it. Open the Projector page to show
              it on the event screen.
            </p>
          </div>

          <div className="pt-4 border-t border-[#183152] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-red-400">
                Start New Event (archives results first)
              </div>
              {resetPending && (
                <div className="text-xs text-amber-300 mt-1 font-semibold">
                  A reset was started and not finished. Submissions stay closed. Run it again to resume. The original archive is reused.
                </div>
              )}
              <div className="text-xs text-slate-400 mt-0.5">
                Saves this event's final standings to the archive, then clears ratings, judges and the timer and sets up 15 default teams. Admin accounts are kept.
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-lg border border-red-500/40 bg-red-950/40 text-red-300 text-xs font-semibold hover:bg-red-950/70 shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              {resetPending ? 'Resume Start New Event' : 'Start New Event'}
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={endAction !== null}
        title={endAction === 'presentation' ? 'End Presentation Early?' : 'End Round?'}
        message={endAction === 'presentation'
          ? `Stop the presentation timer and open a ${formatCountdown(round?.rateSeconds ?? 60)} rating window for all judges now. Scores and team picks are kept.`
          : 'Stop the timer and close rating submissions for this round now. Existing scores and team picks are kept.'}
        confirmLabel={endAction === 'presentation' ? 'End Presentation & Open Rating' : 'End Round'}
        danger busy={roundBusy}
        onCancel={() => { if (!roundBusy) setEndAction(null); }}
        onConfirm={() => runRoundAction(
          endAction === 'presentation'
            ? () => timerRpc('end_round_presentation', { p_round_number: roundNumber })
            : endRound,
          endAction === 'presentation' ? 'Presentation ended. Rating window is open.' : `Ended Round ${roundNumber}.`,
        )}
      />
      <ConfirmDialog
        open={resetConfirmOpen}
        title="Start New Event"
        message="First the final standings of this event are saved to the archive. Then all ratings and presentation progress are cleared, registered judges are removed, the timer is reset to 00:00:00, and 15 default teams (Team 01 to Team 15) are created. Administrator accounts are kept. If saving the archive fails, nothing is reset."
        confirmLabel={resetPending ? 'Resume Reset' : 'Archive and Start New Event'}
        danger
        requireTypedPhrase="START NEW EVENT"
        busy={busy}
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={handleResetAllZero}
      />
    </div>
  );
    }

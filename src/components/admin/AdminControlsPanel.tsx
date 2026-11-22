import { useEffect, useState } from 'react';
import {
  Clock,
  Pause,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import { useArenaAuth } from '../../context/ArenaAuthContext';
import { LiveTimerDisplay } from '../LiveTimerDisplay';
import {
  archiveAndStartNewEvent,
  getResetState,
  saveEventSettings,
} from '../../services/arenaService';
import type {
  Evaluation,
  EventSettings,
  Judge,
  Team,
} from '../../types/arena';
import {
  clampWholeEventTimerSeconds,
  computeTimerSnapshot,
  formatHmsCountdown,
  splitSecondsToHms,
} from '../../utils/scoring';

interface AdminControlsPanelProps {
  settings: EventSettings;
  teams: Team[];
  judges: Judge[];
  evaluations: Evaluation[];
  onNotify: (msg: string) => void;
}

const EVENT_TIMER_PRESETS = [
  { label: '15m', hours: 0, minutes: 15, seconds: 0 },
  { label: '30m', hours: 0, minutes: 30, seconds: 0 },
  { label: '1h', hours: 1, minutes: 0, seconds: 0 },
  { label: '2h', hours: 2, minutes: 0, seconds: 0 },
  { label: '3h', hours: 3, minutes: 0, seconds: 0 },
];

export function AdminControlsPanel({
  settings,
  teams,
  judges,
  evaluations,
  onNotify,
}: AdminControlsPanelProps) {
  const { user } = useArenaAuth();
  const initialDur = splitSecondsToHms(settings.timerDurationSeconds);
  const initialWarn = splitSecondsToHms(settings.timerWarningSeconds);

  const [durHours, setDurHours] = useState(initialDur.hours);
  const [durMins, setDurMins] = useState(initialDur.minutes);
  const [durSecs, setDurSecs] = useState(initialDur.seconds);

  const [warnHours, setWarnHours] = useState(initialWarn.hours);
  const [warnMins, setWarnMins] = useState(initialWarn.minutes);
  const [warnSecs, setWarnSecs] = useState(initialWarn.seconds);

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

  useEffect(() => {
    const dur = splitSecondsToHms(settings.timerDurationSeconds);
    const warn = splitSecondsToHms(settings.timerWarningSeconds);
    setDurHours(dur.hours);
    setDurMins(dur.minutes);
    setDurSecs(dur.seconds);
    setWarnHours(warn.hours);
    setWarnMins(warn.minutes);
    setWarnSecs(warn.seconds);
  }, [settings.timerDurationSeconds, settings.timerWarningSeconds]);

  const applyEventTimer = async (
    h: number,
    m: number,
    s: number,
    wh: number,
    wm: number,
    ws: number,
  ) => {
    setBusy(true);
    try {
      const durationSec = clampWholeEventTimerSeconds(h, m, s);
      const rawWarn = clampWholeEventTimerSeconds(wh, wm, ws);
      const warningSec = Math.min(43200, Math.min(durationSec, rawWarn));

      const splitDur = splitSecondsToHms(durationSec);
      const splitWarn = splitSecondsToHms(warningSec);
      setDurHours(splitDur.hours);
      setDurMins(splitDur.minutes);
      setDurSecs(splitDur.seconds);
      setWarnHours(splitWarn.hours);
      setWarnMins(splitWarn.minutes);
      setWarnSecs(splitWarn.seconds);

      await saveEventSettings({
        ...settings,
        currentTeamId: '',
        timerDurationSeconds: durationSec,
        timerWarningSeconds: warningSec,
        timerRemainingSeconds: durationSec,
        timerRunning: false,
        timerStartedAtMs: 0,
      });

      onNotify(
        durationSec === 0
          ? 'Whole event timer reset to 00:00:00.'
          : `Whole event timer set to ${formatHmsCountdown(durationSec)}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStartOrResume = async () => {
    setBusy(true);
    try {
      const snap = computeTimerSnapshot(settings, Date.now());
      const configuredInputSec = clampWholeEventTimerSeconds(
        durHours,
        durMins,
        durSecs,
      );
      const startFrom =
        snap.remainingSeconds > 0
          ? snap.remainingSeconds
          : settings.timerDurationSeconds > 0
            ? settings.timerDurationSeconds
            : configuredInputSec;

      if (startFrom <= 0) {
        onNotify(
          'Set a whole-event duration above 00:00:00 before starting the timer.',
        );
        return;
      }

      const rawWarn = clampWholeEventTimerSeconds(
        warnHours,
        warnMins,
        warnSecs,
      );
      const safeWarn = Math.min(43200, Math.min(startFrom, rawWarn));

      await saveEventSettings({
        ...settings,
        currentTeamId: '',
        timerDurationSeconds:
          settings.timerDurationSeconds > 0
            ? settings.timerDurationSeconds
            : startFrom,
        timerWarningSeconds: safeWarn,
        timerRemainingSeconds: startFrom,
        timerRunning: true,
        timerStartedAtMs: Date.now(),
      });
      onNotify('Whole event timer started.');
    } finally {
      setBusy(false);
    }
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      const snap = computeTimerSnapshot(settings, Date.now());
      await saveEventSettings({
        ...settings,
        currentTeamId: '',
        timerRemainingSeconds: snap.remainingSeconds,
        timerRunning: false,
        timerStartedAtMs: 0,
      });
      onNotify('Whole event timer paused.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetToZero = async () => {
    await applyEventTimer(0, 0, 0, 0, 0, 0);
  };

  const handleSelectPreset = async (
    hours: number,
    minutes: number,
    seconds: number,
  ) => {
    setDurHours(hours);
    setDurMins(minutes);
    setDurSecs(seconds);
    await applyEventTimer(hours, minutes, seconds, warnHours, warnMins, warnSecs);
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

  const inputClass =
    'w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  const configuredTotal = clampWholeEventTimerSeconds(
    durHours,
    durMins,
    durSecs,
  );

  return (
    <div className="space-y-6">
      {/* Single Whole Event Timer Control */}
      <section className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#183152] pb-4">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              Whole Event Timer Control
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Single synchronized countdown for the entire project event (up to
              24 hours). Starts at 00:00:00 until configured by the admin.
            </p>
          </div>
          <LiveTimerDisplay settings={settings} variant="compact" />
        </div>

        {/* Presets */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-[#F5B942] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Event Duration Presets
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {EVENT_TIMER_PRESETS.map((preset) => {
                const presetTotal =
                  preset.hours * 3600 + preset.minutes * 60 + preset.seconds;
                const isSelected = settings.timerDurationSeconds === presetTotal;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void handleSelectPreset(
                        preset.hours,
                        preset.minutes,
                        preset.seconds,
                      )
                    }
                    className={`min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-semibold font-mono-tabular transition-colors ${
                      isSelected
                        ? 'bg-[#2563EB] text-white'
                        : 'border border-[#24436B] bg-[#081422] text-slate-300 hover:bg-[#102640] hover:text-white'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
            <div className="xl:col-span-5">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Event Duration (Hrs : Min : Sec)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="event-timer-hrs"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Hours
                  </label>
                  <input
                    id="event-timer-hrs"
                    type="number"
                    min={0}
                    max={24}
                    value={durHours}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setDurHours(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(24, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-timer-mins"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Minutes
                  </label>
                  <input
                    id="event-timer-mins"
                    type="number"
                    min={0}
                    max={59}
                    value={durMins}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setDurMins(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(59, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-timer-secs"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Seconds
                  </label>
                  <input
                    id="event-timer-secs"
                    type="number"
                    min={0}
                    max={59}
                    value={durSecs}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setDurSecs(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(59, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
              </div>
            </div>

            <div className="xl:col-span-4">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Warning Alert At (Hrs : Min : Sec)
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label
                    htmlFor="event-warn-hrs"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Hours
                  </label>
                  <input
                    id="event-warn-hrs"
                    type="number"
                    min={0}
                    max={12}
                    value={warnHours}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setWarnHours(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(12, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-warn-mins"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Minutes
                  </label>
                  <input
                    id="event-warn-mins"
                    type="number"
                    min={0}
                    max={59}
                    value={warnMins}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setWarnMins(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(59, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-warn-secs"
                    className="block text-[11px] text-slate-400 mb-1"
                  >
                    Seconds
                  </label>
                  <input
                    id="event-warn-secs"
                    type="number"
                    min={0}
                    max={59}
                    value={warnSecs}
                    onChange={(e) => {
                      const val = Number.parseInt(e.target.value, 10);
                      setWarnSecs(
                        Number.isNaN(val) ? 0 : Math.max(0, Math.min(59, val)),
                      );
                    }}
                    className={`${inputClass} font-mono-tabular`}
                  />
                </div>
              </div>
            </div>

            <div className="xl:col-span-3">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void applyEventTimer(
                    durHours,
                    durMins,
                    durSecs,
                    warnHours,
                    warnMins,
                    warnSecs,
                  )
                }
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
              >
                Set Event Timer ({formatHmsCountdown(configuredTotal)})
              </button>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {!settings.timerRunning ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleStartOrResume()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803d] transition-colors disabled:opacity-60"
            >
              <Play className="w-4 h-4" />
              {settings.timerRemainingSeconds < settings.timerDurationSeconds &&
              settings.timerRemainingSeconds > 0
                ? 'Resume Event Timer'
                : 'Start Event Timer'}
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePause()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F5B942] text-[#071422] text-sm font-semibold hover:bg-amber-400 transition-colors"
            >
              <Pause className="w-4 h-4" />
              Pause Event Timer
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void applyEventTimer(
                durHours,
                durMins,
                durSecs,
                warnHours,
                warnMins,
                warnSecs,
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-slate-200 text-sm font-semibold hover:bg-[#102640] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to {formatHmsCountdown(configuredTotal)}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleResetToZero()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-slate-300 text-sm font-semibold hover:bg-[#102640] transition-colors"
          >
            Zero Timer (00:00:00)
          </button>
        </div>
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

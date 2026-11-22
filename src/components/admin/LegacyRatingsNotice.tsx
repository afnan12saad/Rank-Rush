import { AlertTriangle } from 'lucide-react';
import type { LeaderboardEntry } from '../../types/arena';

/** Shown whenever old single 1-5 ratings exist. They are not part of the /25 standings. */
export function LegacyRatingsNotice({ entries }: { entries: LeaderboardEntry[] }) {
  const legacy = entries.reduce((a, e) => a + (e.legacyCount ?? 0), 0);
  if (legacy === 0) return null;
  const scored = entries.reduce((a, e) => a + e.submittedCount, 0);
  const teams = entries.filter((e) => (e.legacyCount ?? 0) > 0).length;
  return (
    <div
      role="alert"
      className="flex items-start gap-3 p-4 rounded-xl border border-amber-700/50 bg-amber-950/30 text-sm text-amber-200"
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <strong className="block text-amber-100">
          {legacy} old 1-5 rating{legacy === 1 ? '' : 's'} on {teams} team{teams === 1 ? '' : 's'} are not in these standings
        </strong>
        These standings count only the new five-criteria scores (out of 25): {scored} so far. The old ratings are kept, unchanged and unconverted. Nothing was deleted.
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { deleteEventArchive, listEventArchives, type EventArchive } from '../../services/arenaService';
import { ConfirmDialog } from '../ConfirmDialog';

export function AdminArchivesPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [archives, setArchives] = useState<EventArchive[] | null>(null);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const [toDelete, setToDelete] = useState<EventArchive | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState('');

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setError('');
    try {
      await deleteEventArchive(toDelete.id, toDelete.eventName);
      setArchives((cur) => (cur ? cur.filter((x) => x.id !== toDelete.id) : cur));
      setNotice(`Permanently deleted the archive for "${toDelete.eventName}".`);
      if (openId === toDelete.id) setOpenId('');
      setToDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this archive.');
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let live = true;
    listEventArchives()
      .then((a) => live && setArchives(a))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load archives.'));
    return () => {
      live = false;
    };
  }, [refreshKey]);

  return (
    <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-[#F5B942]" />
        <h2 className="text-lg font-display font-bold text-white">Archived Events</h2>
      </div>
      <p className="text-xs text-slate-400">
        Final standings saved when a new event was started. Only team standings are kept, no judge emails or individual ratings.
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-400">{notice}</p>}
      {!error && archives === null && <p className="text-sm text-slate-400">Loading...</p>}
      {archives?.length === 0 && <p className="text-sm text-slate-400">No archived events yet.</p>}
      {archives?.map((a) => (
        <div key={a.id} className="border border-[#1E3A5F] rounded-lg bg-black/20">
          <button
            type="button"
            onClick={() => setOpenId(openId === a.id ? '' : a.id)}
            className="w-full text-left px-4 py-3 flex flex-wrap justify-between gap-2"
          >
            <span className="font-semibold text-white">{a.eventName}</span>
            <span className="text-xs text-slate-400">
              {a.archivedAt ? new Date(a.archivedAt as string).toLocaleString() : ''} | {a.totalJudges} judges | {a.totalSubmissions} submissions | by {a.archivedBy}
            </span>
          </button>
          {openId === a.id && (
            <>
                        <table className="w-full text-left text-sm border-t border-[#1E3A5F]">
              <thead>
                <tr className="text-xs text-slate-400">
                  <th className="py-2 px-4">Rank</th>
                  <th className="py-2 px-4">Team</th>
                  <th className="py-2 px-4 text-right">Average (/{a.scoreMax ?? 5})</th>
                </tr>
              </thead>
              <tbody>
                {a.entries.map((e, i) => (
                  <tr key={i} className="border-t border-[#1E3A5F]/50">
                    <td className="py-2 px-4 font-mono-tabular text-[#F5B942]">{e.rank}{e.isTied ? ' (tie)' : ''}</td>
                    <td className="py-2 px-4 text-slate-200">{e.teamName}{e.projectTitle ? ` - ${e.projectTitle}` : ''}</td>
                    <td className="py-2 px-4 text-right font-mono-tabular text-slate-200">{e.averageFormatted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </>
          )}
          <div className="border-t border-[#1E3A5F] px-4 py-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setNotice('');
                setToDelete(a);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50"
            >
              <Trash2 className="w-4 h-4" />
              Delete permanently
            </button>
          </div>
        </div>
      ))}
      <ConfirmDialog
        open={toDelete !== null}
        danger
        busy={deleting}
        title="Delete this archived event permanently?"
        message={
          toDelete
            ? `This permanently deletes the saved final standings of "${toDelete.eventName}" (${toDelete.entries.length} team rows, ${toDelete.totalJudges} judges, ${toDelete.totalSubmissions} submissions recorded). It cannot be undone. Your current event, teams, judges, ratings, admin accounts and other archived events are not touched.`
            : ''
        }
        confirmLabel="Delete permanently"
        requireTypedPhrase={toDelete ? toDelete.eventName.trim() || 'DELETE' : undefined}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </div>
  );
}

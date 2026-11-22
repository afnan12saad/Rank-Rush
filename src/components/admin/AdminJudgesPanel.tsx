import { useMemo, useState, type FormEvent } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  deleteJudgeAndEvaluations,
  saveJudgeRecord,
} from '../../services/arenaService';
import type { Evaluation, Judge } from '../../types/arena';

interface AdminJudgesPanelProps {
  judges: Judge[];
  evaluations: Evaluation[];
  totalTeams: number;
  onNotify: (msg: string) => void;
}

export function AdminJudgesPanel({
  judges,
  evaluations,
  totalTeams,
  onNotify,
}: AdminJudgesPanelProps) {
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Judge | null>(null);

  const evalCountByJudge = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of evaluations) {
      map.set(ev.judgeId, (map.get(ev.judgeId) ?? 0) + 1);
    }
    return map;
  }, [evaluations]);

  const resetForm = () => {
    setEditingJudge(null);
    setName('');
    setEmail('');
    setDepartment('');
    setActive(true);
    setError('');
  };

  const startEdit = (judge: Judge) => {
    setEditingJudge(judge);
    setName(judge.name);
    setEmail(judge.email);
    setDepartment(judge.department);
    setActive(judge.active);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid full name and email address.');
      return;
    }

    setBusy(true);
    try {
      const currentActiveCount = judges.filter((j) => j.active).length;
      const nextActiveCount = editingJudge
        ? currentActiveCount +
          (active && !editingJudge.active
            ? 1
            : !active && editingJudge.active
              ? -1
              : 0)
        : currentActiveCount + (active ? 1 : 0);

      const code = editingJudge
        ? editingJudge.judgeCode
        : `J_${Date.now().toString(36).toUpperCase()}`;

      await saveJudgeRecord({
        existingJudge: editingJudge ?? undefined,
        judgeCode: code,
        name,
        department,
        email,
        accessCode: 'SELF_AUTH',
        active,
        allJudgesCountAfter: nextActiveCount,
      });

      onNotify(
        editingJudge
          ? `Updated judge profile for ${name}.`
          : `Added judge ${name} (${email}).`,
      );
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save judge.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const remainingActive = judges.filter(
        (j) => j.id !== deleteTarget.id && j.active,
      ).length;
      await deleteJudgeAndEvaluations(deleteTarget, remainingActive);
      onNotify(`Removed judge ${deleteTarget.name}.`);
      if (editingJudge?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete judge.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              {editingJudge
                ? `Edit Judge: ${editingJudge.name}`
                : 'Judges Directory'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Judges sign in automatically by entering their name and email on
              the Judge Login page. Use this panel to monitor or manage judge
              entries.
            </p>
          </div>
          {editingJudge && (
            <button
              type="button"
              onClick={() => resetForm()}
              className="text-xs font-semibold text-[#F5B942] hover:underline shrink-0"
            >
              Cancel Editing
            </button>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="judge-name-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Full Name
            </label>
            <input
              id="judge-name-input"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prof. Karthik Nair"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="judge-email-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="judge-email-input"
              type="email"
              required
              maxLength={160}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="judge@college.edu"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="judge-dept-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Department / Note (Optional)
            </label>
            <input
              id="judge-dept-input"
              type="text"
              maxLength={100}
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Computer Science"
              className={inputClass}
            />
          </div>
        </div>

        <div className="pt-1 flex flex-wrap items-center justify-between gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-4 h-4 accent-[#2563EB]"
            />
            Judge Account Active
          </label>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Saving...' : editingJudge ? 'Save Changes' : 'Add Judge'}
          </button>
        </div>
      </form>

      {/* Judge Directory Table */}
      <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E3A5F] flex items-center justify-between">
          <h3 className="text-base font-display font-bold text-white">
            Signed-In & Registered Judges ({judges.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D1E33] border-b border-[#1E3A5F] text-xs font-semibold text-slate-400">
                <th className="py-3 px-4">Judge Name</th>
                <th className="py-3 px-4">Email & Department</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152B46] text-sm">
              {judges.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 px-4 text-center text-slate-400"
                  >
                    No judges yet. Judges appear here automatically once they
                    sign in with their Name and Email.
                  </td>
                </tr>
              ) : (
                judges.map((judge, idx) => {
                  const done = evalCountByJudge.get(judge.id) ?? 0;
                  return (
                    <tr
                      key={judge.id}
                      className={`${
                        idx % 2 === 0 ? 'bg-[#0B1C30]' : 'bg-[#081423]'
                      } hover:bg-[#102742]`}
                    >
                      <td className="py-3 px-4 font-semibold text-white">
                        {judge.name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-mono-tabular text-xs">
                          {judge.email || '-'}
                        </div>
                        {judge.department && (
                          <div className="text-xs text-slate-400">
                            {judge.department}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {judge.active ? (
                          <span className="font-semibold text-[#4ADE80]">
                            Active
                          </span>
                        ) : (
                          <span className="font-semibold text-red-400">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-white">
                        {done} / {totalTeams}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(judge)}
                            aria-label={`Edit ${judge.name}`}
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:bg-[#163050] hover:text-white"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(judge)}
                            aria-label={`Delete ${judge.name}`}
                            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-red-400 hover:bg-red-950/60"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Judge Record"
        message={
          deleteTarget
            ? `Delete judge "${deleteTarget.name}" (${deleteTarget.email})? Any evaluations submitted by this judge will also be removed.`
            : ''
        }
        confirmLabel="Delete Judge"
        danger
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

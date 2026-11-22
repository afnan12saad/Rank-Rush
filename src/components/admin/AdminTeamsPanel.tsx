import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Edit2, Plus, Trash2, Upload } from 'lucide-react';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  deleteTeamAndEvaluations,
  saveTeamRecord,
} from '../../services/arenaService';
import type { EventSettings, PresentationStatus, Team } from '../../types/arena';

interface AdminTeamsPanelProps {
  teams: Team[];
  settings: EventSettings;
  onNotify: (msg: string) => void;
}

async function compressLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 160;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/png', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

export function AdminTeamsPanel({
  teams,
  settings,
  onNotify,
}: AdminTeamsPanelProps) {
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [presentationStatus, setPresentationStatus] =
    useState<PresentationStatus>('Waiting');
  const [orderIndex, setOrderIndex] = useState<number>(teams.length + 1);
  const [tieBreakerRank, setTieBreakerRank] = useState<number>(teams.length + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const resetForm = (nextOrder = teams.length + 1) => {
    setEditingTeam(null);
    setName('');
    setProjectTitle('');
    setDescription('');
    setLogoUrl('');
    setPresentationStatus('Waiting');
    setOrderIndex(nextOrder);
    setTieBreakerRank(nextOrder);
    setError('');
  };

  const startEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setProjectTitle(team.projectTitle);
    setDescription(team.description);
    setLogoUrl(team.logoUrl);
    setPresentationStatus(team.presentationStatus);
    setOrderIndex(team.orderIndex);
    setTieBreakerRank(team.tieBreakerRank || team.orderIndex);
    setError('');
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressLogoFile(file);
      setLogoUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process logo.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await saveTeamRecord({
        existingTeam: editingTeam ?? undefined,
        name,
        projectTitle,
        description,
        logoUrl,
        presentationStatus,
        orderIndex,
        tieBreakerRank,
      });
      onNotify(
        editingTeam ? `Updated ${name}.` : `Added team ${name}.`,
      );
      resetForm(teams.length + (editingTeam ? 1 : 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteTeamAndEvaluations(deleteTarget.id, settings);
      onNotify(`Deleted ${deleteTarget.name} and its evaluation records.`);
      if (editingTeam?.id === deleteTarget.id) resetForm();
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete team.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  return (
    <div className="space-y-6">
      {/* Admin Exclusive Permissions Banner */}
      <div className="p-3.5 rounded-xl bg-[#091A2E] border border-[#1C3B63] text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
          <strong className="text-white">Admin-Exclusive Roster Management:</strong>
          <span>Only administrators can add, edit, or remove teams. Judges have read-only access.</span>
        </div>
        <span className="font-mono-tabular text-[#F5B942] font-semibold bg-[#071322] px-2.5 py-1 rounded border border-[#1E3A5F]">
          {teams.length} Participating Teams
        </span>
      </div>

      {/* Add / Edit Team Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-display font-bold text-white">
              {editingTeam ? `Edit Team: ${editingTeam.name}` : 'Add New Team'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {editingTeam
                ? 'Update team project specifications or display ordering.'
                : 'Admins can add unlimited teams to the competition roster.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editingTeam && (
              <button
                type="button"
                onClick={() => {
                  const nextNum = teams.length + 1;
                  setName(`Team ${String(nextNum).padStart(2, '0')}`);
                  setProjectTitle(`Project Showcase ${nextNum}`);
                  setOrderIndex(nextNum);
                  setTieBreakerRank(nextNum);
                }}
                className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-1.5 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-[#F5B942] hover:bg-[#102640] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Suggest Team {String(teams.length + 1).padStart(2, '0')}
              </button>
            )}
            {editingTeam && (
              <button
                type="button"
                onClick={() => resetForm()}
                className="text-xs font-semibold text-[#F5B942] hover:underline"
              >
                Cancel Editing
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="team-name-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Team Name
            </label>
            <input
              id="team-name-input"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team Alpha"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="team-project-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Project Title
            </label>
            <input
              id="team-project-input"
              type="text"
              required
              maxLength={160}
              value={projectTitle}
              onChange={(e) => setProjectTitle(e.target.value)}
              placeholder="Smart Solar Microgrid Controller"
              className={inputClass}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="team-desc-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Project Summary (Optional)
            </label>
            <input
              id="team-desc-input"
              type="text"
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief overview shown to judges during selection"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="team-order-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Display Order
            </label>
            <input
              id="team-order-input"
              type="number"
              min={1}
              max={1000}
              value={orderIndex}
              onChange={(e) =>
                setOrderIndex(Number.parseInt(e.target.value, 10) || 1)
              }
              className={`${inputClass} font-mono-tabular`}
            />
          </div>

          <div>
            <label
              htmlFor="team-tiebreak-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Tie-Breaker Priority
            </label>
            <input
              id="team-tiebreak-input"
              type="number"
              min={1}
              max={1000}
              value={tieBreakerRank}
              onChange={(e) =>
                setTieBreakerRank(Number.parseInt(e.target.value, 10) || 1)
              }
              className={`${inputClass} font-mono-tabular`}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-xs font-semibold text-slate-200 hover:bg-[#102640] cursor-pointer">
              <Upload className="w-4 h-4 text-[#F5B942]" />
              Upload Team Logo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => void handleLogoUpload(e)}
                className="sr-only"
              />
            </label>
            {logoUrl && (
              <div className="flex items-center gap-2">
                <img
                  src={logoUrl}
                  alt="Team logo preview"
                  className="w-9 h-9 rounded-lg object-cover bg-[#081422]"
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove Logo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            {busy ? 'Saving...' : editingTeam ? 'Save Team Changes' : 'Add Team'}
          </button>
        </div>
      </form>

      {/* Teams Table */}
      <div className="bg-[#091727] border border-[#1E3A5F] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1E3A5F] flex items-center justify-between">
          <h3 className="text-base font-display font-bold text-white">
            Participating Teams ({teams.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0D1E33] border-b border-[#1E3A5F] text-xs font-semibold text-slate-400">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Team & Project</th>
                <th className="py-3 px-4 text-right">Submitted</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152B46] text-sm">
              {teams.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-8 px-4 text-center text-slate-400"
                  >
                    No teams added yet. Add your first project team using the
                    form above.
                  </td>
                </tr>
              ) : (
                teams.map((team, idx) => (
                  <tr
                    key={team.id}
                    className={`${
                      idx % 2 === 0 ? 'bg-[#0B1C30]' : 'bg-[#081423]'
                    } hover:bg-[#102742]`}
                  >
                    <td className="py-3 px-4 font-mono-tabular text-slate-400">
                      {team.orderIndex}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {team.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {team.projectTitle}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#F5B942]">
                      {team.submittedCount || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => startEdit(team)}
                          aria-label={`Edit ${team.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:bg-[#163050] hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(team)}
                          aria-label={`Delete ${team.name}`}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-red-400 hover:bg-red-950/60"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Participating Team"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? ${
                deleteTarget.submittedCount > 0
                  ? `Warning: ${deleteTarget.submittedCount} submitted rating(s) for this team will also be permanently deleted.`
                  : 'This action cannot be undone.'
              }`
            : ''
        }
        confirmLabel="Delete Team"
        danger
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

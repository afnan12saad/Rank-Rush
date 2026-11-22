import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  requireTypedPhrase?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger = false,
  requireTypedPhrase,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);

  if (!open) return null;

  const phraseMatched =
    !requireTypedPhrase || typed.trim() === requireTypedPhrase;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/70 backdrop-blur-xs p-4"
    >
      <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl shadow-2xl max-w-md w-full my-auto p-6 animate-reveal">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            {danger && (
              <div className="w-10 h-10 rounded-lg bg-red-950/70 text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <h2
              id="confirm-dialog-title"
              className="text-lg font-display font-bold text-white"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close confirmation dialog"
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-[#162E4D]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-5">{message}</p>

        {requireTypedPhrase && (
          <div className="mb-5">
            <label
              htmlFor="confirm-phrase-input"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Type{' '}
              <span className="font-mono-tabular text-red-400">
                {requireTypedPhrase}
              </span>{' '}
              to confirm:
            </label>
            <input
              id="confirm-phrase-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireTypedPhrase}
              className="w-full px-3 py-2 rounded-lg border border-[#24436B] bg-[#081422] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-[#24436B] text-sm font-semibold text-slate-300 hover:bg-[#142A45] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={busy || !phraseMatched}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#2563EB] hover:bg-[#1d4ed8]'
            }`}
          >
            {busy ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

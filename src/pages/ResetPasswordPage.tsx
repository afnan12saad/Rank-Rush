import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { supabase } from '../services/supabaseClient';
import { validatePasswordChange } from '../utils/scoring';

type RecoveryState = 'waiting' | 'ready' | 'done' | 'invalid';

// Landing page for the password-recovery email link. Supabase puts the
// recovery token in the URL, the client exchanges it for a temporary
// recovery session (detectSessionInUrl) and fires PASSWORD_RECOVERY. Only
// then do we show the new-password form.
export function ResetPasswordPage() {
  const [state, setState] = useState<RecoveryState>('waiting');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let settled = false;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        settled = true;
        setState('ready');
      }
    });
    // If the link is invalid/expired/already used there is no recovery event;
    // give the exchange a bounded window, then say so.
    const timer = window.setTimeout(() => {
      if (!settled) setState((s) => (s === 'waiting' ? 'invalid' : s));
    }, 8000);
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const validationError = validatePasswordChange({ password, confirmPassword });
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // End the temporary recovery session so the next sign-in is a real one.
      await supabase.auth.signOut();
      setState('done');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update the password. Request a fresh reset link.',
      );
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-10 sm:py-14">
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-xl shadow-black/25 space-y-6">
          <div className="border-b border-[#183152] pb-5 space-y-2">
            <p className="text-xs font-semibold text-[#F5B942]">
              Event Committee Console
            </p>
            <h1 className="text-2xl font-display font-bold text-white">
              Set a New Admin Password
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              You opened a password reset link. Choose a new password for your
              administrator account.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-950/60 text-red-200 text-sm flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {state === 'waiting' && (
            <div className="py-6 text-center text-sm text-slate-400">
              Checking your reset link...
            </div>
          )}

          {state === 'invalid' && (
            <div className="space-y-4">
              <div
                role="alert"
                className="p-4 rounded-lg bg-red-950/60 text-red-200 text-sm flex items-start gap-2.5"
              >
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>
                  This reset link is invalid, expired or already used. Request a
                  fresh one from the admin sign-in page.
                </span>
              </div>
              <Link
                to="/admin/login"
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
              >
                Back to Admin Sign In
              </Link>
            </div>
          )}

          {state === 'ready' && (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reset-new-password" className="text-xs font-semibold text-slate-300">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="text-xs font-semibold text-slate-300">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Repeat the new password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mismatch && (
                  <p className="text-xs text-red-400">
                    New Password and Confirm Password do not match.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy || mismatch}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" />
                {busy ? 'Updating Password...' : 'Update Password'}
              </button>
            </form>
          )}

          {state === 'done' && (
            <div className="space-y-4">
              <div
                role="status"
                className="p-4 rounded-lg bg-[#16A34A]/15 text-sm space-y-1"
              >
                <div className="font-bold text-[#4ADE80] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Password Updated
                </div>
                <p className="text-slate-200">
                  Your administrator password has been changed. Sign in with the
                  new password.
                </p>
              </div>
              <Link
                to="/admin/login"
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
              >
                Go to Admin Sign In
              </Link>
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

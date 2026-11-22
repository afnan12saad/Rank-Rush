import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  LogIn,
  LogOut,
  Mail,
  ShieldAlert,
  User,
  UserCheck,
} from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { useArenaAuth } from '../context/ArenaAuthContext';

export function JudgeLoginPage() {
  const navigate = useNavigate();
  const {
    authReady,
    isAdmin,
    judgeProfile,
    signInJudgeByNameAndEmail,
    logoutAll,
  } = useArenaAuth();

  const [name, setName] = useState(judgeProfile?.name ?? '');
  const [email, setEmail] = useState(judgeProfile?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleJudgeLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInJudgeByNameAndEmail(name, email);
      navigate('/judge/dashboard');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in as a judge. Please check your name and email.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-10 sm:py-16">
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-xl shadow-black/25">
          <div className="mb-6 border-b border-[#183152] pb-5">
            <p className="text-xs font-semibold text-[#F5B942]">
              Judge Access Portal
            </p>
            <h1 className="text-2xl font-display font-bold text-white mt-1">
              Enter Judge Evaluation Portal
            </h1>
            <p className="text-sm text-slate-300 mt-1.5 leading-relaxed">
              Enter your full name and email address to select teams and submit
              your five-criteria project scores. No password or ID code
              required.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-lg bg-red-950/60 text-red-200 text-sm flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {!authReady ? (
            <div className="py-8 text-center text-sm text-slate-400">
              Checking active session...
            </div>
          ) : isAdmin ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#081422] text-sm text-slate-300 leading-relaxed">
                You are currently signed in to the Event Admin Console. Sign out
                from the administrator account before entering as a judge on
                this device.
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/admin"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
                >
                  Return to Admin Console
                </Link>
                <button
                  type="button"
                  onClick={() => void logoutAll()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#24436B] bg-[#091829] text-sm font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out Admin
                </button>
              </div>
            </div>
          ) : judgeProfile ? (
            <div className="space-y-5">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-[#4ADE80]">
                  Judge Session Active
                </div>
                <div className="text-lg font-display font-bold text-white">
                  {judgeProfile.name}
                </div>
                <div className="text-sm text-slate-300">
                  {judgeProfile.email}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/judge/dashboard"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  Open Team Selection Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logoutAll()}
                  className="px-4 py-3 rounded-lg border border-[#24436B] bg-[#091829] text-sm font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                >
                  Switch Judge
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleJudgeLogin(e)} className="space-y-4">
              <div>
                <label
                  htmlFor="judge-name-input"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="judge-name-input"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="judge-email-input"
                  className="block text-sm font-semibold text-slate-200 mb-1.5"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="judge-email-input"
                    type="email"
                    required
                    maxLength={160}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                    autoComplete="email"
                    className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <LogIn className="w-4 h-4" />
                {busy ? 'Entering Portal...' : 'Continue to Judge Dashboard'}
              </button>
            </form>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

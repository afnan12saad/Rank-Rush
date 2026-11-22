import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  Mail,
  MailCheck,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { useArenaAuth } from '../context/ArenaAuthContext';
import {
  buildAdminApprovalEmailUrl,
  validateAdminRegistrationInput,
  MAX_ADMIN_USERS,
} from '../utils/scoring';

type AuthMode = 'signin' | 'register' | 'forgot';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const {
    user,
    authReady,
    isAdmin,
    adminQuota,
    firstAdminInfo,
    pendingAdminRequest,
    signInAdminWithEmail,
    registerAdminWithEmail,
    resendAdminVerificationEmail,
    refreshAdminVerification,
    sendAdminPasswordReset,
    logoutAll,
  } = useArenaAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  // If user becomes admin (e.g. approved in real-time), navigate to /admin
  useEffect(() => {
    if (authReady && isAdmin) {
      navigate('/admin');
    }
  }, [authReady, isAdmin, navigate]);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setNotice('');
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const signedInUser = await signInAdminWithEmail(email, password);
      if (signedInUser.emailVerified) {
        if (isAdmin) {
          navigate('/admin');
        } else {
          setNotice(
            'Signed in. Please wait for an administrator to approve your request.',
          );
        }
      } else {
        setNotice(
          'Your account requires email verification before accessing the Admin Console. Check your inbox or resend the verification link below.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in with email and password.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const validationError = validateAdminRegistrationInput({
      name,
      email,
      password,
      confirmPassword,
      currentAdminCount: adminQuota.count,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    try {
      await registerAdminWithEmail({
        name,
        email,
        password,
        confirmPassword,
      });
      setNotice(
        `Verification email sent to ${email.trim()}. Your request is waiting for administrator approval.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create administrator account.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await sendAdminPasswordReset(email);
      setNotice(
        `Password reset instructions sent to ${email.trim()}. Check your inbox and spam folder.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send password reset email.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyContinue = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const verified = await refreshAdminVerification();
      if (verified) {
        if (isAdmin) {
          navigate('/admin');
        } else {
          setNotice(
            'Email verified! Your request is pending primary administrator approval.',
          );
        }
      } else {
        setError(
          'Email is not verified yet. Click the verification link sent to your email address first, then try again.',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify administrator status.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await resendAdminVerificationEmail();
      setNotice(
        `A fresh verification link was sent to ${user?.email ?? 'your email'}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to resend verification link.',
      );
    } finally {
      setBusy(false);
    }
  };

  const targetFirstAdminEmail =
    pendingAdminRequest?.firstAdminEmail ||
    firstAdminInfo?.email ||
    adminQuota.firstAdminEmail ||
    'Primary Administrator';

  const mailtoLink =
    pendingAdminRequest && targetFirstAdminEmail
      ? buildAdminApprovalEmailUrl({
          firstAdminEmail: targetFirstAdminEmail,
          candidateName: pendingAdminRequest.name,
          candidateEmail: pendingAdminRequest.email,
          code: pendingAdminRequest.verificationCode,
          appUrl: window.location.origin,
        })
      : '';

  const inputClass =
    'w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-[#24436B] bg-[#081422] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]';

  const headingText = isAdmin
    ? 'Administrator Access Verified'
    : user?.isAnonymous
      ? 'Judge Session Active'
      : user && !user.emailVerified
        ? 'Verify Your Admin Email'
      : user && !isAdmin
        ? 'Admin Approval Required'
        : mode === 'register'
          ? 'Create Admin Account'
          : mode === 'forgot'
            ? 'Reset Admin Password'
            : 'Administrator Sign In';

  return (
    <div className="min-h-screen flex flex-col bg-[#071422] text-slate-100">
      <SiteHeader />

      <main className="flex-1 max-w-lg w-full mx-auto px-4 py-10 sm:py-14">
        <div className="bg-[#0D1E33] border border-[#1E3A5F] rounded-xl p-6 sm:p-8 shadow-xl shadow-black/25 space-y-6">
          <div className="border-b border-[#183152] pb-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#F5B942]">
                Event Committee Console
              </p>
              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#081422] text-xs font-semibold font-mono-tabular text-slate-300">
                Max {MAX_ADMIN_USERS} admin accounts
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold text-white">
              {headingText}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Secure organizer management. New administrators need approval from an existing admin.
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

          {notice && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-[#16A34A]/15 text-[#4ADE80] text-sm flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {!authReady ? (
            <div className="py-6 text-center text-sm text-slate-400">
              Checking administrator session...
            </div>
          ) : isAdmin ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#16A34A]/15 text-sm">
                <div className="font-bold text-[#4ADE80] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  Verified Organizer Session Active
                </div>
                <p className="text-slate-200 mt-1">
                  Signed in as <strong>{user?.email}</strong>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/admin"
                  className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors"
                >
                  Open Admin Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => void logoutAll()}
                  className="min-h-[46px] px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-sm font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : user && user.isAnonymous ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#081422] space-y-2 text-sm">
                <div className="font-bold text-[#F5B942] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  Judge Session Active
                </div>
                <p className="text-slate-200 leading-relaxed">
                  You are signed in with a judge scoring session. The Admin
                  Console uses separate administrator accounts, so sign out of
                  the judge session first to sign in or register as an
                  administrator.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to="/judge/dashboard"
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                >
                  Continue Judging
                </Link>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logoutAll()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
                >
                  Sign Out &amp; Switch to Admin Sign In
                </button>
              </div>
            </div>
          ) : user && !user.emailVerified ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#081422] space-y-2 text-sm">
                <div className="font-bold text-[#F5B942] flex items-center gap-2">
                  <MailCheck className="w-4 h-4" />
                  Email Verification Required
                </div>
                <p className="text-slate-200 leading-relaxed">
                  A verification link has been sent to{' '}
                  <strong className="text-white">{user.email}</strong>. Open
                  that link in your inbox (or spam folder) to verify your email
                  address before continuing.
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleVerifyContinue()}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#16A34A] text-white text-sm font-semibold hover:bg-[#15803D] transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                {busy
                  ? 'Checking Verification...'
                  : 'I Have Verified My Email - Continue'}
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleResendVerification()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-200 hover:bg-[#102640] transition-colors disabled:opacity-60"
                >
                  Resend Verification Link
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logoutAll()}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-300 hover:bg-[#102640] transition-colors disabled:opacity-60"
                >
                  Sign Out / Switch Account
                </button>
              </div>
            </div>
          ) : user && !isAdmin ? (
            <div className="space-y-5">
              {/* Approval Pending Banner */}
              <div className="p-4 rounded-xl bg-[#09192C] border border-[#234674] space-y-3">
                <div className="flex items-center gap-2 text-[#F5B942] font-bold text-sm">
                  <Clock className="w-4 h-4 animate-spin text-[#F5B942]" />
                  First Admin Approval Pending
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your join request is waiting for approval. The primary administrator is:{' '}
                  <strong className="text-white block sm:inline font-mono-tabular">
                    {targetFirstAdminEmail}
                  </strong>
                </p>

                <div className="p-3 rounded-lg bg-[#071322] border border-[#173050] text-xs text-slate-300 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Approval Status:</span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold text-[#F5B942] bg-[#F5B942]/10">
                      <span className="w-2 h-2 rounded-full bg-[#F5B942] animate-ping" />
                      Waiting for First Admin
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Candidate Email:</span>
                    <span className="text-white font-mono-tabular">{user.email}</span>
                  </div>
                </div>

                {mailtoLink && (
                  <a
                    href={mailtoLink}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D3B63] hover:bg-[#254d80] text-white text-xs font-semibold transition-colors"
                  >
                    <Send className="w-3.5 h-3.5 text-[#F5B942]" />
                    Send Verification Email to Primary Admin
                  </a>
                )}
              </div>

              <p className="bg-[#081422] p-4 rounded-xl border border-[#1F3D64] text-[11px] text-slate-300 leading-relaxed">
                An existing administrator must approve your request in the
                Admin Console. Once they do, press Check Approval Status below
                to activate your access.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleVerifyContinue()}
                  className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Check Approval Status
                </button>
                <button
                  type="button"
                  onClick={() => void logoutAll()}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#102640] transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {mode !== 'forgot' && (
                <div
                  role="tablist"
                  aria-label="Admin authentication mode"
                  className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#081422]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'signin'}
                    onClick={() => switchMode('signin')}
                    className={`min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      mode === 'signin'
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'register'}
                    onClick={() => switchMode('register')}
                    className={`min-h-[40px] px-3 py-2 rounded-md text-xs font-semibold transition-colors ${
                      mode === 'register'
                        ? 'bg-[#2563EB] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Create Admin Account
                  </button>
                </div>
              )}

              {mode === 'signin' && (
                <form
                  onSubmit={(e) => void handleSignIn(e)}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="admin-signin-email"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Admin Email Address
                    </label>
                    <input
                      id="admin-signin-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="organizer@college.edu"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="admin-signin-password"
                        className="block text-xs font-semibold text-slate-300"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="inline-flex items-center min-h-[44px] text-xs font-semibold text-[#F5B942] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="admin-signin-password"
                        type={showSignInPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignInPassword((v) => !v)}
                        aria-label={
                          showSignInPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white flex items-center"
                      >
                        {showSignInPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4" />
                    {busy ? 'Signing In...' : 'Sign In to Admin Console'}
                  </button>
                </form>
              )}

              {mode === 'register' && (
                <form
                  onSubmit={(e) => void handleRegister(e)}
                  className="space-y-4"
                >
                  <div className="p-3.5 rounded-lg bg-[#081422] border border-[#193254] text-xs text-slate-300 leading-relaxed space-y-1">
                    <p className="font-semibold text-white flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#F5B942]" />
                      First Admin Verification System
                    </p>
                    <p className="text-slate-400">
                      If you are the primary administrator, you will be
                      initialized automatically. If an administrator already
                      exists, your request must be approved by an existing admin.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-register-name"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Full Name
                    </label>
                    <input
                      id="admin-register-name"
                      type="text"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Faculty Coordinator Name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-register-email"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Admin Email Address
                    </label>
                    <input
                      id="admin-register-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="organizer@college.edu"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="admin-register-password"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Password (minimum 8 characters)
                    </label>
                    <div className="relative">
                      <input
                        id="admin-register-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((v) => !v)}
                        aria-label={
                          showRegisterPassword
                            ? 'Hide password'
                            : 'Show password'
                        }
                        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white flex items-center"
                      >
                        {showRegisterPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-register-confirm-password"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="admin-register-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`${inputClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? 'Hide confirm password'
                            : 'Show confirm password'
                        }
                        className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-white flex items-center"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {passwordsMismatch && (
                      <p className="text-xs text-red-400 mt-1">
                        Password and Confirm Password do not match.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    {busy
                      ? 'Creating Account...'
                      : 'Create Account & Request Verification'}
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form
                  onSubmit={(e) => void handleForgotPassword(e)}
                  className="space-y-4"
                >
                  <div>
                    <label
                      htmlFor="admin-forgot-email"
                      className="block text-xs font-semibold text-slate-300 mb-1.5"
                    >
                      Registered Admin Email Address
                    </label>
                    <input
                      id="admin-forgot-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="organizer@college.edu"
                      className={inputClass}
                    />
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      We will send a secure password reset link to this email
                      address.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-[#2563EB] text-white text-sm font-semibold hover:bg-[#1d4ed8] transition-colors disabled:opacity-60"
                  >
                    <KeyRound className="w-4 h-4" />
                    {busy ? 'Sending Reset Link...' : 'Send Password Reset Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#24436B] bg-[#091829] text-xs font-semibold text-slate-200 hover:bg-[#102640] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Sign In
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

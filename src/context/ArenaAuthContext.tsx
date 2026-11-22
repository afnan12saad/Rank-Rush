import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import type {
  AdminQuota,
  AdminRequest,
  EventSettings,
  Judge,
  JudgeSession,
  PublicSummary,
  Team,
} from '../types/arena';
import {
  approveAdminJoinRequest,
  createAdminJoinRequest,
  getFirstAdminInfo,
  registerJudgeByNameEmail,
  rejectAdminJoinRequest,
  subscribeAdminQuota,
  subscribeAdminRequests,
  subscribeEventSettings,
  subscribeMyPendingAdminRequest,
  subscribePublicSummary,
  subscribeTeams,
} from '../services/arenaService';
import {
  MAX_ADMIN_USERS,
  validateAdminRegistrationInput,
  validateJudgeNameAndEmail,
} from '../utils/scoring';

// Minimal app-facing user shape (Supabase session user, normalized).
export interface ArenaUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  isAnonymous: boolean;
}

function mapUser(u: SupabaseUser): ArenaUser {
  return {
    uid: u.id,
    email: u.email ?? null,
    emailVerified: Boolean(u.email_confirmed_at),
    displayName:
      (u.user_metadata?.full_name as string | undefined) ??
      (u.user_metadata?.name as string | undefined) ??
      null,
    isAnonymous: Boolean(u.is_anonymous),
  };
}

function mapAuthError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return new Error('Incorrect email address or password.');
  }
  if (lower.includes('email not confirmed')) {
    return new Error(
      'Confirm your email address first: open the confirmation link Supabase sent you, then sign in.',
    );
  }
  if (lower.includes('user already registered')) {
    return new Error(
      'An account with this email already exists. Switch to Sign In or use Forgot Password.',
    );
  }
  if (lower.includes('password') && lower.includes('at least')) {
    return new Error(msg);
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return new Error(
      'Too many requests. Please wait a few minutes before trying again.',
    );
  }
  if (err instanceof Error) return err;
  return new Error(msg);
}

interface ArenaAuthContextValue {
  user: ArenaUser | null;
  authReady: boolean;
  isAdmin: boolean;
  isFirstAdmin: boolean;
  adminQuota: AdminQuota;
  firstAdminInfo: { email: string; uid: string; name: string } | null;
  pendingAdminRequest: AdminRequest | null;
  adminRequests: AdminRequest[];
  judgeSession: JudgeSession | null;
  judgeProfile: Judge | null;
  settings: EventSettings | null;
  publicSummary: PublicSummary | null;
  teams: Team[];
  dataReady: boolean;
  signInAdminWithEmail: (email: string, password: string) => Promise<ArenaUser>;
  registerAdminWithEmail: (params: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => Promise<ArenaUser>;
  resendAdminVerificationEmail: () => Promise<void>;
  refreshAdminVerification: () => Promise<boolean>;
  sendAdminPasswordReset: (email: string) => Promise<void>;
  requestAdminJoin: (name: string) => Promise<AdminRequest>;
  approveRequest: (request: AdminRequest) => Promise<void>;
  rejectRequest: (requestUid: string) => Promise<void>;
  signInJudgeByNameAndEmail: (name: string, email: string) => Promise<Judge>;
  leaveJudgeSession: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const ArenaAuthContext = createContext<ArenaAuthContextValue | null>(null);

export function ArenaAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ArenaUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isFirstAdmin, setIsFirstAdmin] = useState(false);
  const [adminQuota, setAdminQuota] = useState<AdminQuota>({
    count: 0,
    maxAdmins: MAX_ADMIN_USERS,
  });
  const [firstAdminInfo, setFirstAdminInfo] = useState<{
    email: string;
    uid: string;
    name: string;
  } | null>(null);
  const [pendingAdminRequest, setPendingAdminRequest] =
    useState<AdminRequest | null>(null);
  const [adminRequests, setAdminRequests] = useState<AdminRequest[]>([]);
  const [judgeSession, setJudgeSession] = useState<JudgeSession | null>(null);
  const [judgeProfile, setJudgeProfile] = useState<Judge | null>(null);
  const [settings, setSettings] = useState<EventSettings | null>(null);
  const [publicSummary, setPublicSummary] = useState<PublicSummary | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const lastRegisterEmail = useRef<string>('');

  const resolveRoles = useCallback(async (su: SupabaseUser | null) => {
    if (!su) {
      setIsAdmin(false);
      setIsFirstAdmin(false);
      setPendingAdminRequest(null);
      setJudgeSession(null);
      setJudgeProfile(null);
      setAuthReady(true);
      return;
    }

    // Admin state comes ONLY from the server-side admins table. There is no
    // email-based bootstrap: the first admin is bound manually by the project
    // owner in the Supabase dashboard.
    let adminRow: { uid: string; is_first_admin: boolean } | null = null;
    if (su.email && su.email_confirmed_at) {
      const { data } = await supabase
        .from('admins')
        .select('uid, is_first_admin')
        .eq('uid', su.id)
        .maybeSingle();
      adminRow = data;
    }
    setIsAdmin(Boolean(adminRow));
    setIsFirstAdmin(Boolean(adminRow?.is_first_admin));

    // Confirmed non-admins: surface their pending request; auto-create one
    // (idempotent) so an existing admin can approve them.
    if (su.email && su.email_confirmed_at && !adminRow) {
      try {
        const { data: req } = await supabase
          .from('admin_requests')
          .select('*')
          .eq('uid', su.id)
          .order('requested_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (req) {
          setPendingAdminRequest(
            req.status === 'pending'
              ? ({
                  ...req,
                  verificationCode: req.verification_code,
                  requestedAt: req.requested_at,
                } as unknown as AdminRequest)
              : null,
          );
        } else {
          setPendingAdminRequest(null);
          const created = await createAdminJoinRequest({
            uid: su.id,
            email: su.email,
            name:
              (su.user_metadata?.full_name as string | undefined) ??
              su.email.split('@')[0],
          });
          if (created) setPendingAdminRequest(created);
        }
      } catch {
        setPendingAdminRequest(null);
      }
    } else {
      setPendingAdminRequest(null);
    }

    // Judge profile is the judges row owned by this auth user (anonymous or not).
    try {
      const { data: judgeRow } = await supabase
        .from('judges')
        .select('*')
        .eq('uid', su.id)
        .maybeSingle();
      if (judgeRow && judgeRow.active) {
        setJudgeProfile({
          id: judgeRow.id,
          judgeCode: judgeRow.judge_code,
          name: judgeRow.name,
          department: judgeRow.department,
          email: judgeRow.email,
          uid: judgeRow.uid,
          active: judgeRow.active,
          createdAt: judgeRow.created_at,
          updatedAt: judgeRow.updated_at,
        });
        setJudgeSession({
          uid: su.id,
          judgeId: judgeRow.id,
          accessCode: 'SELF_AUTH',
        });
      } else {
        setJudgeSession(null);
        setJudgeProfile(null);
      }
    } catch {
      setJudgeSession(null);
      setJudgeProfile(null);
    }

    setAuthReady(true);
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const su = session?.user ?? null;
      setUser(su ? mapUser(su) : null);
      void resolveRoles(su);
    });
    return () => subscription.unsubscribe();
  }, [resolveRoles]);

  // Global event data
  useEffect(() => {
    let settingsLoaded = false;
    let teamsLoaded = false;
    const markReady = () => {
      if (settingsLoaded && teamsLoaded) setDataReady(true);
    };
    const unsubSettings = subscribeEventSettings((s) => {
      setSettings(s);
      settingsLoaded = true;
      markReady();
    });
    const unsubSummary = subscribePublicSummary(setPublicSummary);
    const unsubQuota = subscribeAdminQuota(setAdminQuota);
    const unsubTeams = subscribeTeams((t) => {
      setTeams(t);
      teamsLoaded = true;
      markReady();
    });
    void getFirstAdminInfo().then((info) => {
      setFirstAdminInfo(info ? { email: info.email, uid: info.uid, name: '' } : null);
    });
    return () => {
      unsubSettings();
      unsubSummary();
      unsubQuota();
      unsubTeams();
    };
  }, []);

  // All admin requests for admins
  useEffect(() => {
    if (!isAdmin) {
      setAdminRequests([]);
      return;
    }
    return subscribeAdminRequests(setAdminRequests);
  }, [isAdmin]);

  // Watch own request; when an admin approves it, the admins row appears and
  // a fresh resolveRoles promotes the session.
  useEffect(() => {
    if (!user || isAdmin) return;
    return subscribeMyPendingAdminRequest(user.uid, () => {
      void supabase.auth.getUser().then(({ data }) => {
        void resolveRoles(data.user ?? null);
      });
    });
  }, [user, isAdmin, resolveRoles]);

  const signInAdminWithEmail = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        throw new Error('Enter both your email address and password.');
      }
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        setUser(mapUser(data.user));
        await resolveRoles(data.user);
        return mapUser(data.user);
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [resolveRoles],
  );

  const registerAdminWithEmail = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) => {
      const validationError = validateAdminRegistrationInput({ ...params });
      if (validationError) throw new Error(validationError);
      try {
        lastRegisterEmail.current = params.email.trim();
        const { data, error } = await supabase.auth.signUp({
          email: params.email.trim(),
          password: params.password,
          options: {
            data: { full_name: params.name.trim().slice(0, 100) },
            emailRedirectTo: `${window.location.origin}/admin/login`,
          },
        });
        if (error) throw error;
        // With email confirmation ON there is no session yet; the join
        // request is auto-created on the first sign-in after confirmation.
        const mapped = mapUser(data.user as SupabaseUser);
        setUser(data.session ? mapped : null);
        if (data.session) await resolveRoles(data.user as SupabaseUser);
        return mapped;
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [resolveRoles],
  );

  const resendAdminVerificationEmail = useCallback(async () => {
    const email = user?.email ?? lastRegisterEmail.current;
    if (!email) {
      throw new Error('Enter your email address on the register form first.');
    }
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/admin/login` },
      });
      if (error) throw error;
    } catch (err) {
      throw mapAuthError(err);
    }
  }, [user]);

  const refreshAdminVerification = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;
    setUser(mapUser(data.user));
    await resolveRoles(data.user);
    return Boolean(data.user.email_confirmed_at);
  }, [resolveRoles]);

  const sendAdminPasswordReset = useCallback(async (email: string) => {
    const cleanEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Enter a valid email address.');
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/admin/login`,
      });
      if (error) throw error;
    } catch (err) {
      throw mapAuthError(err);
    }
  }, []);

  const requestAdminJoin = useCallback(
    async (name: string) => {
      if (!user || !user.email) {
        throw new Error('Sign in with email and password first.');
      }
      const req = await createAdminJoinRequest({
        uid: user.uid,
        email: user.email,
        name,
      });
      setPendingAdminRequest(req);
      return req;
    },
    [user],
  );

  const approveRequest = useCallback(
    async (request: AdminRequest) => {
      if (!user || !isAdmin) {
        throw new Error('Only active administrators can approve access.');
      }
      await approveAdminJoinRequest(request.uid, user.email ?? 'admin');
    },
    [user, isAdmin],
  );

  const rejectRequest = useCallback(
    async (requestUid: string) => {
      if (!isAdmin) {
        throw new Error('Only active administrators can reject requests.');
      }
      await rejectAdminJoinRequest(requestUid);
    },
    [isAdmin],
  );

  const signInJudgeByNameAndEmail = useCallback(
    async (name: string, email: string) => {
      const validationErr = validateJudgeNameAndEmail(name, email);
      if (validationErr) throw new Error(validationErr);

      let uid: string;
      const { data: sessionData } = await supabase.auth.getSession();
      const current = sessionData.session?.user ?? null;
      if (current && !current.is_anonymous) {
        throw new Error(
          'You are currently signed in as an Administrator. Sign out from Admin Console before entering as a Judge.',
        );
      }
      if (current) {
        uid = current.id;
      } else {
        try {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          uid = data.user!.id;
          setUser(mapUser(data.user as SupabaseUser));
        } catch (err) {
          throw mapAuthError(err);
        }
      }

      const profile = await registerJudgeByNameEmail({ uid }, name, email);
      setJudgeSession({ uid, judgeId: profile.id, accessCode: 'SELF_AUTH' });
      setJudgeProfile(profile);
      return profile;
    },
    [],
  );

  // Leaving the judge session signs out the anonymous auth session; the
  // judges row (and scores) stay on the server.
  const leaveJudgeSession = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setJudgeSession(null);
    setJudgeProfile(null);
  }, []);

  const logoutAll = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    setIsFirstAdmin(false);
    setPendingAdminRequest(null);
    setJudgeSession(null);
    setJudgeProfile(null);
  }, []);

  return (
    <ArenaAuthContext.Provider
      value={{
        user,
        authReady,
        isAdmin,
        isFirstAdmin,
        adminQuota,
        firstAdminInfo,
        pendingAdminRequest,
        adminRequests,
        judgeSession,
        judgeProfile,
        settings,
        publicSummary,
        teams,
        dataReady,
        signInAdminWithEmail,
        registerAdminWithEmail,
        resendAdminVerificationEmail,
        refreshAdminVerification,
        sendAdminPasswordReset,
        requestAdminJoin,
        approveRequest,
        rejectRequest,
        signInJudgeByNameAndEmail,
        leaveJudgeSession,
        logoutAll,
      }}
    >
      {children}
    </ArenaAuthContext.Provider>
  );
}

export function useArenaAuth(): ArenaAuthContextValue {
  const ctx = useContext(ArenaAuthContext);
  if (!ctx) {
    throw new Error('useArenaAuth must be used inside ArenaAuthProvider');
  }
  return ctx;
}

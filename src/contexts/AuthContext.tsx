import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getDirectoryListingReminderKey } from '@/lib/directoryListingReminder';
import { AuthStatusRequests } from '@/lib/authStatusRequests';

interface AgreementSetting {
  enabled: boolean;
}

const ADMIN_MODE_KEY = 'adminModeActive';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  statusError: string | null;
  isAdmin: boolean;
  isManufacturer: boolean;
  hasSignedAgreement: boolean;
  requiresPasswordReset: boolean;
  isAdminModeActive: boolean;
  isAgreementRequired: boolean;
  toggleAdminMode: () => void;
  refreshUserStatus: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const statusRequests = useRef(new AuthStatusRequests());
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManufacturer, setIsManufacturer] = useState(false);
  const [hasSignedAgreement, setHasSignedAgreement] = useState(false);
  const [requiresPasswordReset, setRequiresPasswordReset] = useState(false);
  const [isAdminModeActive, setIsAdminModeActive] = useState(() => {
    const stored = localStorage.getItem(ADMIN_MODE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [isAgreementRequired, setIsAgreementRequired] = useState(true);
  const [agreementSettingLoaded, setAgreementSettingLoaded] = useState(false);

  // Fetch global agreement setting
  useEffect(() => {
    const fetchAgreementSetting = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'agreement_required')
          .maybeSingle();
        const value = data?.value as unknown as AgreementSetting | undefined;
        setIsAgreementRequired(value?.enabled ?? true);
      } finally {
        setAgreementSettingLoaded(true);
      }
    };

    fetchAgreementSetting();

    // Subscribe to changes
    const channel = supabase
      .channel('app_settings_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=eq.agreement_required',
        },
        (payload) => {
          const value = payload.new.value as unknown as AgreementSetting | undefined;
          setIsAgreementRequired(value?.enabled ?? true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const lastActiveUpdated = useRef(false);

  const updateLastActive = async (userId: string) => {
    if (lastActiveUpdated.current) return;
    lastActiveUpdated.current = true;
    await supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', userId);
  };

  const checkUserStatus = async (userId: string) => {
    const request = statusRequests.current.begin(userId);
    try {
    const [rolesResult, profileResult, passwordResetResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId),
      supabase
        .from('profiles')
        .select('agreement_signed_at, skip_agreement')
        .eq('id', userId)
        .maybeSingle(),
      (supabase as any).rpc('current_user_requires_password_reset')
    ]);
    if (!statusRequests.current.isCurrent(request)) return;
    if (rolesResult.error || profileResult.error || passwordResetResult.error) {
      throw new Error('Account access could not be checked. Please try again.');
    }
    const roles = (rolesResult.data || []).map((r: any) => r.role);
    setIsAdmin(roles.includes('admin'));
    setIsManufacturer(roles.includes('manufacturer'));
    setHasSignedAgreement(!!profileResult.data?.agreement_signed_at || !!profileResult.data?.skip_agreement);
    setRequiresPasswordReset(Boolean(passwordResetResult.data));
    statusRequests.current.resolve(request);
    setStatusError(null);
    setLoading(false);

    void updateLastActive(userId).catch(() => {});
    } catch {
      if (!statusRequests.current.isCurrent(request)) return;
      // Never turn a failed lookup into a role, agreement or reset decision.
      if (!statusRequests.current.hasResolved) {
        setStatusError('Account access could not be checked. Please try again.');
      }
      setLoading(false);
      throw new Error('Account access could not be checked. Please try again.');
    }
  };

  useEffect(() => {
    let disposed = false;
    let eventReceived = false;
    const applySession = (session: Session | null) => {
      if (disposed) return;
      const changed = statusRequests.current.activate(session?.user.id ?? null);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (changed) {
          setIsAdmin(false);
          setIsManufacturer(false);
          setHasSignedAgreement(false);
          setRequiresPasswordReset(false);
          setStatusError(null);
          lastActiveUpdated.current = false;
        }
        if (!statusRequests.current.hasResolved) setLoading(true);
        // Defer client calls outside the auth callback; keep same-user lessons mounted.
        setTimeout(() => {
          if (!disposed) void checkUserStatus(session.user.id).catch(() => {});
        }, 0);
      } else {
        setIsAdmin(false);
        setIsManufacturer(false);
        setHasSignedAgreement(false);
        setRequiresPasswordReset(false);
        setStatusError(null);
        setLoading(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      eventReceived = true;
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!eventReceived) applySession(session);
    }).catch(() => {
      if (!disposed && !eventReceived) {
        setStatusError('Account access could not be checked. Please try again.');
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      statusRequests.current.invalidate();
      subscription.unsubscribe();
    };
  }, []);

  const toggleAdminMode = () => {
    setIsAdminModeActive(prev => {
      const newValue = !prev;
      localStorage.setItem(ADMIN_MODE_KEY, String(newValue));
      return newValue;
    });
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    if (user) {
      sessionStorage.removeItem(getDirectoryListingReminderKey(user.id));
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshUserStatus = async () => {
    if (user) {
      await checkUserStatus(user.id);
    } else {
      const { error } = await supabase.auth.getSession();
      if (error) throw error;
      window.location.reload();
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || !agreementSettingLoaded,
      statusError,
      isAdmin,
      isManufacturer,
      hasSignedAgreement,
      requiresPasswordReset,
      isAdminModeActive,
      isAgreementRequired,
      toggleAdminMode,
      refreshUserStatus,
      signIn,
      signUp,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

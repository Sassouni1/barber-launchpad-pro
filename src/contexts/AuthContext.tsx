import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AgreementSetting {
  enabled: boolean;
}

const ADMIN_MODE_KEY = 'adminModeActive';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isManufacturer: boolean;
  hasSignedAgreement: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [isManufacturer, setIsManufacturer] = useState(false);
  const [hasSignedAgreement, setHasSignedAgreement] = useState(false);
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

  const checkUserStatus = async (userId: string) => {
    const [rolesResult, profileResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId),
      supabase
        .from('profiles')
        .select('agreement_signed_at, skip_agreement')
        .eq('id', userId)
        .maybeSingle()
    ]);
    
    const roles = (rolesResult.data || []).map((r: any) => r.role);
    setIsAdmin(roles.includes('admin'));
    setIsManufacturer(roles.includes('manufacturer'));
    setHasSignedAgreement(!!profileResult.data?.agreement_signed_at || !!profileResult.data?.skip_agreement);
    setLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setLoading(true); // Reset loading when new session detected to prevent race condition
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => {
          checkUserStatus(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
        setIsManufacturer(false);
        setHasSignedAgreement(false);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkUserStatus(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const refreshUserStatus = async () => {
    if (user) {
      await checkUserStatus(user.id);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || !agreementSettingLoaded,
      isAdmin,
      isManufacturer,
      hasSignedAgreement,
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

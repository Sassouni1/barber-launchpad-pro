import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_MODE_KEY = 'adminModeActive';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  hasSignedAgreement: boolean;
  isAdminModeActive: boolean;
  toggleAdminMode: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSignedAgreement, setHasSignedAgreement] = useState(false);
  const [isAdminModeActive, setIsAdminModeActive] = useState(() => {
    const stored = localStorage.getItem(ADMIN_MODE_KEY);
    return stored === null ? true : stored === 'true';
  });

  const checkUserStatus = async (userId: string) => {
    // Check admin role and agreement status in parallel
    const [adminResult, profileResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('agreement_signed_at, skip_agreement')
        .eq('id', userId)
        .maybeSingle()
    ]);
    
    setIsAdmin(!!adminResult.data);
    setHasSignedAgreement(!!profileResult.data?.agreement_signed_at || !!profileResult.data?.skip_agreement);
    setLoading(false);
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Defer Supabase calls with setTimeout to prevent deadlock
        setTimeout(() => {
          checkUserStatus(session.user.id);
        }, 0);
      } else {
        setIsAdmin(false);
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

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAdmin,
      hasSignedAgreement,
      isAdminModeActive,
      toggleAdminMode,
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

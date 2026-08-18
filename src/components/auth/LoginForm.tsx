import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

interface LoginFormProps {
  showCreateLink?: boolean;
  logAccessOnSuccess?: boolean;
}

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export function LoginForm({ showCreateLink = false, logAccessOnSuccess = false }: LoginFormProps) {
  const [loading, setLoading] = useState(false);
  const [checkingReset, setCheckingReset] = useState(false);
  const [resetRequired, setResetRequired] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [recoverySubmitted, setRecoverySubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const lastCheckedEmail = useRef('');
  const navigate = useNavigate();

  const normalizedEmail = email.trim().toLowerCase();


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && event !== 'PASSWORD_RECOVERY') {
        navigate('/dashboard', { replace: true });
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/dashboard', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    setResetEmailSent(false);
    setRecoverySubmitted(false);
    setPassword('');


    if (!isValidEmail(normalizedEmail)) {
      setResetRequired(false);
      lastCheckedEmail.current = '';
      return;
    }

    const timer = window.setTimeout(async () => {
      if (lastCheckedEmail.current === normalizedEmail) return;
      lastCheckedEmail.current = normalizedEmail;
      setCheckingReset(true);
      const { data, error } = await (supabase as any).rpc('password_reset_required_for_email', {
        _email: normalizedEmail,
      });
      if (!error) {
        setResetRequired(Boolean(data));
      }
      setCheckingReset(false);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [normalizedEmail]);

  const sendResetEmail = async () => {
    if (!isValidEmail(normalizedEmail)) {
      toast.error('Enter the account email first');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setResetEmailSent(true);
      toast.success('Password reset link sent');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const submitRecoveryRequest = async () => {
    if (!isValidEmail(normalizedEmail)) {
      toast.error('Enter the account email first');
      return;
    }

    setLoading(true);
    try {
      await supabase.functions.invoke('password-recovery-request', {
        body: {
          email: normalizedEmail,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
    } catch {
      // Response is intentionally generic — never reveal delivery details.
    } finally {
      setRecoverySubmitted(true);
      setLoading(false);
      toast.success('Secure recovery request processed');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (forgotMode) {
      await submitRecoveryRequest();
      return;
    }

    if (resetRequired) {
      await sendResetEmail();
      return;
    }



    setLoading(true);

    try {
      // Re-check server-side right before sign-in (covers browser autofill,
      // where the debounced email check never ran).
      const { data: mustReset } = await (supabase as any).rpc('password_reset_required_for_email', {
        _email: normalizedEmail,
      });
      if (mustReset) {
        lastCheckedEmail.current = normalizedEmail;
        setResetRequired(true);
        setPassword('');
        setLoading(false);
        await sendResetEmail();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Welcome back!');
        if (logAccessOnSuccess) {
          import('@/lib/accessLog').then(({ logAccess }) =>
            logAccess({ event_type: 'login', metadata: { email: normalizedEmail } })
          );
        }
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo size="lg" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {resetRequired ? 'Reset Your Password' : 'Welcome Back'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {resetRequired ? 'Create a new password to access your account' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative mt-1">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="pr-10"
                  autoComplete="email"
                />
                {checkingReset && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            {resetRequired ? (
              <div className="rounded-md border border-border/70 bg-card/70 p-4 text-sm text-muted-foreground">
                {resetEmailSent ? (
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 text-primary" />
                    <p>Check that inbox for the reset link. It opens the Create Password and Confirm Password screen.</p>
                  </div>
                ) : (
                  <p>This account needs a fresh password. Send the reset link, then use it to create and confirm the new password.</p>
                )}
              </div>
            ) : (
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full gold-gradient text-primary-foreground hover:opacity-90"
            disabled={loading || checkingReset}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {resetRequired ? 'Sending reset...' : 'Signing in...'}
              </>
            ) : resetRequired ? (
              'Send Reset Link'
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        {showCreateLink && !resetRequired && (
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/create" className="text-primary hover:underline font-medium">
              Create one
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
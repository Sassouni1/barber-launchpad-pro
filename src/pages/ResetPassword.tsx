import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session?.user) {
        setHasSession(true);
        setCheckingSession(false);
      }
    });

    const run = async () => {
      // Branded short-link path: /reset-password/<opaque-code>
      const match = window.location.pathname.match(/^\/reset-password\/([A-Za-z0-9_-]{32,64})$/);
      if (match) {
        const code = match[1];
        // Strip the code from browser history immediately.
        window.history.replaceState({}, '', '/reset-password');
        try {
          const { data, error } = await supabase.functions.invoke('request-password-reset', {
            body: { action: 'resolve-reset-link', code },
          });
          const tokenHash = (data as any)?.token_hash;
          if (!error && tokenHash) {
            const { error: otpError } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            });
            if (!cancelled && !otpError) {
              setHasSession(true);
              setCheckingSession(false);
              return;
            }
          }
        } catch {
          /* fall through to generic failure */
        }
        if (!cancelled) {
          toast.error('This reset link is invalid or has expired. Request a new one.');
          setHasSession(false);
          setCheckingSession(false);
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setHasSession(Boolean(session?.user));
      setCheckingSession(false);
    };

    run();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);


  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }

      await (supabase as any).rpc('complete_current_user_password_reset');
      await supabase.auth.signOut();
      toast.success('Password updated. Sign in with the new password.');
      navigate('/login', { replace: true });
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
          <h1 className="text-3xl font-display font-bold text-foreground">Create Password</h1>
          <p className="mt-2 text-muted-foreground">Confirm your new password to finish the reset</p>
        </div>

        {checkingSession ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : hasSession ? (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="password">Create Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create password"
                    required
                    className="pr-10"
                    autoComplete="new-password"
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

              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    required
                    className="pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full gold-gradient text-primary-foreground hover:opacity-90" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>
        ) : (
          <div className="space-y-4 rounded-md border border-border/70 bg-card/70 p-4 text-center">
            <p className="text-sm text-muted-foreground">Open the reset link from your email to create a new password.</p>
            <Button variant="outline" onClick={() => navigate('/login')} className="w-full">
              Back to Login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
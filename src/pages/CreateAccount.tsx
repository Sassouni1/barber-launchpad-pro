import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, LifeBuoy, LogIn, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Checkbox } from '@/components/ui/checkbox';
import { resolvePostAuthPath } from '@/lib/metaReviewerLanding';
import {
  CHECKOUT_SESSION_KEY, checkoutProblemText, isCheckoutSessionId, takeCheckoutSessionFromSearch, toCheckoutProblem,
  type CheckoutProblem,
} from '@/lib/checkoutSignup';

export default function CreateAccount() {
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'details' | 'no_match'>('email');
  const [matchedVia, setMatchedVia] = useState<'purchase' | 'member_tag'>('purchase');
  const navigate = useNavigate();
  const location = useLocation();
  const fromRef = useRef((location.state as { from?: Parameters<typeof resolvePostAuthPath>[1] } | null)?.from);
  // Paid on-site checkout: the session id is the proof; the server verifies it with Stripe.
  const [checkoutSession, setCheckoutSession] = useState<string | null>(() => {
    const fromUrl = takeCheckoutSessionFromSearch(location.search).sessionId;
    if (fromUrl) return fromUrl;
    try { const saved = sessionStorage.getItem(CHECKOUT_SESSION_KEY); return isCheckoutSessionId(saved) ? saved : null; } catch { return null; }
  });
  const [checkoutState, setCheckoutState] = useState<'checking' | 'verified' | CheckoutProblem>('checking');

  useEffect(() => {
    const { sessionId, rest } = takeCheckoutSessionFromSearch(location.search);
    if (!sessionId) return;
    try { sessionStorage.setItem(CHECKOUT_SESSION_KEY, sessionId); } catch { /* ignore */ }
    navigate({ pathname: location.pathname, search: rest }, { replace: true, state: location.state });
  }, [location.search, location.pathname, location.state, navigate]);

  const callCheckoutSignup = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('member-checkout-signup', { body });
    if (data) return data as { ok: boolean; reason?: string; status?: string };
    let parsed: { ok: boolean; reason?: string } | null = null;
    try { parsed = await (error as any)?.context?.json?.(); } catch { /* ignore */ }
    return parsed ?? { ok: false, reason: 'check_unavailable' };
  };

  const verifyCheckout = async (sessionId: string) => {
    setCheckoutState('checking');
    const res = await callCheckoutSignup({ action: 'verify', sessionId });
    setCheckoutState(res.ok ? 'verified' : toCheckoutProblem(res.reason));
  };

  useEffect(() => {
    if (checkoutSession) void verifyCheckout(checkoutSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSession]);

  const leaveCheckoutPath = () => {
    try { sessionStorage.removeItem(CHECKOUT_SESSION_KEY); } catch { /* ignore */ }
    setCheckoutSession(null);
    setStep('email');
  };

  useEffect(() => {
    const goAfterAuth = (user: Parameters<typeof resolvePostAuthPath>[0]) => {
      const { path, state } = resolvePostAuthPath(user, fromRef.current);
      navigate(path, { replace: true, state });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        goAfterAuth(session.user);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        goAfterAuth(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const SUPPORT_EMAIL = 'Thebarberlaunch@gmail.com';

  const callSignup = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('member-signup', { body });
    if (data) return data as { ok: boolean; reason?: string; via?: string };
    let parsed: { ok: boolean; reason?: string; via?: string } | null = null;
    try { parsed = await (error as any)?.context?.json?.(); } catch { /* ignore */ }
    return parsed ?? { ok: false, reason: 'check_unavailable' };
  };

  const showProblem = (reason?: string) => {
    if (reason === 'no_purchase') { setStep('no_match'); return; }
    const messages: Record<string, string> = {
      rate_limited: 'Too many tries. Please wait an hour and try again.',
      invalid_email: 'Please enter a valid email address.',
      weak_password: 'Password must be at least 8 characters.',
      name_required: 'Please enter your first and last name.',
    };
    toast.error(messages[reason ?? ''] ?? "We couldn't check right now. Please try again in a few minutes.");
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await callSignup({ action: 'check', email: email.trim() });
      if (res.ok) {
        setMatchedVia(res.via === 'member_tag' ? 'member_tag' : 'purchase');
        setStep('details');
      }
      else showProblem(res.reason);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agreedToTerms) {
      toast.error('Please agree to the Terms to continue');
      return;
    }

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
      if (checkoutSession && checkoutState === 'verified') {
        // The server re-verifies the paid checkout, then creates exactly one account for it.
        const res = await callCheckoutSignup({
          action: 'create',
          sessionId: checkoutSession,
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          redirectTo: `${window.location.origin}/`,
        });
        if (res.ok) {
          try { sessionStorage.removeItem(CHECKOUT_SESSION_KEY); } catch { /* ignore */ }
          setConfirmSentTo(email.trim());
        } else if (res.reason === 'email_in_use') {
          toast.error('An account already uses this email. Sign in, or choose a different email.');
        } else if (['invalid_email', 'weak_password', 'name_required'].includes(res.reason ?? '')) {
          showProblem(res.reason);
        } else {
          setCheckoutState(toCheckoutProblem(res.reason));
        }
        return;
      }
      // The server re-checks the purchase and only then creates the account.
      const res = await callSignup({
        action: 'create',
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        redirectTo: `${window.location.origin}/`,
      });
      if (res.ok) setConfirmSentTo(email.trim());
      else showProblem(res.reason);
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
            Create Account
          </h1>
          <p className="mt-2 text-muted-foreground">
            For Barber Launch customers
          </p>
        </div>

        {confirmSentTo ? (
          <div role="status" className="space-y-4 rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <h2 className="text-xl font-display font-semibold text-foreground">Confirm your email</h2>
            <p className="text-muted-foreground">
              We sent a confirmation link to <span className="font-medium text-foreground break-all">{confirmSentTo}</span>. Open it, then sign in.
            </p>
            <p className="text-sm text-muted-foreground">
              Already have an account with this email? Sign in, or reset your password from the sign-in page.
            </p>
            <Button asChild className="w-full"><Link to="/login">Go to sign in</Link></Button>
          </div>
        ) : checkoutSession && checkoutState === 'checking' ? (
          <div role="status" className="flex items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-card p-6 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />Checking your payment...
          </div>
        ) : checkoutSession && checkoutState !== 'verified' ? (
          <div role="alert" className="space-y-4 rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <h2 className="text-xl font-display font-semibold text-foreground">{checkoutProblemText[checkoutState].title}</h2>
            <p className="text-muted-foreground">{checkoutProblemText[checkoutState].body}</p>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full gold-gradient text-primary-foreground hover:opacity-90">
                <Link to="/login"><LogIn className="w-4 h-4 mr-2" />Sign in</Link>
              </Button>
              {['not_verified', 'in_progress', 'check_unavailable'].includes(checkoutState) && (
                <Button variant="outline" className="w-full" onClick={() => void verifyCheckout(checkoutSession)}>Try again</Button>
              )}
              {checkoutState === 'not_verified' && (
                <Button variant="outline" className="w-full" onClick={leaveCheckoutPath}>Use my checkout email instead</Button>
              )}
              <Button asChild variant="ghost" className="w-full">
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Barber Launch account access')}`}><LifeBuoy className="w-4 h-4 mr-2" />Contact Support</a>
              </Button>
            </div>
          </div>
        ) : step === 'no_match' ? (
          <div role="alert" className="space-y-4 rounded-2xl border border-primary/30 bg-card p-6 text-center">
            <h2 className="text-xl font-display font-semibold text-foreground">We couldn't verify a purchase</h2>
            <p className="text-muted-foreground">
              We couldn't verify a purchase with those details. Use the email you used at checkout. If you already have an account, sign in; if you purchased with a different email or phone, contact Barber Launch Support.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full gold-gradient text-primary-foreground hover:opacity-90">
                <Link to="/login"><LogIn className="w-4 h-4 mr-2" />Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Barber Launch account access')}`}><LifeBuoy className="w-4 h-4 mr-2" />Contact Support</a>
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setStep('email')}>Try another email</Button>
            </div>
          </div>
        ) : step === 'email' && !checkoutSession ? (
          <form onSubmit={handleCheck} className="space-y-6">
            <div>
              <Label htmlFor="checkout-email">Email used at checkout</Label>
              <Input
                id="checkout-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                aria-describedby="checkout-email-help"
                className="mt-1"
              />
              <p id="checkout-email-help" className="mt-1 text-xs text-muted-foreground">
                Accounts are for Barber Launch customers. We'll check your purchase before creating your account.
              </p>
            </div>
            <Button type="submit" className="w-full gold-gradient text-primary-foreground hover:opacity-90" disabled={loading}>
              {loading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking your purchase...</>) : 'Continue'}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Bought with a phone number only?{' '}
              <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Barber Launch account access')}`} className="text-primary hover:underline">Contact Barber Launch Support</a>.
            </p>
          </form>
        ) : (
        <form onSubmit={handleSignUp} className="space-y-6">
          {checkoutSession ? (
            <div role="status" className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                <span className="font-medium">Payment verified.</span> Choose the email you want to sign in with. It doesn't have to be the one you used at checkout. We'll send a confirmation link to it.
              </p>
            </div>
          ) : (
            <p role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
              {matchedVia === 'member_tag' ? 'Member access approved by Barber Launch for' : 'Purchase found for'}{' '}
              <span className="font-medium break-all">{email.trim()}</span>. Finish creating your account.{' '}
              <button type="button" className="text-primary hover:underline" onClick={() => setStep('email')}>Change</button>
            </p>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  className="mt-1"
                />
              </div>
            </div>
            {checkoutSession && (
              <div>
                <Label htmlFor="login-email">Login email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="mt-1"
                />
              </div>
            )}
            <div>
              <Label htmlFor="phone">Phone Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className="pr-10"
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
                  placeholder="Confirm your password"
                  required
                  className="pr-10"
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

          <div className="flex items-start gap-2">
            <Checkbox
              id="agree"
              checked={agreedToTerms}
              onCheckedChange={(v) => setAgreedToTerms(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="agree" className="text-sm text-muted-foreground font-normal leading-snug cursor-pointer">
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="text-primary hover:underline">
                Terms & Conditions
              </Link>
            </Label>
          </div>


          <Button 
            type="submit" 
            className="w-full gold-gradient text-primary-foreground hover:opacity-90"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating account...
              </>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

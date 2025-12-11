import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function Auth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Logged in successfully');
        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success('Account created! You can now log in.');
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const becomeAdmin = async () => {
    setLoading(true);
    try {
      // First check if logged in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Quick signup and login
        if (!email || !password) {
          toast.error('Enter email and password first');
          setLoading(false);
          return;
        }
        
        // Try signup
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        
        if (signUpError && !signUpError.message.includes('already registered')) {
          throw signUpError;
        }
        
        // Login
        const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
        
        // Add admin role
        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: data.user.id,
          role: 'admin',
        });
        
        if (roleError && !roleError.message.includes('duplicate')) {
          throw roleError;
        }
        
        toast.success('You are now an admin!');
        navigate('/admin/course-builder');
      } else {
        // Already logged in, just add role
        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: user.id,
          role: 'admin',
        });
        
        if (roleError && !roleError.message.includes('duplicate')) {
          throw roleError;
        }
        
        toast.success('You are now an admin!');
        navigate('/admin/course-builder');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo className="mx-auto mb-6" />
          <h1 className="font-display text-3xl font-bold">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="glass-card p-6 rounded-xl space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-secondary/50"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-secondary/50"
              required
              minLength={6}
            />
          </div>

          <Button type="submit" className="w-full gold-gradient text-primary-foreground" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isLogin ? 'Sign In' : 'Sign Up'}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={becomeAdmin}
            disabled={loading}
          >
            <Shield className="w-4 h-4 mr-2" />
            Sign Up & Become Admin
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

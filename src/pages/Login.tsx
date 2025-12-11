import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/Logo';
import { Eye, EyeOff, Ticket, Mail, Lock, ArrowRight, Shield, Zap, Users } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    inviteCode: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Global cyber grid background */}
      <div className="fixed inset-0 cyber-grid-fade pointer-events-none" />
      
      {/* Ambient glow effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md space-y-8 animate-fade-up">
          {/* Logo */}
          <div className="text-center">
            <Logo size="lg" className="justify-center mb-8" />
            
            {/* Cyber header */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 rounded-full mb-6">
              <div className="relative w-2 h-2">
                <div className="absolute inset-0 bg-primary rounded-full animate-ping" />
                <div className="relative w-2 h-2 bg-primary rounded-full" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-cyber text-primary">
                Neural Access Portal
              </span>
            </div>
            
            <h1 className="font-display text-4xl font-bold mb-3 tracking-tight">
              {isLogin ? 'Welcome Back' : 'Join the Revolution'}
            </h1>
            <p className="text-muted-foreground">
              {isLogin
                ? 'Sign in to access your command center'
                : 'Create your account to get started'}
            </p>
          </div>

          {/* Form card */}
          <div className="glass-card cyber-corners p-8 rounded-xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Full Name
                    </Label>
                    <div className="relative">
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Smith"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="pl-10 bg-secondary/50 border-border/50 focus:border-primary h-12"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Mail className="w-5 h-5" />
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inviteCode" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Invite Code
                    </Label>
                    <div className="relative">
                      <Input
                        id="inviteCode"
                        type="text"
                        placeholder="Enter your invite code"
                        value={formData.inviteCode}
                        onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value })}
                        className="pl-10 bg-secondary/50 border-border/50 focus:border-primary h-12 uppercase"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        <Ticket className="w-5 h-5" />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You need an invite code to join. Contact the admin if you don't have one.
                    </p>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10 bg-secondary/50 border-border/50 focus:border-primary h-12"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Mail className="w-5 h-5" />
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10 pr-10 bg-secondary/50 border-border/50 focus:border-primary h-12"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock className="w-5 h-5" />
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="text-sm text-primary hover:text-primary/80 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 gold-gradient text-primary-foreground font-semibold text-base hover:opacity-90 transition-all group gold-glow"
              >
                {isLogin ? 'Access Portal' : 'Create Account'}
                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </form>
          </div>

          {/* Toggle */}
          <div className="text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? (
                <>
                  Don't have an account?{' '}
                  <span className="text-primary font-semibold">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span className="text-primary font-semibold">Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        {/* Cyber grid with mask */}
        <div className="absolute inset-0 cyber-grid opacity-30" />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/50 to-background" />
        
        {/* Floating orbs */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[100px] animate-float" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[80px] animate-float" style={{ animationDelay: '1.5s' }} />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center">
          <h2 className="font-display text-5xl font-bold mb-6 leading-tight tracking-tight">
            Transform Your <br />
            <span className="gold-text gold-glow-text">Barbering Career</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-md leading-relaxed">
            Join an elite community of barbers mastering the art of hair systems and building successful businesses.
          </p>
          
          {/* Features */}
          <div className="mt-10 grid grid-cols-3 gap-6 w-full max-w-lg">
            {[
              { icon: Shield, label: 'Secure Access' },
              { icon: Zap, label: 'Fast Learning' },
              { icon: Users, label: 'Elite Community' },
            ].map((feature) => (
              <div key={feature.label} className="flex flex-col items-center gap-2 p-4 glass-card rounded-lg border border-border/30">
                <feature.icon className="w-6 h-6 text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{feature.label}</span>
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="mt-10 grid grid-cols-3 gap-8">
            {[
              { value: '500+', label: 'Members' },
              { value: '20+', label: 'Lessons' },
              { value: '100%', label: 'Results' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl font-bold gold-text gold-glow-text">{stat.value}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

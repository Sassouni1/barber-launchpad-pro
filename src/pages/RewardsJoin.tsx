import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Gift, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function RewardsJoin() {
  const { userId } = useParams<{ userId: string }>();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !userId) return;

    setSubmitting(true);
    setError('');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('register-reward-client', {
        body: {
          user_id: userId,
          client_name: name.trim() || undefined,
          client_phone: phone.trim(),
          client_email: email.trim() || undefined,
        },
      });

      if (fnError) throw fnError;

      if (data?.already_registered) {
        setAlreadyRegistered(true);
      }
      setDone(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle className="w-16 h-16 text-primary mx-auto" />
            <h2 className="text-2xl font-bold text-foreground">
              {alreadyRegistered ? "You're already signed up!" : "You're signed up!"}
            </h2>
            <p className="text-muted-foreground">
              {alreadyRegistered
                ? "We already have you in our rewards program. Keep visiting to earn your free service!"
                : "You've been added to the rewards program. Visit us to start earning your free service!"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Join Our Rewards Program</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign up to start earning visits toward a free service!
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                required
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optional"
                maxLength={255}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={!phone.trim() || submitting}>
              {submitting ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

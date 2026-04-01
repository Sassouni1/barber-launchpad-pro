import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { UserRound, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

const TOPICS = [
  'Suggestion topic for group call',
  'I need help or have a question',
  'How can we make your experience better',
];

export function ContactSection() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.full_name || '');
          setEmail(data.email || user.email || '');
        }
      });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !topic || !message.trim()) return;

    setSubmitting(true);
    const { error } = await supabase.from('dashboard_feedback').insert({
      user_id: user.id,
      name: name.trim(),
      email: email.trim(),
      topic,
      message: message.trim(),
    });

    setSubmitting(false);
    if (error) {
      toast({ title: 'Something went wrong', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Message sent!', description: "We'll get back to you soon." });
      setMessage('');
      setTopic('');
    }
  };

  return (
    <Card className="glass-card border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <UserRound className="h-5 w-5 text-primary" />
          Contact a Person
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Prefer to talk to a real person? Send us a message.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                required
                maxLength={255}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Topic</Label>
            <RadioGroup value={topic} onValueChange={setTopic} className="space-y-2">
              {TOPICS.map((t) => (
                <div key={t} className="flex items-center space-x-2">
                  <RadioGroupItem value={t} id={`topic-${t}`} />
                  <Label htmlFor={`topic-${t}`} className="cursor-pointer font-normal">
                    {t}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              required
              maxLength={1000}
              rows={4}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !topic || !message.trim()}
            className="w-full gold-gradient text-primary-foreground font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Sending...' : 'Send Message'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

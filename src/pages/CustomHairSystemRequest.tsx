import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { format } from 'date-fns';

const REQUEST_TYPES = [
  'Clips added',
  'Longer hair than standard',
  "Women's hair system",
  'Partial piece',
  'Full custom build',
  'Something else',
];

type RequestRow = {
  id: string;
  request_type: string;
  description: string;
  status: string;
  created_at: string;
};

const FIELD_CLASS =
  'bg-secondary/40 border-border/60 placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:ring-primary/30';

export default function CustomHairSystemRequest() {
  const { user } = useAuthContext();
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [requestType, setRequestType] = useState('');
  const [hairLength, setHairLength] = useState('');
  const [baseDetails, setBaseDetails] = useState('');
  const [color, setColor] = useState('');
  const [curlOrWave, setCurlOrWave] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const loadRequests = async () => {
    const { data } = await supabase
      .from('custom_hair_system_requests')
      .select('id,request_type,description,status,created_at')
      .order('created_at', { ascending: false });
    setRequests((data as RequestRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    setContactEmail((prev) => prev || user.email || '');
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!requestType || !description.trim()) {
      toast.error('Pick what you need and describe it.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('custom_hair_system_requests')
        .insert({
          user_id: user.id,
          request_type: requestType,
          hair_length: hairLength || null,
          base_details: baseDetails || null,
          color: color || null,
          curl_or_wave: curlOrWave || null,
          needed_by: neededBy || null,
          description: description.trim(),
          contact_name: contactName || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
        })
        .select('id')
        .single();
      if (error) throw error;

      // Alert is best-effort; the request is already saved.
      supabase.functions
        .invoke('notify-custom-hair-system-request', { body: { requestId: data.id } })
        .catch(() => undefined);

      toast.success("Request sent. You'll get a quote back before anything is made.");
      setRequestType('');
      setHairLength('');
      setBaseDetails('');
      setColor('');
      setCurlOrWave('');
      setNeededBy('');
      setDescription('');
      setContactName('');
      setContactPhone('');
      loadRequests();
    } catch (err) {
      console.error(err);
      toast.error('Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Custom Hair Systems
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            For the unusual requests — clips added, extra length, women's hair, partials, or a piece built
            completely from scratch. Tell us what you need and we'll price it for you.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tell us what you need</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="request-type">What do you need? *</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger id="request-type" className={FIELD_CLASS}>
                    <SelectValue placeholder="Choose the closest option" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="hair-length">Hair length</Label>
                  <Input id="hair-length" value={hairLength} onChange={(e) => setHairLength(e.target.value)} placeholder="e.g. 14 inches" className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-details">Base / size</Label>
                  <Input id="base-details" value={baseDetails} onChange={(e) => setBaseDetails(e.target.value)} placeholder="e.g. skin, 8x10 partial" className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="color">Color</Label>
                  <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. 1B with 10% grey" className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="curl">Curl or wave</Label>
                  <Input id="curl" value={curlOrWave} onChange={(e) => setCurlOrWave(e.target.value)} placeholder="e.g. light wave" className={FIELD_CLASS} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Describe the request *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={5}
                  placeholder="Anything that matters: clips, hairline, density, who it's for, reference photos you can send."
                  className={FIELD_CLASS}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="needed-by">Needed by</Label>
                  <Input id="needed-by" type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-name">Your name</Label>
                  <Input id="contact-name" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={FIELD_CLASS} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Phone</Label>
                  <Input id="contact-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-5555" className={FIELD_CLASS} />
                </div>
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>) : 'Send request'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Nothing is charged here. Custom pieces are quoted first, then you get a payment link.
              </p>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom requests yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{r.request_type}</span>
                      <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">{r.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(r.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Download, Loader2, Plus, Trash2 } from 'lucide-react';

export type MemberService = { name: string; price: string; duration: string; description: string };

// Starting list for members without a booking page. Prices stay blank until the member sets them.
const COMMON_SERVICES = [
  'Haircut', 'Skin fade', 'Beard trim and lineup', 'Haircut and beard', 'Hot towel shave', 'Kids haircut',
  'Hair system consultation', 'Hair system install', 'Hair system maintenance',
];

const emptyService = (name = ''): MemberService => ({ name, price: '', duration: '', description: '' });
const cleanList = (value: unknown): MemberService[] => (Array.isArray(value) ? value : [])
  .map(item => item && typeof item === 'object' ? item as Record<string, unknown> : {})
  .map(item => ({
    name: String(item.name || '').slice(0, 120), price: String(item.price || '').slice(0, 40),
    duration: String(item.duration || '').slice(0, 40), description: String(item.description || '').slice(0, 400),
  }))
  .filter(item => item.name.trim());

export function ServicesSetupCard({ bookingUrlOverride }: { bookingUrlOverride?: string }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bookingUrl, setBookingUrl] = useState('');
  const [services, setServices] = useState<MemberService[]>([]);
  const [source, setSource] = useState<'booking' | 'manual' | ''>('');
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const currentBookingUrl = bookingUrlOverride ?? bookingUrl;

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('member_onboarding_profiles')
      .select('booking_url, service_menu, services_source, services_confirmed_at')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setBookingUrl(data?.booking_url || '');
        setServices(cleanList(data?.service_menu));
        setSource((data?.services_source as 'booking' | 'manual' | null) || '');
        setConfirmedAt(data?.services_confirmed_at || null);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id]);

  const importFromBooking = async () => {
    setImporting(true);
    setImportMessage('Reading your booking page. This can take up to a minute…');
    try {
      if (bookingUrlOverride !== undefined && user?.id) {
        const { data: profile, error: profileError } = await supabase.from('member_onboarding_profiles')
          .select('booking_url').eq('user_id', user.id).maybeSingle();
        const savedUrl = String(profile?.booking_url || '').replace(/\/$/, '');
        if (profileError || savedUrl !== currentBookingUrl.replace(/\/$/, '')) {
          setImportMessage('Wait for your booking link to finish saving, then try again.');
          return;
        }
      }
      // Runs the same import + price pass Vlix onboarding uses (see supabase/functions/member-service-import).
      const { data: result, error } = await supabase.functions.invoke('member-service-import', { body: {} });
      if (error) throw new Error((await error.context?.json?.().catch(() => null))?.error || 'Could not read your booking page.');
      const found = cleanList(result?.services);
      if (!found.length) {
        setImportMessage('We couldn’t find services on your booking page. Add them below.');
        if (!services.length) setServices(COMMON_SERVICES.map(name => emptyService(name)));
        setSource('manual');
        return;
      }
      setServices(found);
      setSource('booking');
      setConfirmedAt(null);
      setImportMessage(`We found ${found.length} service${found.length === 1 ? '' : 's'} on your booking page. Check them and save.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Could not read your booking page.');
    } finally {
      setImporting(false);
    }
  };

  const startManual = () => {
    setServices(COMMON_SERVICES.map(name => emptyService(name)));
    setSource('manual');
    setConfirmedAt(null);
  };

  const update = (index: number, field: keyof MemberService, value: string) => {
    setServices(list => list.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setConfirmedAt(null);
  };
  const remove = (index: number) => { setServices(list => list.filter((_, i) => i !== index)); setConfirmedAt(null); };
  const add = () => { setServices(list => [...list, emptyService()]); setConfirmedAt(null); };

  const save = async () => {
    if (!user?.id) return;
    const list = cleanList(services);
    if (!list.length) { toast.error('Add at least one service.'); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('member_onboarding_profiles').upsert({
      user_id: user.id, service_menu: list, services_source: source || 'manual', services_confirmed_at: now,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) { toast.error('Could not save your services. Please try again.'); return; }
    setServices(list);
    setConfirmedAt(now);
    toast.success('Services saved');
  };

  if (!user || loading) return null;

  return <div className="space-y-5 border-t border-border pt-6" aria-labelledby="services-setup-title">
    <div className="space-y-1">
      <h3 id="services-setup-title" className="font-serif text-xl md:text-2xl">Your services and prices</h3>
      <p className="text-sm text-muted-foreground">These go on your website. {currentBookingUrl ? 'We can read them from your booking page.' : 'Add the services you offer and what you charge.'}</p>
    </div>

    {!services.length && <div className="flex flex-col gap-2 sm:flex-row">
      {currentBookingUrl && <Button type="button" onClick={importFromBooking} disabled={importing} className="h-11">
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Import from my booking page
      </Button>}
      <Button type="button" onClick={startManual} disabled={importing} className="h-11">
        {currentBookingUrl ? 'Add them myself' : 'Add my services'}
      </Button>
    </div>}
    {importMessage && <p className="text-sm text-muted-foreground" role="status">{importMessage}</p>}

    {services.length > 0 && <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_40px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
        <span>Service</span><span>Price</span><span>Length</span><span />
      </div>
      {services.map((service, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_40px] sm:border-0 sm:p-0">
        <Input aria-label="Service name" value={service.name} onChange={e => update(index, 'name', e.target.value)} placeholder="Service name" />
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 sm:order-last" aria-label={`Remove ${service.name || 'service'}`} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
        <Input aria-label="Price" value={service.price} onChange={e => update(index, 'price', e.target.value)} placeholder="Price" />
        <Input aria-label="Length" value={service.duration} onChange={e => update(index, 'duration', e.target.value)} placeholder="Length" />
      </div>)}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" onClick={add} className="h-11"><Plus className="mr-2 h-4 w-4" />Add a service</Button>
        {currentBookingUrl && <Button type="button" variant="ghost" onClick={importFromBooking} disabled={importing} className="h-11 text-primary">
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Re-import from booking page
        </Button>}
      </div>
    </div>}

    {services.length > 0 && <div className="flex flex-wrap items-center gap-3">
      <Button onClick={save} disabled={saving} className="h-11">{saving ? 'Saving…' : confirmedAt ? 'Saved' : 'Save my services'}</Button>
      {confirmedAt && <span className="text-sm text-muted-foreground">These will show on your website.</span>}
    </div>}
  </div>;
}

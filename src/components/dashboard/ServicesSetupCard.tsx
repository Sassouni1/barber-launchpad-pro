import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Download, Loader2, Plus, Trash2 } from 'lucide-react';

export type MemberService = { name: string; price: string; duration: string; description: string };

// Keep the service names and order from the existing business onboarding checklist.
const SERVICE_GROUPS = [
  { title: "Men's & kids' services", services: ["Men's Cuts", 'Kids Cuts', 'Beards', 'Hot Towel Shaves', 'Eyebrows', 'Facial Waxing', 'Perms', 'Haircut', 'Skin Fade', 'Fade', 'Beard Trim', 'Haircut & Beard', 'Line Up'] },
  { title: "Women's services", services: ['Balayage', 'Color', 'Highlights', 'Haircuts and Trims', 'Perms', 'Brazilian Blowout', 'Keratin Treatment', 'Hair Extensions', 'Halos', "Women's Toppers"] },
  { title: 'Hair systems', services: ['Hair System Consultation', 'Hair System Install', 'Hair System Maintenance', 'Hair System Retouch'] },
];
const draftKey = (userId: string) => `barber-launch:services-draft:${userId}`;

const emptyService = (name = ''): MemberService => ({ name, price: '', duration: '', description: '' });
const priceAmount = (value: unknown) => {
  const firstAmount = String(value ?? '').match(/(?:\d[\d,.]*|\.\d*)/)?.[0] || '';
  const digits = (firstAmount.startsWith('.') ? `0${firstAmount}` : firstAmount).replace(/,/g, '');
  const dot = digits.indexOf('.');
  return dot === -1 ? digits.slice(0, 9) : `${digits.slice(0, dot).slice(0, 9)}.${digits.slice(dot + 1).replace(/\./g, '').slice(0, 2)}`;
};
const cleanList = (value: unknown): MemberService[] => (Array.isArray(value) ? value : [])
  .map(item => item && typeof item === 'object' ? item as Record<string, unknown> : {})
  .map(item => ({
    name: String(item.name || '').slice(0, 120), price: priceAmount(item.price),
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
  const [showPicker, setShowPicker] = useState(false);
  const [customService, setCustomService] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [retryVersion, setRetryVersion] = useState(0);
  const lastSaved = useRef('');
  const latest = useRef('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const currentBookingUrl = bookingUrlOverride ?? bookingUrl;

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('member_onboarding_profiles')
      .select('booking_url, service_menu, services_source, services_confirmed_at')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const remoteServices = cleanList(data?.service_menu);
        const remoteSource = (data?.services_source as 'booking' | 'manual' | null) || '';
        lastSaved.current = JSON.stringify({ services: remoteServices, source: remoteSource });
        let draft: { services?: MemberService[]; source?: 'booking' | 'manual' | ''; updatedAt?: string } | null = null;
        try { draft = JSON.parse(localStorage.getItem(draftKey(user.id)) || 'null'); } catch { /* Use the account copy. */ }
        const useDraft = !!draft?.updatedAt && Date.parse(draft.updatedAt) > Date.parse(data?.services_confirmed_at || '1970-01-01T00:00:00Z');
        setBookingUrl(data?.booking_url || '');
        setServices(useDraft && Array.isArray(draft?.services) ? draft.services : remoteServices);
        setSource(useDraft ? draft?.source || '' : remoteSource);
        setConfirmedAt(data?.services_confirmed_at || null);
        setShowPicker(useDraft || remoteServices.length > 0);
        setLoading(false);
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading) return;
    const snapshot = JSON.stringify({ services, source });
    latest.current = snapshot;
    if (snapshot === lastSaved.current) return;
    try { localStorage.setItem(draftKey(user.id), JSON.stringify({ services, source, updatedAt: new Date().toISOString() })); }
    catch { /* Server autosave remains available. */ }
    setSyncStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    timer.current = setTimeout(() => {
      queue.current = queue.current.catch(() => {}).then(async () => {
        const savedAt = new Date().toISOString();
        try {
          const { error } = await supabase.from('member_onboarding_profiles').upsert({
            user_id: user.id, service_menu: cleanList(services), services_source: source || 'manual',
            services_confirmed_at: cleanList(services).length ? savedAt : null,
          }, { onConflict: 'user_id' });
          if (error) throw error;
          lastSaved.current = snapshot;
          if (latest.current === snapshot) {
            try { localStorage.removeItem(draftKey(user.id)); } catch { /* The account save succeeded. */ }
            setConfirmedAt(cleanList(services).length ? savedAt : null);
            setSyncStatus('saved');
          }
        } catch {
          if (latest.current !== snapshot) return;
          setSyncStatus('error');
          retryTimer.current = setTimeout(() => setRetryVersion(value => value + 1), 3000);
        }
      });
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [user?.id, loading, services, source, retryVersion]);

  useEffect(() => () => { if (retryTimer.current) clearTimeout(retryTimer.current); }, []);

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
        setShowPicker(true);
        setSource('manual');
        return;
      }
      setServices(found);
      setShowPicker(true);
      setSource('booking');
      setConfirmedAt(null);
      setImportMessage(`We found ${found.length} service${found.length === 1 ? '' : 's'} on your booking page. Review or edit them; changes save automatically.`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Could not read your booking page.');
    } finally {
      setImporting(false);
    }
  };

  const startManual = () => {
    setShowPicker(true);
    setSource('manual');
  };

  const toggleService = (name: string) => {
    setServices(list => list.some(item => item.name === name)
      ? list.filter(item => item.name !== name)
      : [...list, emptyService(name)]);
    setConfirmedAt(null);
  };

  const addCustomService = () => {
    const name = customService.trim();
    if (!name) return;
    if (!services.some(item => item.name.toLowerCase() === name.toLowerCase())) setServices(list => [...list, emptyService(name)]);
    setCustomService('');
    setConfirmedAt(null);
  };

  const update = (index: number, field: keyof MemberService, value: string) => {
    setServices(list => list.map((item, i) => i === index ? { ...item, [field]: value } : item));
    setConfirmedAt(null);
  };
  const remove = (index: number) => { setServices(list => list.filter((_, i) => i !== index)); setConfirmedAt(null); };
  if (!user || loading) return null;

  return <div className="space-y-5 border-t border-border pt-6" aria-labelledby="services-setup-title">
    <div className="space-y-1">
      <h3 id="services-setup-title" className="font-serif text-xl md:text-2xl">Your services and prices</h3>
      <p className="text-sm text-muted-foreground">These go on your website. {currentBookingUrl ? 'We can read them from your booking page.' : 'Add the services you offer and what you charge.'}</p>
    </div>

    {!showPicker && <div className="flex flex-col gap-2 sm:flex-row">
      {currentBookingUrl && <Button type="button" onClick={importFromBooking} disabled={importing} className="h-11">
        {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Import from my booking page
      </Button>}
      <Button type="button" onClick={startManual} disabled={importing} className="h-11">
        {currentBookingUrl ? 'Add them myself' : 'Add my services'}
      </Button>
    </div>}
    {importMessage && <p className="text-sm text-muted-foreground" role="status">{importMessage}</p>}

    {showPicker && <div className="space-y-6 rounded-lg border border-border p-4">
      <div>
        <h4 className="font-semibold text-foreground">Choose your services</h4>
        <p className="text-sm text-muted-foreground">{services.length} selected. Check every service you offer; changes save automatically.</p>
      </div>
      {SERVICE_GROUPS.map(group => <div key={group.title} className="space-y-3">
        <h4 className="font-semibold text-foreground">{group.title}</h4>
        <div className="flex flex-wrap gap-2">
          {group.services.map(name => {
            const selected = services.some(service => service.name === name);
            return <button key={`${group.title}-${name}`} type="button" onClick={() => toggleService(name)} aria-pressed={selected}
              className={`rounded-full border px-3 py-2 text-sm transition-colors ${selected
                ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
              {selected && <Check className="mr-1 inline h-3.5 w-3.5 text-primary" />}{name}
            </button>;
          })}
        </div>
      </div>)}
      <div className="space-y-2">
        <label htmlFor="custom-service" className="block text-sm font-semibold">Anything else?</label>
        <div className="flex gap-2">
          <Input id="custom-service" value={customService} onChange={event => setCustomService(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addCustomService(); } }} placeholder="Add a custom service" />
          <Button type="button" onClick={addCustomService} aria-label="Add custom service"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>}

    {services.length > 0 && <div className="space-y-3">
      <h4 className="font-semibold">Your selected services and prices</h4>
      <div className="hidden grid-cols-[minmax(0,1fr)_110px_110px_40px] gap-2 px-1 text-xs text-muted-foreground sm:grid">
        <span>Service</span><span>Price</span><span>Length</span><span />
      </div>
      {services.map((service, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_40px] gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_40px] sm:border-0 sm:p-0">
        <Input aria-label="Service name" value={service.name} onChange={e => update(index, 'name', e.target.value)} placeholder="Service name" />
        <Button type="button" variant="ghost" size="icon" className="h-10 w-10 sm:order-last" aria-label={`Remove ${service.name || 'service'}`} onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-foreground">$</span>
          <Input aria-label="Price in dollars" inputMode="decimal" value={service.price}
            onChange={e => update(index, 'price', priceAmount(e.target.value))}
            onBlur={() => { if (service.price && Number.isFinite(Number(service.price))) update(index, 'price', Number(service.price).toFixed(2)); }}
            placeholder="0.00" className="pl-7" />
        </div>
        <Input aria-label="Length" value={service.duration} onChange={e => update(index, 'duration', e.target.value)} placeholder="Length" />
      </div>)}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {currentBookingUrl && <Button type="button" variant="ghost" onClick={importFromBooking} disabled={importing} className="h-11 text-primary">
          {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Re-import from booking page
        </Button>}
      </div>
    </div>}

    <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
      {syncStatus === 'saving' ? 'Saving your services…' : syncStatus === 'saved' ? 'Services saved automatically.'
        : syncStatus === 'error' ? 'Could not sync yet. Your choices are saved in this browser; retrying automatically.'
        : confirmedAt ? 'Services saved to your account.' : 'Your service choices save automatically.'}
    </p>
  </div>;
}

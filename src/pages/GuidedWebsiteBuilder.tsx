import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Monitor, Smartphone, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useMemberWebsite, uploadWebsiteImage } from '@/hooks/useMemberWebsite';
import { useWebsiteEditorEntitlement } from '@/hooks/useWebsiteEditor';
import { supabase } from '@/integrations/supabase/client';
import { emptyGuidedAnswers, guidedTemplates, guidedWebsitePages, instagramUrl, normalizedWebUrl, type GuidedTemplate, type GuidedWebsiteAnswers } from '@/lib/guidedWebsite';
import { formatServiceCity } from '@/lib/formatServiceCity';

const stages = ['Choose a look', 'Your business', 'Booking', 'Photos & social', 'Review'];
const guidedKey = (userId: string) => `guided-website-v1:${userId}`;
const isGuided = (key: string | null | undefined) => key === 'guided-charlotte' || key === 'guided-kait';

function readAnswers(userId: string): GuidedWebsiteAnswers {
  try {
    const saved = JSON.parse(localStorage.getItem(guidedKey(userId)) || 'null') as Partial<GuidedWebsiteAnswers> | null;
    return saved ? { ...emptyGuidedAnswers, ...saved } : emptyGuidedAnswers;
  } catch { return emptyGuidedAnswers; }
}

export default function GuidedWebsiteBuilder() {
  const { user, isAdmin } = useAuth();
  const demoMode = isAdmin && new URLSearchParams(window.location.search).get('demo') === '1';
  const secondMode = isAdmin && new URLSearchParams(window.location.search).get('second') === '1';
  const previewOnly = demoMode || secondMode;
  const { data: website, isLoading: loadingWebsite, refetch } = useMemberWebsite();
  const { data: entitlement, isLoading: loadingEntitlement } = useWebsiteEditorEntitlement();
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['guided-website-profile', user?.id], enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('full_name,business_name,business_city,business_state,phone').eq('id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: businessSetup, isLoading: loadingBusinessSetup } = useQuery({
    queryKey: ['guided-website-business-setup', user?.id], enabled: !!user?.id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_onboarding_profiles')
        .select('service_city,work_location_city,work_location_state,business_owner_type,cuts_at_owned_business,workplace_type,business_setup_completed_at,business_setup_draft')
        .eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const dashboardUsesWorkAddress = businessSetup?.business_owner_type === 'barbershop' || businessSetup?.business_owner_type === 'salon'
    ? businessSetup.cuts_at_owned_business === true
    : ['barbershop', 'salon', 'suite'].includes(businessSetup?.workplace_type || '');
  const dashboardCity = dashboardUsesWorkAddress
      ? businessSetup.work_location_city && businessSetup.work_location_state
        ? formatServiceCity(`${businessSetup.work_location_city}, ${businessSetup.work_location_state}`)
        : ''
      : ['home', 'mobile'].includes(businessSetup?.workplace_type || '')
        ? formatServiceCity(businessSetup?.service_city || '')
        : '';
  const dashboardLocationKnown = !!dashboardCity;
  const dashboardLocationBeingEdited = !!businessSetup?.business_setup_draft;
  const [answers, setAnswers] = useState<GuidedWebsiteAnswers>(emptyGuidedAnswers);
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [previewPage, setPreviewPage] = useState<'/' | '/hair-loss-solutions/'>('/');
  const [previewTemplate, setPreviewTemplate] = useState<GuidedTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const siteSlug = secondMode ? `second-site-preview-${user?.id.slice(0, 8) || 'demo'}` : website?.site_slug ?? `site-${user?.id.slice(0, 8) || 'preview'}`;
  const pages = useMemo(() => guidedWebsitePages(answers, siteSlug), [answers, siteSlug]);

  useEffect(() => {
    if (!user || loadingWebsite || loadingProfile || loadingBusinessSetup || hydrated) return;
    if (demoMode) {
      setAnswers({ ...emptyGuidedAnswers, businessName: 'Your Barber Studio', ownerName: 'Your Name', city: 'Your City', phone: '(555) 123-4567' });
      setHydrated(true);
      return;
    }
    if (secondMode) {
      try {
        const saved = JSON.parse(localStorage.getItem(`guided-second-site:${user.id}`) || 'null') as Partial<GuidedWebsiteAnswers> | null;
        setAnswers({ ...emptyGuidedAnswers, businessName: profile?.business_name || '', ownerName: profile?.full_name || '', phone: profile?.phone || '', ...saved,
          city: dashboardLocationKnown ? dashboardCity : dashboardLocationBeingEdited ? '' : saved?.city || [profile?.business_city, profile?.business_state].filter(Boolean).join(', ') });
      } catch { setAnswers(emptyGuidedAnswers); }
      setHydrated(true);
      return;
    }
    const saved = localStorage.getItem(guidedKey(user.id));
    const remote = isGuided(website?.template_key) ? website?.editor_drafts?.guided as Partial<GuidedWebsiteAnswers> | undefined : undefined;
    const restored = saved ? readAnswers(user.id) : { ...emptyGuidedAnswers, ...remote };
    setAnswers({ ...restored,
      ownerName: restored.ownerName || profile?.full_name || '',
      businessName: restored.businessName || profile?.business_name || '',
      city: dashboardLocationKnown ? dashboardCity : dashboardLocationBeingEdited ? '' : restored.city || [profile?.business_city, profile?.business_state].filter(Boolean).join(', '),
      phone: restored.phone || profile?.phone || '',
    });
    setHydrated(true);
  }, [user, loadingWebsite, loadingProfile, loadingBusinessSetup, hydrated, website, profile, businessSetup, demoMode, secondMode, dashboardLocationKnown, dashboardLocationBeingEdited, dashboardCity]);
  useEffect(() => {
    if (hydrated && !demoMode && (dashboardLocationKnown || dashboardLocationBeingEdited))
      setAnswers(current => current.city === dashboardCity ? current : { ...current, city: dashboardCity });
  }, [dashboardCity, dashboardLocationKnown, dashboardLocationBeingEdited, hydrated, demoMode]);
  useEffect(() => { if (user && hydrated && !previewOnly) localStorage.setItem(guidedKey(user.id), JSON.stringify(answers)); }, [answers, user, hydrated, previewOnly]);
  useEffect(() => { if (user && hydrated && secondMode) localStorage.setItem(`guided-second-site:${user.id}`, JSON.stringify(answers)); }, [answers, user, hydrated, secondMode]);
  const update = <K extends keyof GuidedWebsiteAnswers>(key: K, value: GuidedWebsiteAnswers[K]) => setAnswers(current => ({ ...current, [key]: value }));

  const next = () => {
    if (step === 1 && (!answers.businessName.trim() || !answers.city.trim() || !answers.phone.trim())) {
      toast.error('Add your business name, city, and phone number.'); return;
    }
    if (step === 2) {
      if (answers.hasBookingApp === null) { toast.error('Choose whether you use a booking app.'); return; }
      if (answers.hasBookingApp && !normalizedWebUrl(answers.bookingUrl)) { toast.error('Enter a valid booking link.'); return; }
      if (!answers.hasBookingApp && !answers.hours.trim()) { toast.error('Add your hours of operation.'); return; }
    }
    if (step === 3 && answers.hasInstagram && answers.instagram.trim() && !instagramUrl(answers.instagram)) {
      toast.error('Enter a valid Instagram handle or profile link.'); return;
    }
    setStep(current => { const nextStep = Math.min(4, current + 1); setFurthestStep(previous => Math.max(previous, nextStep)); return nextStep; });
  };

  const findPhotos = async () => {
    const source = normalizedWebUrl(answers.photoSourceUrl) || (answers.hasInstagram ? instagramUrl(answers.instagram) : null);
    if (!source) { toast.error('Add a public website or Instagram link first.'); return; }
    setBusy('Finding photos'); setSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-website', { body: { url: source } });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Could not find photos on that page.');
      const images = (data.brandProfile?.images || []).filter((url: unknown): url is string => typeof url === 'string' && /^https:\/\//i.test(url)).slice(0, 12);
      setSuggestions(images);
      if (!images.length) toast.info('No photos found there. You can upload your own below.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not find photos.'); }
    finally { setBusy(''); }
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (demoMode) { toast.info('Photo upload is unavailable in preview mode.'); return; }
    if (!files || !user) return;
    setBusy('Uploading photos');
    try {
      const picked = Array.from(files).slice(0, Math.max(0, 6 - answers.photos.length));
      if (picked.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) throw new Error('Use JPG, PNG, or WebP photos under 5 MB each.');
      const urls = await Promise.all(picked.map(file => uploadWebsiteImage(user.id, file)));
      setAnswers(current => ({ ...current, photos: [...current.photos, ...urls].slice(0, 6) }));
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Photo upload failed.'); }
    finally { setBusy(''); }
  };

  const saveDraft = async () => {
    if (previewOnly) throw new Error('This preview cannot save to your existing website.');
    if (!user) throw new Error('Sign in to save your website.');
    const data = { guided: answers } as unknown as never;
    if (website) {
      if (!isGuided(website.template_key) || website.custom_domain) throw new Error('This account already has a website. Your existing site was left untouched.');
      const { error } = await supabase.from('member_websites').update({ editor_drafts: data, template_key: answers.template }).eq('id', website.id).eq('user_id', user.id);
      if (error) throw error;
      await refetch();
      return { id: website.id, site_slug: website.site_slug };
    }
    const slug = `site-${user.id.slice(0, 8)}`;
    const { data: created, error } = await supabase.from('member_websites').insert({ user_id: user.id, site_slug: slug, deployment_status: 'draft', template_key: answers.template, editor_drafts: data }).select('id,site_slug').single();
    if (error) throw error;
    await refetch();
    return created;
  };

  const save = async () => {
    setBusy('Saving draft');
    try { await saveDraft(); toast.success('Website draft saved.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save draft.'); }
    finally { setBusy(''); }
  };

  const publish = async () => {
    if (previewOnly) { toast.info('This is a preview. Nothing will be published.'); return; }
    if (!answers.businessName.trim() || !answers.city.trim() || !answers.phone.trim() || answers.hasBookingApp === null || (answers.hasBookingApp && !normalizedWebUrl(answers.bookingUrl)) || (!answers.hasBookingApp && !answers.hours.trim())) {
      toast.error('Complete your business and booking details before publishing.'); return;
    }
    setBusy('Publishing');
    try {
      const site = await saveDraft();
      const liveUrl = `https://sites.thebarberlaunch.com/${site.site_slug}`;
      const { error } = await supabase.from('member_websites').update({
        published_pages: pages as unknown as never, live_url: liveUrl,
        deployment_status: 'published', published_at: new Date().toISOString(), template_key: answers.template,
      }).eq('id', site.id).eq('user_id', user!.id);
      if (error) throw error;
      setPublishedUrl(liveUrl); await refetch(); toast.success('Website published.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not publish your website.'); }
    finally { setBusy(''); }
  };

  if (loadingWebsite || loadingEntitlement || loadingProfile || loadingBusinessSetup || !hydrated) return <DashboardLayout><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;
  if (!previewOnly && (entitlement || (website && !isGuided(website.template_key)))) return <DashboardLayout><div className="mx-auto max-w-xl p-6"><h1 className="font-serif text-3xl">Your website is already set up</h1><p className="mt-3 text-muted-foreground">Your existing website and editor are unchanged.</p>{entitlement ? <a className="mt-5 inline-block text-primary underline" href="/website">Open your Website Editor</a> : website?.live_url ? <a className="mt-5 inline-block text-primary underline" href={website.live_url} target="_blank" rel="noreferrer">View your website</a> : null}</div></DashboardLayout>;

  return <DashboardLayout><main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <div><p className="text-xs font-bold uppercase tracking-[.22em] text-primary">My Website</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">{secondMode ? 'Build your second website' : 'Let’s build your website'}</h1><p className="mt-2 text-muted-foreground">Answer a few questions. We’ll build a draft you can review before publishing.</p>{demoMode && <p className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">Admin preview only. Your answers will not save or publish, and your existing website will not change.</p>}{secondMode && <p className="mt-4 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm text-primary">Second-site draft. Your answers are saved in this browser. Your current website will not change, and this draft cannot publish yet.</p>}</div>
    <div className="grid grid-cols-5 gap-2" aria-label="Website setup progress">{stages.map((label, index) => <button key={label} type="button" disabled={index > furthestStep} onClick={() => setStep(index)} className={`rounded-lg border p-2 text-left text-xs sm:text-sm disabled:cursor-not-allowed disabled:opacity-50 ${index === step ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}><span className="block font-bold">{index < step ? <Check className="inline h-4 w-4" /> : index + 1}</span>{label}</button>)}</div>
    <section className="rounded-xl border border-primary/25 bg-card p-5 sm:p-8">
      {step === 0 && <div className="space-y-5">
        <div><h2 className="font-serif text-2xl">Choose your website design</h2><p className="text-muted-foreground">Scroll inside either website to explore it, or open Preview for a larger desktop or phone view.</p></div>
        <div className="grid gap-5 lg:grid-cols-2">
          {guidedTemplates.map(template => <article key={template.key} className={`overflow-hidden rounded-xl border bg-background ${answers.template === template.key ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{template.name}</p><h3 className="font-serif text-xl">{template.example}</h3></div><span className="text-xs text-muted-foreground">Scroll inside ↓</span></div>
            <iframe title={`${template.name} scrollable website preview`} src={template.url} loading="lazy" className="block h-[420px] w-full border-0 bg-white" />
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border p-3">
              <Button type="button" size="sm" variant="outline" onClick={() => { setPreviewDevice('desktop'); setPreviewTemplate(template.key); }}><ExternalLink className="mr-1 h-4 w-4" />Preview</Button>
              <Button type="button" size="sm" variant={answers.template === template.key ? 'default' : 'secondary'} onClick={() => update('template', template.key)}>{answers.template === template.key ? 'Selected' : 'Select'}</Button>
            </div>
          </article>)}
        </div>
      </div>}
      {step === 1 && <div className="max-w-xl space-y-5"><h2 className="font-serif text-2xl">Tell us about your business</h2><Field label="What’s your business name?" value={answers.businessName} onChange={value => update('businessName', value)} placeholder="Your business name" /><Field label="What name should we show for you?" value={answers.ownerName} onChange={value => update('ownerName', value)} placeholder="Your name" />{dashboardLocationKnown ? <div className="space-y-2"><label htmlFor="website-dashboard-city" className="block font-medium">City and state for your website</label><Input id="website-dashboard-city" value={dashboardCity} readOnly aria-readonly="true" placeholder="Add your work location on the dashboard" /><p className="text-xs text-muted-foreground">{dashboardCity ? "This comes from your saved dashboard business details." : <>Complete your work location on the <a className="underline" href="/dashboard">dashboard</a> first.</>}</p></div> : <Field label="What city are you currently working from?" value={answers.city} onChange={value => update('city', value)} placeholder="City, State" />}<Field label="What phone number should show on your site?" value={answers.phone} onChange={value => update('phone', value)} placeholder="Business phone number" /><p className="text-sm text-muted-foreground">We suggested the number on your account. You can change it here.</p><label className="block space-y-2"><span className="font-medium">What services do you want to show?</span><Textarea value={answers.services} onChange={e => update('services', e.target.value)} rows={5} placeholder="One service per line" /></label></div>}
      {step === 2 && <div className="max-w-xl space-y-5"><h2 className="font-serif text-2xl">How do clients book with you?</h2><p>Do you have a booking app?</p><YesNo value={answers.hasBookingApp} onChange={value => update('hasBookingApp', value)} />{answers.hasBookingApp === true && <Field label="Paste your booking page link" value={answers.bookingUrl} onChange={value => update('bookingUrl', value)} placeholder="https://…" />}{answers.hasBookingApp === false && <label className="block space-y-2"><span className="font-medium">What are your hours of operation?</span><Textarea value={answers.hours} onChange={e => update('hours', e.target.value)} rows={5} placeholder="Mon–Fri 9 AM–6 PM" /></label>}</div>}
      {step === 3 && <div className="max-w-2xl space-y-5"><h2 className="font-serif text-2xl">Show your work</h2><p>Do you have an Instagram with a few haircuts or hair systems?</p><YesNo value={answers.hasInstagram} onChange={value => update('hasInstagram', value)} />{answers.hasInstagram && <Field label="Instagram handle or profile link" value={answers.instagram} onChange={value => update('instagram', value)} placeholder="@yourname" />}<Field label="Public page to find your photos (optional)" value={answers.photoSourceUrl} onChange={value => update('photoSourceUrl', value)} placeholder="Your website, portfolio, or Instagram link" /><Button type="button" variant="outline" disabled={!!busy} onClick={findPhotos}><Sparkles className="mr-2 h-4 w-4" />Find photos</Button>{suggestions.length > 0 && <div><p className="mb-3 text-sm text-muted-foreground">Select only photos that belong to you. Nothing is added automatically.</p><div className="grid grid-cols-3 gap-2">{suggestions.map(url => <button type="button" key={url} aria-pressed={answers.photos.includes(url)} onClick={() => update('photos', answers.photos.includes(url) ? answers.photos.filter(item => item !== url) : [...answers.photos, url].slice(0, 6))} className={`relative overflow-hidden rounded-lg border-2 ${answers.photos.includes(url) ? 'border-primary' : 'border-transparent'}`}><img src={url} alt="Suggested work photo" className="h-28 w-full object-cover" />{answers.photos.includes(url) && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-primary p-1 text-black" />}</button>)}</div></div>}<label className="block cursor-pointer rounded-lg border border-dashed border-primary/50 p-5 text-center"><ImagePlus className="mx-auto mb-2 h-6 w-6 text-primary" />Upload your own photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e => void uploadPhotos(e.target.files)} /></label>{answers.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{answers.photos.map(url => <button key={url} type="button" onClick={() => update('photos', answers.photos.filter(item => item !== url))} className="relative"><img src={url} alt="Selected work photo" className="h-28 w-full rounded-lg object-cover" /><span className="absolute bottom-1 right-1 rounded bg-black/80 px-2 py-1 text-xs text-white">Remove</span></button>)}</div>}</div>}
      {step === 4 && <div className="space-y-5"><div><h2 className="font-serif text-2xl">Review your website</h2><p className="text-muted-foreground">Your answers built this preview. Check the details and photos before publishing.</p></div><div className="flex gap-2"><Button type="button" variant={previewPage === '/' ? 'default' : 'outline'} onClick={() => setPreviewPage('/')}>Home</Button><Button type="button" variant={previewPage !== '/' ? 'default' : 'outline'} onClick={() => setPreviewPage('/hair-loss-solutions/')}>Hair Systems</Button></div><iframe key={`${answers.template}:${previewPage}`} title="Your website preview" srcDoc={pages[previewPage]} className="h-[65vh] w-full rounded-lg border bg-white" />{!previewOnly && <div className="flex flex-wrap gap-3"><Button disabled={!!busy} variant="outline" onClick={() => void save()}>{busy === 'Saving draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save draft</Button><Button disabled={!!busy} onClick={() => void publish()}>{busy === 'Publishing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Publish website</Button></div>}{publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open your live website <ExternalLink className="inline h-4 w-4" /></a>}</div>}
    </section>
    <Dialog open={!!previewTemplate} onOpenChange={open => { if (!open) setPreviewTemplate(null); }}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none">
        <DialogTitle className="sr-only">Full website template preview</DialogTitle>
        <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-3 pr-12">
          <span className="mr-auto font-semibold">{guidedTemplates.find(template => template.key === previewTemplate)?.example}</span>
          <Button type="button" size="sm" variant={previewDevice === 'desktop' ? 'default' : 'outline'} onClick={() => setPreviewDevice('desktop')}><Monitor className="mr-1 h-4 w-4" />Desktop</Button>
          <Button type="button" size="sm" variant={previewDevice === 'mobile' ? 'default' : 'outline'} onClick={() => setPreviewDevice('mobile')}><Smartphone className="mr-1 h-4 w-4" />Phone</Button>
          <Button type="button" size="sm" onClick={() => { if (previewTemplate) update('template', previewTemplate); setPreviewTemplate(null); }}>Choose this design</Button>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-neutral-900 p-2 sm:p-4">
          {previewTemplate && <iframe key={`${previewTemplate}:${previewDevice}`} title={`Full ${previewDevice} website preview`} src={guidedTemplates.find(template => template.key === previewTemplate)?.url} className={`h-full border-0 bg-white shadow-2xl ${previewDevice === 'mobile' ? 'w-full max-w-[390px]' : 'w-full max-w-[1440px]'}`} />}
        </div>
      </DialogContent>
    </Dialog>
    <div className="flex justify-between"><Button variant="outline" disabled={step === 0 || !!busy} onClick={() => setStep(current => current - 1)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>{step < 4 && <Button onClick={next}>Continue<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
  </main></DashboardLayout>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="font-medium">{label}</span><Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (value: boolean) => void }) {
  return <div className="flex gap-3">{[true, false].map(option => <Button key={String(option)} type="button" variant={value === option ? 'default' : 'outline'} onClick={() => onChange(option)}>{option ? 'Yes' : 'No'}</Button>)}</div>;
}

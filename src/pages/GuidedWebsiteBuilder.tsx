import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useBusinessCard } from '@/hooks/useBusinessCard';
import { useWebsiteEditorEntitlement } from '@/hooks/useWebsiteEditor';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { emptyGuidedAnswers, guidedTemplates, guidedWebsitePages, instagramUrl, normalizedWebUrl, type GuidedTemplate, type GuidedWebsiteAnswers } from '@/lib/guidedWebsite';
import { formatServiceCity } from '@/lib/formatServiceCity';
import { canAccessMyWebsite, canAccessSecondWebsite } from '@/lib/myWebsiteAccess';
import { TemplatePicker, templateDisplayName } from '@/components/website/TemplatePicker';
import { DomainSetupStep, type DomainOrder, type DomainResult } from '@/components/website/DomainSetupStep';
import { type DomainPaymentChoice } from '@/lib/memberBilling';
import { personalizedTemplateHtml, personalizedTemplateOneHairHtml, personalizedTemplateTwoHairHtml } from '@/lib/guidedTemplatePreview';

const stages = ['Choose a look', 'Domain', 'Your business', 'Booking', 'Photos & social', 'Review'];
const guidedKey = (userId: string) => `guided-website-v1:${userId}`;
const domainCandidates = (domain: string) => {
  const name = domain.split('.')[0];
  return [...new Set([`${name}.net`, `${name}.co`, `book${name}.com`, `${name}studio.com`, `${name}online.com`])]
    .filter(candidate => candidate !== domain && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,24}$/.test(candidate));
};
const isGuided = (key: string | null | undefined) => key === 'guided-charlotte' || key === 'guided-kait';
const savedPersonName = (value?: string) => value?.trim() && !/^your name$/i.test(value.trim()) ? value.trim() : '';

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
  const previewOnly = demoMode;
  const { data: website, isLoading: loadingWebsite, refetch } = useMemberWebsite();
  const { data: businessCard, isLoading: loadingBusinessCard } = useBusinessCard();
  const { data: entitlement, isLoading: loadingEntitlement } = useWebsiteEditorEntitlement();
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['guided-website-profile', user?.id], enabled: !!user?.id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('full_name,business_name,business_city,business_state').eq('id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: businessSetup, isLoading: loadingBusinessSetup } = useQuery({
    queryKey: ['guided-website-business-setup', user?.id], enabled: !!user?.id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_onboarding_profiles')
        .select('service_city,work_location_city,work_location_state,business_name,business_owner_type,professional_role,cuts_at_owned_business,workplace_type,business_setup_completed_at,business_setup_draft,business_setup_draft_updated_at')
        .eq('user_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const dashboardUsesWorkAddress = businessSetup?.business_owner_type === 'barbershop' ||
    businessSetup?.business_owner_type === 'salon' ||
    ['barbershop', 'salon', 'suite'].includes(businessSetup?.workplace_type || '');
  const dashboardCity = dashboardUsesWorkAddress
      ? businessSetup.work_location_city && businessSetup.work_location_state
        ? formatServiceCity(`${businessSetup.work_location_city}, ${businessSetup.work_location_state}`)
        : ''
      : ['home', 'mobile', 'other'].includes(businessSetup?.workplace_type || '')
        ? formatServiceCity(businessSetup?.service_city || '')
        : '';
  const dashboardLocationKnown = !!dashboardCity;
  const dashboardLocationBeingEdited = !!businessSetup?.business_setup_completed_at &&
    !!businessSetup.business_setup_draft_updated_at &&
    Date.parse(businessSetup.business_setup_draft_updated_at) > Date.parse(businessSetup.business_setup_completed_at);
  const dashboardNameKnown = !!businessSetup && !!(businessSetup.business_owner_type || businessSetup.professional_role || businessSetup.business_name?.trim() || businessSetup.business_setup_completed_at);
  const dashboardBrandName = businessSetup?.business_name?.trim() || profile?.full_name?.trim() || '';
  const metadata = user?.user_metadata || {};
  const metadataName = [metadata.full_name, metadata.name, metadata.fullName]
    .find(value => typeof value === 'string' && value.trim()) as string | undefined;
  const metadataParts = [metadata.first_name || metadata.given_name, metadata.last_name || metadata.family_name]
    .filter((value): value is string => typeof value === 'string' && !!value.trim()).join(' ').trim();
  const setupDraft = businessSetup?.business_setup_draft && typeof businessSetup.business_setup_draft === 'object'
    && !Array.isArray(businessSetup.business_setup_draft) ? businessSetup.business_setup_draft as Record<string, unknown> : null;
  const preferredClientName = setupDraft?.differentClientName === 'yes' && typeof setupDraft.clientDisplayName === 'string'
    ? setupDraft.clientDisplayName.trim() : '';
  const accountPersonName = preferredClientName || profile?.full_name?.trim()
    || [businessCard?.first_name, businessCard?.last_name].filter(Boolean).join(' ').trim()
    || metadataName?.trim() || metadataParts;
  const publicPhone = typeof setupDraft?.publicPhone === 'string' ? setupDraft.publicPhone.trim() : '';
  const isBusinessOwner = businessSetup?.business_owner_type === 'barbershop' || businessSetup?.business_owner_type === 'salon';
  const [answers, setAnswers] = useState<GuidedWebsiteAnswers>(emptyGuidedAnswers);
  const websiteAnswers = useMemo(() => ({ ...answers,
    ownerName: isBusinessOwner ? '' : accountPersonName || savedPersonName(answers.ownerName),
    phone: demoMode ? answers.phone : publicPhone,
  }), [answers, isBusinessOwner, accountPersonName, publicPhone, demoMode]);
  const [hydrated, setHydrated] = useState(false);
  // Services the member confirmed on the dashboard (imported from their booking page or added by hand).
  // Read separately so the builder keeps working if the services columns are not deployed yet.
  const { data: savedServices } = useQuery({
    queryKey: ['guided-website-services', user?.id], enabled: !!user?.id,
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('member_onboarding_profiles')
        .select('service_menu,services_confirmed_at').eq('user_id', user!.id).maybeSingle();
      return error ? null : data;
    },
  });
  const dashboardServicesText = Array.isArray(savedServices?.service_menu)
    ? (savedServices.service_menu as Array<{ name?: string; price?: string }>)
      .filter(service => service?.name?.trim())
      .map(service => {
        const name = service.name!.trim();
        const price = String(service.price || '').trim();
        return price ? `${name} — ${/^\d+(?:\.\d{1,2})?$/.test(price) ? `$${price}` : price}` : name;
      })
      .join('\n')
    : '';
  const previewServicesText = dashboardServicesText || (answers.services === 'Haircuts\nHair systems' ? '' : answers.services);
  const serviceDetails = (savedServices?.service_menu as Array<{ name: string; description?: string; duration?: string }> | null) || [];
  const serviceRole = businessSetup?.professional_role || businessSetup?.business_owner_type || '';
  const { data: templateSources } = useQuery({
    queryKey: ['guided-website-template-sources'],
    queryFn: async () => {
      const entries = await Promise.all(guidedTemplates.map(async template => {
        const response = await fetch(template.url);
        if (!response.ok) throw new Error(`Could not load ${template.name} preview.`);
        return [template.key, await response.text()] as const;
      }));
      const [classicHair, boldHair] = await Promise.all([
        fetch('/website-previews/template-1/hair-loss-solutions/index.html'),
        fetch('/website-previews/template-2/hair-loss-solutions/index.html'),
      ]);
      if (!classicHair.ok || !boldHair.ok) throw new Error('Could not load the hair systems pages.');
      return { ...Object.fromEntries(entries), 'guided-charlotte-hair': await classicHair.text(), 'guided-kait-hair': await boldHair.text() } as Record<GuidedTemplate | 'guided-charlotte-hair' | 'guided-kait-hair', string>;
    },
    staleTime: Infinity,
  });
  const personalizedPreviews = useMemo(() => templateSources && Object.fromEntries(guidedTemplates.map(template => [
    template.key, personalizedTemplateHtml(templateSources[template.key], template.key, previewServicesText,
      new URL(template.url, window.location.origin).href, serviceDetails, serviceRole, undefined, websiteAnswers, businessSetup?.business_owner_type),
  ])) as Record<GuidedTemplate, string>, [templateSources, previewServicesText, savedServices?.service_menu, serviceRole, websiteAnswers, businessSetup?.business_owner_type]);
  useEffect(() => {
    if (!hydrated || !dashboardServicesText) return;
    setAnswers(current => {
      if (current.services === dashboardServicesText) return current;
      return { ...current, services: dashboardServicesText };
    });
  }, [hydrated, dashboardServicesText, secondMode]);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [previewPage, setPreviewPage] = useState<'/' | '/hair-loss-solutions/'>('/');
  const [previewTemplate, setPreviewTemplate] = useState<GuidedTemplate | null>(null);
  const [previewTemplatePage, setPreviewTemplatePage] = useState<'/' | '/hair-loss-solutions/'>('/');
  useEffect(() => {
    const onPageRequest = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'guided-template-page') return;
      const page = event.data.page;
      if (page !== '/' && page !== '/hair-loss-solutions/') return;
      if (previewTemplate) setPreviewTemplatePage(page);
      else if (step === 5) setPreviewPage(page);
    };
    window.addEventListener('message', onPageRequest);
    return () => window.removeEventListener('message', onPageRequest);
  }, [previewTemplate, step, answers.template]);
  // Second-website picker starts with nothing chosen so the member makes a real choice.
  const [templateChosen, setTemplateChosen] = useState(false);
  const pickerMode = secondMode;
  const needsTemplateChoice = pickerMode && step === 0 && !templateChosen;
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainResult, setDomainResult] = useState<DomainResult | null>(null);
  const [domainSuggestions, setDomainSuggestions] = useState<DomainResult[]>([]);
  const [findingDomainSuggestions, setFindingDomainSuggestions] = useState(false);
  const domainSearchId = useRef(0);
  const [domainOrder, setDomainOrder] = useState<DomainOrder | null>(null);
  const [domainBusy, setDomainBusy] = useState('');
  const [domainCheckoutClientSecret, setDomainCheckoutClientSecret] = useState<string | null>(null);
  const siteSlug = website?.site_slug ?? `site-${user?.id.slice(0, 8) || 'preview'}`;
  const pages = useMemo(() => {
    const generated = guidedWebsitePages(answers, siteSlug);
    if (templateSources?.[answers.template]) {
      const template = guidedTemplates.find(item => item.key === answers.template)!;
      generated['/'] = personalizedTemplateHtml(templateSources[answers.template], answers.template, previewServicesText,
        new URL(template.url, window.location.origin).href,
        serviceDetails, serviceRole, undefined, websiteAnswers, businessSetup?.business_owner_type);
      if (answers.template === 'guided-charlotte') generated['/hair-loss-solutions/'] = personalizedTemplateOneHairHtml(
        templateSources['guided-charlotte-hair'],
        new URL('/website-previews/template-1/hair-loss-solutions/index.html', window.location.origin).href,
        websiteAnswers, undefined, businessSetup?.business_owner_type);
      else generated['/hair-loss-solutions/'] = personalizedTemplateTwoHairHtml(
        templateSources['guided-kait-hair'],
        new URL('/website-previews/template-2/hair-loss-solutions/index.html', window.location.origin).href,
        websiteAnswers, undefined, businessSetup?.business_owner_type);
    }
    return generated;
  }, [answers, siteSlug, templateSources, previewServicesText, savedServices?.service_menu, serviceRole, websiteAnswers, businessSetup?.business_owner_type]);

  useEffect(() => {
    if (!user || loadingWebsite || loadingProfile || loadingBusinessSetup || loadingBusinessCard || hydrated) return;
    if (demoMode) {
      setAnswers({ ...emptyGuidedAnswers, businessName: 'Your Barber Studio', ownerName: 'Your Name', city: 'Your City', phone: '(555) 123-4567' });
      setHydrated(true);
      return;
    }
    if (secondMode) {
      try {
        const saved = JSON.parse(localStorage.getItem(`guided-second-site:${user.id}`) || 'null') as Partial<GuidedWebsiteAnswers> | null;
        setAnswers({ ...emptyGuidedAnswers, businessName: profile?.business_name || '', ...saved,
          ownerName: isBusinessOwner ? '' : accountPersonName || savedPersonName(saved?.ownerName), phone: publicPhone,
          ...(dashboardNameKnown ? { businessName: dashboardBrandName } : {}),
          city: dashboardLocationKnown ? dashboardCity : dashboardLocationBeingEdited ? '' : saved?.city || [profile?.business_city, profile?.business_state].filter(Boolean).join(', ') });
      } catch { setAnswers(emptyGuidedAnswers); }
      setHydrated(true);
      return;
    }
    const saved = localStorage.getItem(guidedKey(user.id));
    const remote = isGuided(website?.template_key) ? website?.editor_drafts?.guided as Partial<GuidedWebsiteAnswers> | undefined : undefined;
    const restored = saved ? readAnswers(user.id) : { ...emptyGuidedAnswers, ...remote };
    setAnswers({ ...restored,
      ownerName: isBusinessOwner ? '' : accountPersonName || savedPersonName(restored.ownerName),
      businessName: dashboardNameKnown ? dashboardBrandName : restored.businessName || profile?.business_name || '',
      city: dashboardLocationKnown ? dashboardCity : dashboardLocationBeingEdited ? '' : restored.city || [profile?.business_city, profile?.business_state].filter(Boolean).join(', '),
      phone: publicPhone,
    });
    setHydrated(true);
  }, [user, loadingWebsite, loadingProfile, loadingBusinessSetup, loadingBusinessCard, hydrated, website, profile, businessSetup, demoMode, secondMode, dashboardLocationKnown, dashboardLocationBeingEdited, dashboardCity, dashboardNameKnown, dashboardBrandName, accountPersonName, publicPhone, isBusinessOwner]);
  useEffect(() => {
    if (hydrated && !demoMode && dashboardNameKnown)
      setAnswers(current => current.businessName === dashboardBrandName ? current : { ...current, businessName: dashboardBrandName });
  }, [dashboardBrandName, dashboardNameKnown, hydrated, demoMode]);
  useEffect(() => {
    if (hydrated && !demoMode && (dashboardLocationKnown || dashboardLocationBeingEdited))
      setAnswers(current => current.city === dashboardCity ? current : { ...current, city: dashboardCity });
  }, [dashboardCity, dashboardLocationKnown, dashboardLocationBeingEdited, hydrated, demoMode]);
  useEffect(() => { if (user && hydrated && !previewOnly) localStorage.setItem(guidedKey(user.id), JSON.stringify(answers)); }, [answers, user, hydrated, previewOnly]);
  useEffect(() => { if (user && hydrated && secondMode) localStorage.setItem(`guided-second-site:${user.id}`, JSON.stringify(answers)); }, [answers, user, hydrated, secondMode]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('domain_order')) setStep(1);
  }, []);
  useEffect(() => {
    if (website?.custom_domain) setDomainInput(current => current || website.custom_domain || '');
  }, [website?.custom_domain]);
  useEffect(() => {
    if (!user || previewOnly) return;
    const returnedOrder = new URLSearchParams(window.location.search).get('domain_order');
    let stopped = false;
    const refresh = async () => {
      const { data, error } = await supabase.functions.invoke('cloudflare-domains', {
        body: { action: 'status', ...(returnedOrder ? { orderId: returnedOrder } : {}) },
      });
      if (!stopped && !error && data?.order) {
        setDomainOrder(data.order as DomainOrder);
        if (data.order.status === 'registered') void refetch();
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (step === 1) void refresh(); }, 8000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [user, previewOnly, step, refetch]);
  const update = <K extends keyof GuidedWebsiteAnswers>(key: K, value: GuidedWebsiteAnswers[K]) => setAnswers(current => ({ ...current, [key]: value }));

  const next = () => {
    if (needsTemplateChoice) { toast.error('Pick a design to continue.'); return; }
    if (step === 2 && (!answers.businessName.trim() || !answers.city.trim())) {
      toast.error('Add your business name and city.'); return;
    }
    if (step === 3) {
      if (answers.hasBookingApp === null) { toast.error('Choose whether you use a booking app.'); return; }
      if (answers.hasBookingApp && !normalizedWebUrl(answers.bookingUrl)) { toast.error('Enter a valid booking link.'); return; }
      if (!answers.hasBookingApp && !answers.hours.trim()) { toast.error('Add your hours of operation.'); return; }
    }
    if (step === 4 && answers.instagram.trim() && !instagramUrl(answers.instagram)) {
      toast.error('Enter a valid Instagram handle or profile link.'); return;
    }
    setStep(current => { const nextStep = Math.min(5, current + 1); setFurthestStep(previous => Math.max(previous, nextStep)); return nextStep; });
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
    const data = { guided: websiteAnswers } as unknown as never;
    if (website) {
      if (!isGuided(website.template_key) && !secondMode) throw new Error('This account already has a website. Your existing site was left untouched.');
      const { error } = await supabase.from('member_websites').update({ editor_drafts: data, template_key: answers.template }).eq('id', website.id).eq('user_id', user.id);
      if (error) throw error;
      await refetch();
      return { id: website.id, site_slug: website.site_slug };
    }
    const slug = `site-${user.id.slice(0, 8)}`;
    const { data: created, error } = await supabase.from('member_websites').insert({ user_id: user.id, site_slug: slug, deployment_status: 'not_published', template_key: answers.template, editor_drafts: data }).select('id,site_slug').single();
    if (error) throw error;
    await refetch();
    return created;
  };

  const checkDomain = async () => {
    const domain = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const searchId = ++domainSearchId.current;
    setDomainResult(null);
    setDomainSuggestions([]);
    setFindingDomainSuggestions(false);
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z]{2,24})+$/.test(domain)) {
      toast.error('Enter a complete domain, such as yourshop.com.'); return;
    }
    setDomainInput(domain); setDomainBusy('Checking');
    try {
      const { data, error } = await supabase.functions.invoke('cloudflare-domains', { body: { action: 'check', domains: [domain] } });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not check that domain.');
      if (searchId !== domainSearchId.current) return;
      const checked = (data?.results?.[0] || null) as DomainResult | null;
      setDomainResult(checked);
      if (checked && !checked.available) {
        const candidates = domainCandidates(domain);
        if (candidates.length) {
          setFindingDomainSuggestions(true);
          try {
            const alternatives = await supabase.functions.invoke('cloudflare-domains', { body: { action: 'check', domains: candidates } });
            if (searchId === domainSearchId.current && !alternatives.error && !alternatives.data?.error) {
              setDomainSuggestions(((alternatives.data?.results || []) as DomainResult[])
                .filter(item => item.available && item.price !== null).slice(0, 3));
            }
          } catch {
            // The original search result remains useful if alternative lookup fails.
          } finally { if (searchId === domainSearchId.current) setFindingDomainSuggestions(false); }
        }
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not check that domain.'); }
    finally { setDomainBusy(''); }
  };

  const openDomainCheckout = async (confirmed: DomainResult, payment: DomainPaymentChoice) => {
    if (previewOnly) { toast.info('Domain purchase is unavailable in preview mode.'); return; }
    if (!confirmed.available || confirmed.price === null) return;
    if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) { toast.error('Secure checkout is unavailable right now.'); return; }
    setDomainBusy('Opening checkout');
    try {
      await saveDraft();
      const { data, error } = await supabase.functions.invoke('cloudflare-domains', {
        body: { action: 'checkout', domain: confirmed.domain,
          confirmedDomain: confirmed.domain, confirmedPrice: confirmed.price, payment, secondMode },
      });
      if (error) {
        const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
        if (details?.current && details.current.domain === confirmed.domain) {
          // The price or availability changed: show the new total and require a fresh confirmation.
          setDomainResult(details.current as DomainResult);
        }
        throw new Error(details?.error || 'Could not start domain checkout.');
      }
      if (data?.error) throw new Error(data.error);
      if (typeof data?.clientSecret !== 'string' || !data.clientSecret.startsWith('cs_')) throw new Error('Secure checkout could not open.');
      setDomainCheckoutClientSecret(data.clientSecret);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not start domain checkout.'); }
    finally { setDomainBusy(''); }
  };

  const buyDomain = async (payment: DomainPaymentChoice) => {
    if (!domainResult?.available || domainResult.price === null || domainResult.domain !== domainInput) return;
    await openDomainCheckout(domainResult, payment);
  };

  const resumeDomainOrder = async (order: DomainOrder) => {
    if (previewOnly || order.status !== 'checkout_open' || domainBusy) return;
    const searchId = ++domainSearchId.current;
    setDomainInput(order.domain);
    setDomainResult(null);
    setDomainSuggestions([]);
    setFindingDomainSuggestions(false);
    setDomainBusy('Checking');
    try {
      const { data, error } = await supabase.functions.invoke('cloudflare-domains', {
        body: { action: 'check', domains: [order.domain] },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Could not check that domain.');
      if (searchId !== domainSearchId.current) return;
      const checked = (data?.results?.[0] || null) as DomainResult | null;
      setDomainResult(checked);
      if (!checked?.available || checked.price === null) {
        throw new Error('This domain is no longer available. Search for another name.');
      }
      if (checked.currency.toUpperCase() !== 'USD' || Math.round(checked.price * 100) !== order.member_charge_cents) {
        throw new Error('The price changed since your earlier checkout. Contact support before retrying.');
      }
      await openDomainCheckout(checked, { method: 'new', saveCard: false });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not resume checkout.'); }
    finally { setDomainBusy(''); }
  };

  const domainCheckoutComplete = async () => {
    setDomainCheckoutClientSecret(null);
    toast.info('Payment submitted. Checking domain registration…');
    const { data } = await supabase.functions.invoke('cloudflare-domains', { body: { action: 'status' } });
    if (data?.order) setDomainOrder(data.order as DomainOrder);
  };

  const save = async () => {
    setBusy('Saving draft');
    try { await saveDraft(); toast.success('Website draft saved.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save draft.'); }
    finally { setBusy(''); }
  };

  const publish = async () => {
    if (previewOnly) { toast.info('This is a preview. Nothing will be published.'); return; }
    if (!templateSources?.[answers.template]) { toast.error('Wait for the website template to load before publishing.'); return; }
    if (!answers.businessName.trim() || !answers.city.trim() || answers.hasBookingApp === null || (answers.hasBookingApp && !normalizedWebUrl(answers.bookingUrl)) || (!answers.hasBookingApp && !answers.hours.trim())) {
      toast.error('Complete your business and booking details before publishing.'); return;
    }
    setBusy('Publishing');
    try {
      const site = await saveDraft();
      const publishedPages = { ...pages };
      const template = guidedTemplates.find(item => item.key === answers.template)!;
      publishedPages['/'] = personalizedTemplateHtml(templateSources![answers.template], answers.template, previewServicesText,
        new URL(template.url, window.location.origin).href,
        serviceDetails, serviceRole, './', websiteAnswers, businessSetup?.business_owner_type);
      if (answers.template === 'guided-charlotte') publishedPages['/hair-loss-solutions/'] = personalizedTemplateOneHairHtml(
        templateSources!['guided-charlotte-hair'],
        new URL('/website-previews/template-1/hair-loss-solutions/index.html', window.location.origin).href,
        websiteAnswers, '../', businessSetup?.business_owner_type, site.site_slug);
      else publishedPages['/hair-loss-solutions/'] = personalizedTemplateTwoHairHtml(
        templateSources!['guided-kait-hair'],
        new URL('/website-previews/template-2/hair-loss-solutions/index.html', window.location.origin).href,
        websiteAnswers, '../', businessSetup?.business_owner_type, site.site_slug);
      const { data, error } = await supabase.functions.invoke('website-publish', {
        body: { siteSlug: site.site_slug, pages: Object.entries(publishedPages).map(([path, html]) => ({ path, html })) },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Could not publish your website.');
      setPublishedUrl(data.liveUrl); await refetch();
      if (data.deploymentStatus === 'domain_pending') toast.info('Website published at its temporary address while the domain connects.');
      else toast.success('Website published.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not publish your website.'); }
    finally { setBusy(''); }
  };

  if (!canAccessMyWebsite(user?.id) && !(secondMode && canAccessSecondWebsite(user?.email, isAdmin))) return <DashboardLayout><div className="mx-auto max-w-xl p-6"><h1 className="font-serif text-3xl">My Website is unavailable</h1></div></DashboardLayout>;
  if (loadingWebsite || loadingEntitlement || loadingProfile || loadingBusinessSetup || !hydrated) return <DashboardLayout><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;
  if (!previewOnly && !secondMode && ((entitlement && !isGuided(website?.template_key)) || (website && !isGuided(website.template_key)))) return <DashboardLayout><div className="mx-auto max-w-xl p-6"><h1 className="font-serif text-3xl">Your website is already set up</h1><p className="mt-3 text-muted-foreground">Your existing website and editor are unchanged.</p>{entitlement ? <a className="mt-5 inline-block text-primary underline" href="/website">Open your Website Editor</a> : website?.live_url ? <a href={website.live_url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-primary underline">View your website</a> : null}</div></DashboardLayout>;

  return <DashboardLayout><main className="mx-auto min-w-0 max-w-7xl space-y-7 p-4 pb-12 sm:p-8 lg:px-10">
    <header className="flex gap-4 sm:gap-6"><span aria-hidden="true" className="mt-1 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_22px_rgba(255,191,0,.35)]" /><div><p className="text-xs font-bold uppercase tracking-[.22em] text-primary">My Website</p><h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-5xl">Let’s build your website</h1><p className="mt-3 max-w-3xl text-base leading-relaxed text-muted-foreground">Answer a few questions and we’ll build a draft you can review before publishing.</p></div></header>
    {demoMode && <p className="rounded-xl border border-primary/50 bg-primary/10 px-5 py-4 text-sm text-primary">Admin preview only. Your answers will not save or publish, and your existing website will not change.</p>}
    <nav className="overflow-x-auto pb-2" aria-label="Website setup progress"><div className="flex min-w-max items-center gap-2 lg:min-w-0 lg:justify-between">{stages.map((label, index) => <div key={label} className="flex items-center gap-2 lg:min-w-0"><button type="button" disabled={index > furthestStep} aria-current={index === step ? 'step' : undefined} onClick={() => setStep(index)} className={`group flex h-11 shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-3 text-sm transition-colors disabled:cursor-not-allowed ${index === step ? 'border border-primary bg-primary/10 font-semibold text-primary shadow-[0_0_18px_rgba(255,191,0,.13)]' : index < step ? 'text-foreground hover:text-primary' : 'text-muted-foreground'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${index === step ? 'border-primary bg-primary text-primary-foreground' : index < step ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>{index < step ? <Check className="h-4 w-4" /> : index + 1}</span><span>{label}</span></button>{index < stages.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border lg:w-6" />}</div>)}</div></nav>
    <section className="rounded-2xl border border-primary/45 bg-card/80 p-5 shadow-[0_16px_50px_rgba(0,0,0,.18)] sm:p-8 lg:p-10">
      {step === 0 && pickerMode && <TemplatePicker
        selected={templateChosen ? answers.template : null}
        onChoose={key => { update('template', key); setTemplateChosen(true); }}
        onPreview={key => { setPreviewDevice(window.matchMedia('(min-width: 1024px)').matches ? 'desktop' : 'mobile'); setPreviewTemplatePage('/'); setPreviewTemplate(key); }}
      />}
      {step === 0 && !pickerMode && <div className="space-y-5">
        <div><h2 className="font-serif text-2xl">Choose your website design</h2><p className="text-muted-foreground">Scroll inside either website to explore it, or open Preview for a larger desktop or phone view.</p></div>
        <div className="grid gap-5 lg:grid-cols-2">
          {guidedTemplates.map(template => <article key={template.key} className={`overflow-hidden rounded-xl border bg-background ${answers.template === template.key ? 'border-primary' : 'border-border'}`}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">{template.name}</p><h3 className="font-serif text-xl">{template.example}</h3></div><span className="text-xs text-muted-foreground">Scroll inside ↓</span></div>
            <iframe key={`${template.key}:${previewServicesText}`} title={`${template.name} scrollable website preview`} src={personalizedPreviews ? undefined : template.url} srcDoc={personalizedPreviews?.[template.key]} loading="lazy" className="block h-[420px] w-full border-0 bg-white" />
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border p-3">
              <Button type="button" size="sm" variant="outline" onClick={() => { setPreviewDevice('desktop'); setPreviewTemplatePage('/'); setPreviewTemplate(template.key); }}><ExternalLink className="mr-1 h-4 w-4" />Preview</Button>
              <Button type="button" size="sm" variant={answers.template === template.key ? 'default' : 'secondary'} onClick={() => update('template', template.key)}>{answers.template === template.key ? 'Selected' : 'Select'}</Button>
            </div>
          </article>)}
        </div>
      </div>}
      {step === 1 && <DomainSetupStep currentDomain={website?.custom_domain || null} input={domainInput} onInput={value => { domainSearchId.current++; setDomainInput(value); setDomainResult(null); setDomainSuggestions([]); setFindingDomainSuggestions(false); if (answers.domain !== value) update('domain', ''); }} onCheck={() => void checkDomain()} onBuy={payment => void buyDomain(payment)} onResume={order => void resumeDomainOrder(order)} onSkip={next} result={domainResult} suggestions={domainSuggestions} findingSuggestions={findingDomainSuggestions} onSelectSuggestion={item => { domainSearchId.current++; setDomainInput(item.domain); setDomainResult(item); setDomainSuggestions([]); setFindingDomainSuggestions(false); }} selectedDomain={answers.domain} onSelectDomain={domain => update('domain', domain)} order={domainOrder} busy={domainBusy} previewOnly={previewOnly} checkoutClientSecret={domainCheckoutClientSecret} onCheckoutComplete={() => void domainCheckoutComplete()} onCheckoutBack={() => setDomainCheckoutClientSecret(null)} />}
      {step === 2 && <div className="max-w-xl space-y-5"><h2 className="font-serif text-2xl">Tell us about your business</h2><Field label="What’s your business name?" value={answers.businessName} onChange={value => update('businessName', value)} placeholder="Your business name" />{!isBusinessOwner && <div className="space-y-2"><label htmlFor="website-client-name" className="block font-medium">Name clients will see</label><Input id="website-client-name" value={websiteAnswers.ownerName} readOnly aria-readonly="true" placeholder="Add your name in My Profile" /><p className="text-xs text-muted-foreground">Change this in <a className="underline" href="/dashboard#profile">My Profile</a>.</p></div>}{dashboardLocationKnown ? <div className="space-y-2"><label htmlFor="website-dashboard-city" className="block font-medium">City and state for your website</label><Input id="website-dashboard-city" value={dashboardCity} readOnly aria-readonly="true" placeholder="Add your work location on the dashboard" /><p className="text-xs text-muted-foreground">{dashboardCity ? "This comes from your saved dashboard business details." : <>Complete your work location on the <a className="underline" href="/dashboard">dashboard</a> first.</>}</p></div> : <Field label="What city are you currently working from?" value={answers.city} onChange={value => update('city', value)} placeholder="City, State" />}<div className="space-y-2"><label htmlFor="website-client-phone" className="block font-medium">Number clients should see</label><Input id="website-client-phone" type="tel" value={websiteAnswers.phone} readOnly aria-readonly="true" placeholder="No public number added" /><p className="text-xs text-muted-foreground">Change this in <a className="underline" href="/dashboard#profile">My Profile</a>.</p></div><label className="block space-y-2"><span className="block font-medium">What services do you want to show?</span><Textarea value={previewServicesText} onChange={e => update('services', e.target.value)} readOnly={!!dashboardServicesText} rows={5} placeholder="One service per line" /></label>{!!dashboardServicesText && <p className="text-xs text-muted-foreground">Services and prices come from <a className="underline" href="/dashboard#profile">My Profile</a>.</p>}</div>}
      {step === 3 && <div className="max-w-xl space-y-5"><h2 className="font-serif text-2xl">How do clients book with you?</h2><p>Do you have a booking app?</p><YesNo value={answers.hasBookingApp} onChange={value => update('hasBookingApp', value)} />{answers.hasBookingApp === true && <Field label="Paste your booking page link" value={answers.bookingUrl} onChange={value => update('bookingUrl', value)} placeholder="https://…" />}{answers.hasBookingApp === false && <label className="block space-y-2"><span className="font-medium">What are your hours of operation?</span><Textarea value={answers.hours} onChange={e => update('hours', e.target.value)} rows={5} placeholder="Mon–Fri 9 AM–6 PM" /></label>}</div>}
      {step === 4 && answers.template === 'guided-charlotte' && <div className="max-w-xl space-y-5"><h2 className="font-serif text-2xl">Social profile</h2><p className="text-muted-foreground">Design 1 keeps its existing editorial photography. Your services appear as a text list without individual photos.</p><label className="block space-y-2"><span className="font-medium">Instagram handle or profile link (optional)</span><Input value={answers.instagram} onChange={event => update('instagram', event.target.value)} placeholder="@yourname" /></label></div>}
      {step === 4 && answers.template !== 'guided-charlotte' && <div className="max-w-2xl space-y-5"><h2 className="font-serif text-2xl">Show your work</h2><p>Do you have an Instagram with a few haircuts or hair systems?</p><YesNo value={answers.hasInstagram} onChange={value => update('hasInstagram', value)} />{answers.hasInstagram && <Field label="Instagram handle or profile link" value={answers.instagram} onChange={value => update('instagram', value)} placeholder="@yourname" />}<Field label="Public page to find your photos (optional)" value={answers.photoSourceUrl} onChange={value => update('photoSourceUrl', value)} placeholder="Your website, portfolio, or Instagram link" /><Button type="button" variant="outline" disabled={!!busy} onClick={findPhotos}><Sparkles className="mr-2 h-4 w-4" />Find photos</Button>{suggestions.length > 0 && <div><p className="mb-3 text-sm text-muted-foreground">Select only photos that belong to you. Nothing is added automatically.</p><div className="grid grid-cols-3 gap-2">{suggestions.map(url => <button type="button" key={url} aria-pressed={answers.photos.includes(url)} onClick={() => update('photos', answers.photos.includes(url) ? answers.photos.filter(item => item !== url) : [...answers.photos, url].slice(0, 6))} className={`relative overflow-hidden rounded-lg border-2 ${answers.photos.includes(url) ? 'border-primary' : 'border-transparent'}`}><img src={url} alt="Suggested work photo" className="h-28 w-full object-cover" />{answers.photos.includes(url) && <Check className="absolute right-2 top-2 h-5 w-5 rounded-full bg-primary p-1 text-black" />}</button>)}</div></div>}<label className="block cursor-pointer rounded-lg border border-dashed border-primary/50 p-5 text-center"><ImagePlus className="mx-auto mb-2 h-6 w-6 text-primary" />Upload your own photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={e => void uploadPhotos(e.target.files)} /></label>{answers.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{answers.photos.map(url => <button key={url} type="button" onClick={() => update('photos', answers.photos.filter(item => item !== url))} className="relative"><img src={url} alt="Selected work photo" className="h-28 w-full rounded-lg object-cover" /><span className="absolute bottom-1 right-1 rounded bg-black/80 px-2 py-1 text-xs text-white">Remove</span></button>)}</div>}</div>}
      {step === 5 && <div className="space-y-5"><div><h2 className="font-serif text-2xl">Review your website</h2><p className="text-muted-foreground">Your answers built this preview. Check the details and photos before publishing.</p></div><div className="flex gap-2"><Button type="button" variant={previewPage === '/' ? 'default' : 'outline'} onClick={() => setPreviewPage('/')}>Home</Button><Button type="button" variant={previewPage !== '/' ? 'default' : 'outline'} onClick={() => setPreviewPage('/hair-loss-solutions/')}>Hair Systems</Button></div><iframe key={`${answers.template}:${previewPage}`} title="Your website preview" srcDoc={pages[previewPage]} className="h-[65vh] w-full rounded-lg border bg-white" />{!previewOnly && <div className="flex flex-wrap gap-3"><Button disabled={!!busy} variant="outline" onClick={() => void save()}>{busy === 'Saving draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save draft</Button><Button disabled={!!busy} onClick={() => void publish()}>{busy === 'Publishing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Publish website</Button></div>}{publishedUrl && <a href={publishedUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open your live website <ExternalLink className="inline h-4 w-4" /></a>}</div>}
    </section>
    <Dialog open={!!previewTemplate} onOpenChange={open => { if (!open) setPreviewTemplate(null); }}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:max-w-none [&>button:last-child]:top-[max(1.1rem,calc(env(safe-area-inset-top)+0.6rem))]">
        <DialogTitle className="sr-only">Full website template preview</DialogTitle>
        <div className="flex items-center gap-2 border-b bg-background px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-12 sm:flex-wrap sm:px-4 sm:pb-3 sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Button type="button" size="lg" variant="outline" className="h-11 shrink-0 border-2 px-3 font-semibold sm:px-4" onClick={() => setPreviewTemplate(null)}><ArrowLeft className="mr-1.5 h-5 w-5" />Back<span className="hidden sm:inline">&nbsp;to designs</span></Button><span className="mr-auto hidden text-sm text-muted-foreground sm:inline">Previewing <strong className="text-foreground">{pickerMode && previewTemplate ? templateDisplayName(previewTemplate) : guidedTemplates.find(template => template.key === previewTemplate)?.name}</strong></span>
          <Button type="button" size="sm" className="hidden sm:inline-flex" variant={previewDevice === 'desktop' ? 'default' : 'outline'} onClick={() => setPreviewDevice('desktop')}><Monitor className="mr-1 h-4 w-4" />Desktop</Button>
          <Button type="button" size="sm" className="hidden sm:inline-flex" variant={previewDevice === 'mobile' ? 'default' : 'outline'} onClick={() => setPreviewDevice('mobile')}><Smartphone className="mr-1 h-4 w-4" />Phone</Button>
          <Button type="button" size="sm" className="ml-auto h-11 sm:ml-0 sm:h-9" onClick={() => { if (previewTemplate) { update('template', previewTemplate); setTemplateChosen(true); } setPreviewTemplate(null); }}>Choose this design</Button>
        </div>
        <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-neutral-900 p-2 sm:p-4">
          {previewTemplate && <iframe key={`${previewTemplate}:${previewTemplatePage}:${previewDevice}:${previewServicesText}`} title={`Full ${previewDevice} website preview`} src={personalizedPreviews ? undefined : guidedTemplates.find(template => template.key === previewTemplate)?.url} srcDoc={previewTemplatePage === '/hair-loss-solutions/' && templateSources
            ? previewTemplate === 'guided-charlotte'
              ? personalizedTemplateOneHairHtml(templateSources['guided-charlotte-hair'], new URL('/website-previews/template-1/hair-loss-solutions/index.html', window.location.origin).href, websiteAnswers, undefined, businessSetup?.business_owner_type)
              : personalizedTemplateTwoHairHtml(templateSources['guided-kait-hair'], new URL('/website-previews/template-2/hair-loss-solutions/index.html', window.location.origin).href, websiteAnswers, undefined, businessSetup?.business_owner_type)
            : personalizedPreviews?.[previewTemplate]} className={`h-full border-0 bg-white shadow-2xl ${previewDevice === 'mobile' ? 'w-full max-w-[390px]' : 'w-full max-w-[1440px]'}`} />}
        </div>
      </DialogContent>
    </Dialog>
    <div className="flex justify-between gap-3"><Button variant="outline" disabled={step === 0 || !!busy} onClick={() => setStep(current => current - 1)} className="h-12 px-5"><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>{step < 5 && (step !== 1 || !!website?.custom_domain || domainOrder?.status === 'registered') && <Button onClick={next} disabled={needsTemplateChoice} className="h-12 px-6 font-semibold">{pickerMode && step === 0 && templateChosen ? `Continue with ${templateDisplayName(answers.template)}` : 'Continue'}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
  </main></DashboardLayout>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="font-medium">{label}</span><Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (value: boolean) => void }) {
  return <div className="flex gap-3">{[true, false].map(option => <Button key={String(option)} type="button" variant={value === option ? 'default' : 'outline'} onClick={() => onChange(option)}>{option ? 'Yes' : 'No'}</Button>)}</div>;
}

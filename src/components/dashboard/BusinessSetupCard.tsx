import { Fragment, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatServiceCity } from '@/lib/formatServiceCity';

type Answer = 'yes' | 'no' | '';
type BusinessNameChoice = 'yes' | 'no' | 'help' | '';
type WebsiteStatus = 'yes' | 'no' | 'being_set_up' | '';
type BookingChoice = 'link' | 'search' | '';
type BookingCandidate = { url: string; title: string; evidence: string; businessName: string; location: string; confidence?: 'confirmed' | 'possible' };
type OwnerType = 'barbershop' | 'salon' | 'none' | '';
type ProfessionalRole = 'barber' | 'stylist' | '';
type WorkplaceType = 'barbershop' | 'salon' | 'suite' | 'home' | 'mobile' | 'other' | 'not_cutting' | '';
type WorkStatus = 'individual_barber' | 'individual_stylist' | 'barbershop_owner' | 'salon_owner' | '';
type TeamSize = 'none' | 'one' | 'two_to_five' | 'six_to_ten' | 'eleven_plus' | '';
type SetupDraft = {
  city: string; workStreet: string; workCity: string; workState: string; workPostalCode: string;
  workStatus: WorkStatus; cutsAtOwnedBusiness: Answer; teamSize: TeamSize; workplaceType: WorkplaceType;
  workplaceOtherDescription: string;
  businessNameChoice: BusinessNameChoice; businessName: string;
  website: WebsiteStatus; websiteUrl: string; booking: Answer; bookingChoice: BookingChoice;
  bookingUrl: string; bookingPlatform: string;
};
const bookingResearchBridge = 'https://jbnsjjeimwpkwxkwmqwl.supabase.co/functions/v1/barber-launch-booking-bridge';

const statusOptions: Array<{ value: WorkStatus; label: string }> = [
  { value: 'individual_barber', label: 'I am an individual barber' },
  { value: 'individual_stylist', label: 'I am an individual stylist' },
  { value: 'barbershop_owner', label: 'I own a barbershop' },
  { value: 'salon_owner', label: 'I own a salon' },
];

const statusFromProfile = (owner: OwnerType, role: ProfessionalRole): WorkStatus => {
  if (owner === 'barbershop') return 'barbershop_owner';
  if (owner === 'salon') return 'salon_owner';
  if (role === 'barber') return 'individual_barber';
  if (role === 'stylist') return 'individual_stylist';
  return '';
};

const normalizeUrl = (value: string) => {
  const trimmed = value.trim();
  return trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed;
};
const validDraftUrl = (value: string) => {
  if (!value.trim()) return null;
  try {
    const parsed = new URL(normalizeUrl(value));
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.includes('.') ? parsed.href : null;
  } catch { return null; }
};
const profileFields = (draft: SetupDraft) => {
  const ownsBarbershop = draft.workStatus === 'barbershop_owner';
  const ownsSalon = draft.workStatus === 'salon_owner';
  const ownsBusiness = ownsBarbershop || ownsSalon;
  const usesWorkAddress = ownsBusiness || ['barbershop', 'salon', 'suite'].includes(draft.workplaceType);
  const usesServiceCity = !ownsBusiness && ['home', 'mobile', 'other'].includes(draft.workplaceType);
  const location = usesWorkAddress && draft.workCity.trim() && draft.workState.trim()
    ? formatServiceCity(`${draft.workCity.trim()}, ${draft.workState.trim()}`)
    : usesServiceCity && draft.city.trim() ? formatServiceCity(draft.city) : null;
  return {
    business_name: ownsBusiness || draft.businessNameChoice === 'yes' ? draft.businessName.trim() || null : null,
    business_owner_type: ownsBarbershop ? 'barbershop' : ownsSalon ? 'salon' : draft.workStatus ? 'none' : null,
    cuts_at_owned_business: ownsBusiness && draft.cutsAtOwnedBusiness ? draft.cutsAtOwnedBusiness === 'yes' : null,
    currently_cutting: draft.workStatus ? (ownsBusiness ? draft.cutsAtOwnedBusiness ? draft.cutsAtOwnedBusiness === 'yes' : null
      : draft.workplaceType ? draft.workplaceType !== 'not_cutting' : null) : null,
    professional_role: draft.workStatus === 'individual_barber' ? 'barber' : draft.workStatus === 'individual_stylist' ? 'stylist' : null,
    workplace_type: !ownsBusiness && draft.workplaceType && draft.workplaceType !== 'not_cutting' ? draft.workplaceType : null,
    workplace_other_description: !ownsBusiness && draft.workplaceType === 'other' ? draft.workplaceOtherDescription.trim() || null : null,
    other_professionals_count: ownsBusiness ? draft.teamSize || null : null,
    service_city: location,
    work_location_street: usesWorkAddress ? draft.workStreet.trim() || null : null,
    work_location_city: usesWorkAddress ? draft.workCity.trim() || null : null,
    work_location_state: usesWorkAddress ? draft.workState.trim() || null : null,
    work_location_postal_code: usesWorkAddress ? draft.workPostalCode.trim() || null : null,
    website_status: draft.website || null,
    website_url: draft.website === 'yes' ? validDraftUrl(draft.websiteUrl) : null,
    booking_app_status: draft.booking || null,
    booking_link_status: draft.booking === 'yes' ? draft.bookingChoice || null : null,
    booking_url: draft.booking === 'yes' ? validDraftUrl(draft.bookingUrl) : null,
    booking_platform: draft.booking === 'yes' ? draft.bookingPlatform || null : null,
  };
};

const selectTriggerClass = 'h-12 w-full cursor-pointer border-[#596574] bg-[#252b35] text-foreground hover:border-[#8592a2] hover:bg-[#2d3541] focus:ring-primary data-[state=open]:border-[#f6c34a] data-[state=open]:ring-1 data-[state=open]:ring-[#f6c34a]';
const selectContentClass = 'border-[#aa7b24] bg-[#1d222b] text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.55)]';
const selectContentStyle = { maxHeight: 'min(24rem, var(--radix-select-content-available-height))' };
const selectItemClass = 'min-h-12 rounded-md border-l-4 border-transparent py-3 pl-7 pr-3 text-[15px] focus:bg-[#303a47] focus:text-white data-[highlighted]:bg-[#303a47] data-[highlighted]:text-white';
const selectedSelectItemClass = 'border-l-[#f6c34a] bg-[#3d3d36] font-medium';
const selectDividerClass = 'mx-3 my-1 h-px bg-[#3b4552]';
const optionClass = (selected: boolean) => `${selectItemClass} ${selected ? selectedSelectItemClass : ''}`;
const localDraftKey = (userId: string) => `barber-launch-business-setup-draft:${userId}`;
const makeRoomForMenu = (trigger: HTMLButtonElement) => {
  const spaceBelow = window.innerHeight - trigger.getBoundingClientRect().bottom;
  if (spaceBelow < 320) window.scrollBy({ top: 336 - spaceBelow, behavior: 'auto' });
};

const missingFieldClass = '!border-[#f6c34a] !ring-2 !ring-[#f6c34a] !ring-offset-2 !ring-offset-[#0b0d11]';

function SetupSelect({ id, label, value, onChange, options }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return <div className="space-y-3">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className={selectTriggerClass} onPointerDown={(event) => makeRoomForMenu(event.currentTarget)} onKeyDown={(event) => { if (['Enter', ' ', 'ArrowDown'].includes(event.key)) makeRoomForMenu(event.currentTarget); }}><SelectValue placeholder="Select an option" /></SelectTrigger>
      <SelectContent className={selectContentClass} style={selectContentStyle} side="bottom" sideOffset={4} avoidCollisions={false}>
        {options.map((option, index) => <Fragment key={option.value}>
          {index > 0 && <SelectSeparator className={selectDividerClass} />}
          <SelectItem className={optionClass(value === option.value)} value={option.value}>{option.label}</SelectItem>
        </Fragment>)}
      </SelectContent>
    </Select>
  </div>;
}

export function BusinessSetupCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [editingComplete, setEditingComplete] = useState(false);
  const [city, setCity] = useState('');
  const [workStreet, setWorkStreet] = useState('');
  const [workCity, setWorkCity] = useState('');
  const [workState, setWorkState] = useState('');
  const [workPostalCode, setWorkPostalCode] = useState('');
  const [workStatus, setWorkStatus] = useState<WorkStatus>('');
  const [businessNameChoice, setBusinessNameChoice] = useState<BusinessNameChoice>('');
  const [businessName, setBusinessName] = useState('');
  const [cutsAtOwnedBusiness, setCutsAtOwnedBusiness] = useState<Answer>('');
  const [teamSize, setTeamSize] = useState<TeamSize>('');
  const [workplaceType, setWorkplaceType] = useState<WorkplaceType>('');
  const [workplaceOtherDescription, setWorkplaceOtherDescription] = useState('');
  const [website, setWebsite] = useState<WebsiteStatus>('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [booking, setBooking] = useState<Answer>('');
  const [bookingChoice, setBookingChoice] = useState<BookingChoice>('');
  const [bookingUrl, setBookingUrl] = useState('');
  const [bookingPlatform, setBookingPlatform] = useState('');
  const [invalidFieldId, setInvalidFieldId] = useState('');
  const [searchingBooking, setSearchingBooking] = useState(false);
  const [bookingCandidates, setBookingCandidates] = useState<BookingCandidate[]>([]);
  const [bookingSearchMessage, setBookingSearchMessage] = useState('');
  const [bookingSearchAttempted, setBookingSearchAttempted] = useState(false);
  const [bookingSearchKey, setBookingSearchKey] = useState('');
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [retryVersion, setRetryVersion] = useState(0);
  const readyToSync = useRef(false);
  const lastSyncedDraft = useRef('');
  const latestDraft = useRef('');
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveQueue = useRef<Promise<void>>(Promise.resolve());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(3000);
  const submitting = useRef(false);
  const previousBookingLookupKey = useRef('');

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('member_onboarding_profiles')
      .select('service_city, work_location_street, work_location_city, work_location_state, work_location_postal_code, business_name, business_owner_type, cuts_at_owned_business, currently_cutting, professional_role, workplace_type, workplace_other_description, other_professionals_count, website_status, website_url, booking_app_status, booking_link_status, booking_url, booking_platform, business_setup_completed_at, business_setup_draft, business_setup_draft_updated_at')
      .eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) { toast.error('Could not load your business setup'); setLoading(false); return; }
        const needsWorkAddress = !!data?.business_setup_completed_at && (
          (data.business_owner_type === 'barbershop' || data.business_owner_type === 'salon') ||
          (data.business_owner_type === 'none' && ['barbershop', 'salon', 'suite'].includes(data.workplace_type || ''))
        ) && (!data.work_location_street || !data.work_location_city || !data.work_location_state || !data.work_location_postal_code);
        const draftOtherDescription = data?.business_setup_draft && typeof data.business_setup_draft === 'object' &&
          !Array.isArray(data.business_setup_draft) && typeof data.business_setup_draft.workplaceOtherDescription === 'string'
          ? data.business_setup_draft.workplaceOtherDescription : '';
        const savedOtherDescription = data?.workplace_other_description || draftOtherDescription;
        const needsOtherDescription = !!data?.business_setup_completed_at && data.workplace_type === 'other' && !savedOtherDescription.trim();
        const owner = (data?.business_owner_type || '') as OwnerType;
        const storedDraft: SetupDraft = {
          city: data?.service_city || '', workStreet: data?.work_location_street || '',
          workCity: data?.work_location_city || '', workState: data?.work_location_state || '',
          workPostalCode: data?.work_location_postal_code || '',
          workStatus: statusFromProfile(owner, (data?.professional_role || '') as ProfessionalRole),
          businessNameChoice: data?.business_name ? 'yes' : data?.business_setup_completed_at ? 'no' : '', businessName: data?.business_name || '',
          cutsAtOwnedBusiness: data?.cuts_at_owned_business == null ? '' : data.cuts_at_owned_business ? 'yes' : 'no',
          teamSize: (data?.other_professionals_count || '') as TeamSize,
          workplaceType: data?.currently_cutting === false && owner === 'none' ? 'not_cutting' : (data?.workplace_type || '') as WorkplaceType,
          workplaceOtherDescription: savedOtherDescription,
          website: (data?.website_status || '') as WebsiteStatus, websiteUrl: data?.website_url || '',
          booking: (data?.booking_app_status || '') as Answer,
          bookingChoice: (data?.booking_link_status || '') as BookingChoice,
          bookingUrl: data?.booking_url || '', bookingPlatform: data?.booking_platform || '',
        };
        const remote = data?.business_setup_draft && typeof data.business_setup_draft === 'object' && !Array.isArray(data.business_setup_draft)
          ? data.business_setup_draft as Partial<SetupDraft> : null;
        const remoteDraft = { ...storedDraft, ...remote };
        lastSyncedDraft.current = JSON.stringify(remoteDraft);
        let draft = remoteDraft;
        try {
          const saved = localStorage.getItem(localDraftKey(user.id));
          if (saved) {
            const parsed = JSON.parse(saved) as { draft?: Partial<SetupDraft>; updatedAt?: string } & Partial<SetupDraft>;
            const local = parsed.draft || parsed;
            const remoteTime = Date.parse(data?.business_setup_draft_updated_at || '') || 0;
            const localTime = parsed.draft ? Date.parse(parsed.updatedAt || '') || 0 : Number.MAX_SAFE_INTEGER;
            if (localTime >= remoteTime) draft = { ...remoteDraft, ...local };
            else localStorage.removeItem(localDraftKey(user.id));
          }
        } catch { toast.error('Could not load your earlier draft'); }
        setCity(draft.city || '');
        setWorkStreet(draft.workStreet || '');
        setWorkCity(draft.workCity || '');
        setWorkState(draft.workState || '');
        setWorkPostalCode(draft.workPostalCode || '');
        setWorkStatus(draft.workStatus || '');
        setBusinessNameChoice(draft.businessNameChoice || '');
        setBusinessName(draft.businessName || '');
        setCutsAtOwnedBusiness(draft.cutsAtOwnedBusiness || '');
        setTeamSize(draft.teamSize || '');
        setWorkplaceType(draft.workplaceType || '');
        setWorkplaceOtherDescription(draft.workplaceOtherDescription || '');
        setWebsite(draft.website || '');
        setWebsiteUrl(draft.websiteUrl || '');
        setBooking(draft.booking || '');
        setBookingChoice(draft.bookingChoice || '');
        setBookingUrl(draft.bookingUrl || '');
        setBookingPlatform(draft.bookingPlatform || '');
        setComplete(!!data?.business_setup_completed_at && !needsWorkAddress && !needsOtherDescription);
        const remoteIsPending = !!remote && !!data.business_setup_draft_updated_at &&
          Date.parse(data.business_setup_draft_updated_at) > Date.parse(data.business_setup_completed_at || '');
        if (data?.business_setup_completed_at && (remoteIsPending || JSON.stringify(draft) !== JSON.stringify(remoteDraft))) setEditingComplete(true);
        readyToSync.current = true;
        setLoading(false);
      });
    return () => { active = false; if (retryTimer.current) clearTimeout(retryTimer.current); };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || loading || !readyToSync.current || submitting.current || (complete && !editingComplete)) return;
    const draft: SetupDraft = { city, workStreet, workCity, workState, workPostalCode, workStatus,
      cutsAtOwnedBusiness, teamSize, workplaceType, workplaceOtherDescription, businessNameChoice, businessName, website, websiteUrl,
      booking, bookingChoice, bookingUrl, bookingPlatform };
    const snapshot = JSON.stringify(draft);
    latestDraft.current = snapshot;
    if (snapshot === lastSyncedDraft.current) return;
    try { localStorage.setItem(localDraftKey(user.id), JSON.stringify({ draft, updatedAt: new Date().toISOString() })); }
    catch { /* Server autosave remains available. */ }
    setDraftStatus('saving');
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const scheduleRetry = () => {
      if (latestDraft.current !== snapshot) return;
      setDraftStatus('error');
      retryTimer.current = setTimeout(() => setRetryVersion(value => value + 1), retryDelay.current);
      retryDelay.current = Math.min(retryDelay.current * 2, 30000);
    };
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveQueue.current = autosaveQueue.current.catch(() => {}).then(async () => {
        if (submitting.current) return;
        try {
          const { error } = await supabase.from('member_onboarding_profiles').upsert({
            user_id: user.id, ...profileFields(draft), business_setup_draft: draft,
            business_setup_draft_updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
          if (error) { scheduleRetry(); return; }
          lastSyncedDraft.current = snapshot;
          if (latestDraft.current === snapshot) {
            try { localStorage.removeItem(localDraftKey(user.id)); } catch { /* Remote save succeeded. */ }
            retryDelay.current = 3000;
            setDraftStatus('saved');
          }
        } catch {
          scheduleRetry();
        }
      });
    }, 500);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [user?.id, loading, complete, editingComplete, city, workStreet, workCity, workState,
    workPostalCode, workStatus, cutsAtOwnedBusiness, teamSize, workplaceType, workplaceOtherDescription, businessNameChoice, businessName, website,
    websiteUrl, booking, bookingChoice, bookingUrl, bookingPlatform, retryVersion]);

  useEffect(() => { setInvalidFieldId(''); }, [city, workStreet, workCity, workState, workPostalCode,
    workStatus, cutsAtOwnedBusiness, teamSize, workplaceType, workplaceOtherDescription, businessNameChoice, businessName,
    website, websiteUrl, booking, bookingChoice, bookingUrl, bookingPlatform, bookingSearchAttempted]);

  useEffect(() => {
    if (!invalidFieldId) return;
    const field = document.getElementById(invalidFieldId);
    if (!field) return;
    const classes = missingFieldClass.split(' ');
    field.classList.add(...classes);
    field.setAttribute('aria-invalid', 'true');
    return () => { field.classList.remove(...classes); field.removeAttribute('aria-invalid'); };
  }, [invalidFieldId]);

  const ownsBarbershop = workStatus === 'barbershop_owner';
  const ownsSalon = workStatus === 'salon_owner';
  const ownsBusiness = ownsBarbershop || ownsSalon;
  const usesWorkAddress = ownsBusiness || workplaceType === 'barbershop' || workplaceType === 'salon' || workplaceType === 'suite';
  const usesServiceCity = !ownsBusiness && (workplaceType === 'home' || workplaceType === 'mobile' || workplaceType === 'other');
  const needsBookingSearchCity = !usesWorkAddress && !usesServiceCity && booking === 'yes' && bookingChoice === 'search';
  const bookingLookupCity = usesWorkAddress ? formatServiceCity(`${workCity.trim()}, ${workState.trim()}`)
    : usesServiceCity || needsBookingSearchCity ? formatServiceCity(city) : '';
  const bookingLookupKey = JSON.stringify({ city: bookingLookupCity, website: website === 'yes' ? normalizeUrl(websiteUrl) : '',
    platform: bookingPlatform, workStatus, businessName: (ownsBusiness || businessNameChoice === 'yes') ? businessName.trim() : '' });

  useEffect(() => {
    if (loading) return;
    if (previousBookingLookupKey.current && previousBookingLookupKey.current !== bookingLookupKey && bookingChoice === 'search') {
      setBookingUrl('');
      setBookingCandidates([]);
      setBookingSearchAttempted(false);
      setBookingSearchKey('');
      setBookingSearchMessage('Your details changed. Search again to check the right booking page.');
    }
    previousBookingLookupKey.current = bookingLookupKey;
  }, [loading, bookingLookupKey, bookingChoice]);

  if (!user || loading) return null;

  if (complete && !editingComplete) return <section className="glass-card rounded-xl p-5 md:p-7" aria-labelledby="business-setup-title">
    <p className="text-xs font-semibold uppercase tracking-widest text-primary">First step complete</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
      <h2 id="business-setup-title" className="text-xl font-semibold text-foreground">Your business details are saved</h2>
      <Button type="button" variant="outline" onClick={() => setEditingComplete(true)}>Edit answers</Button>
    </div>
  </section>;


  const revealField = (id: string, message = 'Please answer this question before saving') => {
    setInvalidFieldId(id);
    requestAnimationFrame(() => {
      const field = document.getElementById(id);
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field?.focus({ preventScroll: true });
    });
    toast.error(message);
  };

  const findBookingLink = async () => {
    if (usesWorkAddress && (!workCity.trim() || !workState.trim())) {
      revealField(!workCity.trim() ? 'work-location-city' : 'work-location-state', 'Enter your city and state before searching'); return;
    }
    if (!bookingLookupCity) {
      revealField(needsBookingSearchCity ? 'booking-search-city' : 'service-city', 'Enter your city and state before searching'); return;
    }
    if (!bookingPlatform) { revealField('booking-platform', 'Choose your booking app, or Other / not sure'); return; }
    setSearchingBooking(true);
    setBookingSearchAttempted(false);
    setBookingSearchKey('');
    setBookingSearchMessage('');
    setBookingCandidates([]);
    setBookingUrl('');
    try {
      const { data: session, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session.session?.access_token) throw new Error('Please sign in again before searching.');
      const response = await fetch(bookingResearchBridge, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.session.access_token}` },
        body: JSON.stringify({ city: bookingLookupCity, website: website === 'yes' ? normalizeUrl(websiteUrl) : '',
          platform: bookingPlatform, scope: ownsBusiness ? 'shop' : 'individual' }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || 'The search could not finish. Please try again.');
      const candidates = Array.isArray(data?.candidates) ? data.candidates as BookingCandidate[] : [];
      setBookingSearchAttempted(true);
      setBookingSearchKey(bookingLookupKey);
      setBookingCandidates(candidates);
      setBookingSearchMessage(candidates.length ? 'Choose your booking page to save it.' : 'No reliable match found. You can leave a request for our team below.');
    } catch (error) {
      setBookingSearchMessage(error instanceof Error ? error.message : 'The search could not finish. Please try again.');
    } finally {
      setSearchingBooking(false);
    }
  };

  const save = async () => {
    const firstMissing = [
      !workStatus && 'work-status',
      !ownsBusiness && !!workStatus && !workplaceType && 'workplace-type',
      !ownsBusiness && workplaceType === 'other' && !workplaceOtherDescription.trim() && 'workplace-other-description',
      ownsBusiness && !cutsAtOwnedBusiness && 'cuts-at-owned-business',
      ownsBusiness && !teamSize && 'other-professionals-count',
      !ownsBusiness && !!workStatus && !businessNameChoice && 'business-name-choice',
      (ownsBusiness || businessNameChoice === 'yes') && !businessName.trim() && 'business-name',
      usesWorkAddress && !workStreet.trim() && 'work-location-street',
      usesWorkAddress && !workCity.trim() && 'work-location-city',
      usesWorkAddress && !workState.trim() && 'work-location-state',
      usesWorkAddress && !workPostalCode.trim() && 'work-location-postal-code',
      usesServiceCity && !city.trim() && 'service-city',
      needsBookingSearchCity && !city.trim() && 'booking-search-city',
      !website && 'website-status',
      website === 'yes' && !websiteUrl.trim() && 'website-url',
      !booking && 'booking-app-status',
      booking === 'yes' && !bookingChoice && 'booking-choice',
      booking === 'yes' && bookingChoice === 'link' && !bookingUrl.trim() && 'booking-url',
      booking === 'yes' && bookingChoice === 'search' && !bookingPlatform && 'booking-platform',
      booking === 'yes' && bookingChoice === 'search' &&
        ((!bookingSearchAttempted && !bookingUrl.trim()) || (bookingSearchAttempted && bookingSearchKey !== bookingLookupKey)) && 'find-booking-link',
      booking === 'yes' && bookingChoice === 'search' && bookingCandidates.length > 0 &&
        !bookingUrl.trim() && 'booking-candidates',
    ].find((id): id is string => typeof id === 'string');
    if (firstMissing) { revealField(firstMissing); return; }
    if (website === 'yes' && !validDraftUrl(websiteUrl)) { revealField('website-url', 'Enter a valid website URL'); return; }
    if (booking === 'yes' && bookingUrl.trim() && !validDraftUrl(bookingUrl)) {
      revealField(bookingChoice === 'search' ? 'booking-candidates' : 'booking-url', 'Enter a valid booking URL'); return;
    }
    const draft: SetupDraft = { city, workStreet, workCity, workState, workPostalCode, workStatus,
      cutsAtOwnedBusiness, teamSize, workplaceType, workplaceOtherDescription, businessNameChoice, businessName, website, websiteUrl,
      booking, bookingChoice, bookingUrl, bookingPlatform };
    setSaving(true);
    submitting.current = true;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await autosaveQueue.current;
    const { error } = await supabase.from('member_onboarding_profiles').upsert({
      user_id: user.id, ...profileFields(draft), business_setup_draft: {
        businessNameChoice: draft.businessNameChoice,
        ...(needsBookingSearchCity ? { city: formatServiceCity(draft.city) } : {}),
        ...(draft.workplaceType === 'other' ? { workplaceOtherDescription: draft.workplaceOtherDescription.trim() } : {}),
      },
      business_setup_draft_updated_at: null,
      business_setup_completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    setSaving(false);
    submitting.current = false;
    if (error) { setDraftStatus('error'); toast.error('Could not save your answers. Please try again.'); return; }
    try { localStorage.removeItem(localDraftKey(user.id)); } catch { /* The server save succeeded. */ }
    const formattedCity = profileFields(draft).service_city;
    if (formattedCity) setCity(formattedCity);
    lastSyncedDraft.current = JSON.stringify(draft);
    setDraftStatus('saved');
    setComplete(true);
    setEditingComplete(false);
    toast.success('Business details saved');
  };

  return <section className="glass-card rounded-xl p-5 md:p-7 space-y-6" aria-labelledby="business-setup-title">
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-primary">First step</p>
      <h2 id="business-setup-title" className="mt-1 text-xl md:text-2xl font-semibold text-foreground">Tell us about your status as a hair professional</h2>
      <p className="mt-1 text-sm text-muted-foreground">This helps us set up your local marketing and booking links.</p>
      <p className="mt-2 text-xs text-muted-foreground" role="status" aria-live="polite">
        {draftStatus === 'saving' ? 'Saving your answers…' : draftStatus === 'saved' ? 'Answers saved to your account.'
          : draftStatus === 'error' ? 'Could not sync yet. Your answers are saved in this browser; retrying automatically.'
          : 'Your answers save automatically as you type.'}
      </p>
    </div>
    <SetupSelect id="work-status" label="Select an option" value={workStatus}
      onChange={(value) => {
        const nextIsOwner = value === 'barbershop_owner' || value === 'salon_owner';
        if (nextIsOwner !== ownsBusiness || (ownsBusiness && value !== workStatus)) { setBusinessName(''); setBusinessNameChoice(''); }
        setWorkStatus(value as WorkStatus); setCutsAtOwnedBusiness(''); setTeamSize(''); setWorkplaceType('');
      }}
      options={statusOptions} />
    {!!workStatus && !ownsBusiness && <SetupSelect id="workplace-type" label="Where do you currently cut hair?" value={workplaceType}
      onChange={(value) => setWorkplaceType(value as WorkplaceType)}
      options={[{ value: 'barbershop', label: 'At a barbershop' }, { value: 'salon', label: 'At a hair salon' }, { value: 'suite', label: 'In a private suite' }, { value: 'home', label: 'From home' }, { value: 'mobile', label: 'I am a mobile-only barber or stylist' }, { value: 'other', label: 'Somewhere else' }, { value: 'not_cutting', label: 'I’m not currently cutting hair' }]} />}
    {!!workStatus && !ownsBusiness && workplaceType === 'other' && <div className="space-y-2">
      <label htmlFor="workplace-other-description" className="block text-sm font-medium">Where do you currently cut hair? Please describe.</label>
      <Textarea id="workplace-other-description" value={workplaceOtherDescription}
        onChange={event => setWorkplaceOtherDescription(event.target.value)} placeholder="Describe your work location" rows={3} />
    </div>}
    {ownsBusiness && <SetupSelect id="cuts-at-owned-business" label={ownsBarbershop ? 'Do you cut hair at your barbershop?' : 'Do you cut hair at your salon?'} value={cutsAtOwnedBusiness}
      onChange={(value) => setCutsAtOwnedBusiness(value as Answer)}
      options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />}
    {ownsBusiness && <SetupSelect id="other-professionals-count" label={ownsBarbershop ? 'Do you have any other barbers or stylists working at your barbershop?' : 'Do you have any other stylists or barbers working at your salon?'} value={teamSize}
      onChange={(value) => setTeamSize(value as TeamSize)}
      options={[{ value: 'none', label: 'No, it’s just me currently' }, { value: 'one', label: 'Yes, I have 1 other' }, { value: 'two_to_five', label: 'Yes, I have 2–5 others' }, { value: 'six_to_ten', label: 'Yes, I have 6–10 others' }, { value: 'eleven_plus', label: 'Yes, I have 11 or more' }]} />}
    {ownsBusiness ? <div className="space-y-2">
      <label htmlFor="business-name" className="block text-sm font-medium">{ownsBarbershop ? 'What is your barbershop name?' : 'What is your salon name?'}</label>
      <Input id="business-name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder={ownsBarbershop ? 'Barbershop name' : 'Salon name'} />
    </div> : !!workStatus && <>
      <SetupSelect id="business-name-choice" label="Do you have a business name you like to go by?" value={businessNameChoice}
        onChange={value => setBusinessNameChoice(value as BusinessNameChoice)}
        options={[{ value: 'yes', label: 'Yes' }, { value: 'help', label: 'Not yet. I need help.' }, { value: 'no', label: 'I’d just like to go by my name' }]} />
      {businessNameChoice === 'yes' && <div className="space-y-2">
        <label htmlFor="business-name" className="block text-sm font-medium">What business name do you go by?</label>
        <Input id="business-name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Your business name" />
      </div>}
    </>}
    {usesWorkAddress && <div className="space-y-3">
      <p className="text-sm font-medium">{ownsBarbershop ? 'What is the full address of your barbershop?' : ownsSalon ? 'What is the full address of your salon?' : 'What is the address of the location where you work?'}</p>
      <div className="space-y-2">
        <label htmlFor="work-location-street" className="block text-xs text-muted-foreground">Street address and suite number</label>
        <Input id="work-location-street" autoComplete="street-address" value={workStreet} onChange={e => setWorkStreet(e.target.value)} placeholder="123 Main St, Suite 4" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7rem_7rem]">
        <div className="space-y-2"><label htmlFor="work-location-city" className="block text-xs text-muted-foreground">City</label><Input id="work-location-city" autoComplete="address-level2" value={workCity} onChange={e => setWorkCity(e.target.value)} placeholder="Clearwater" /></div>
        <div className="space-y-2"><label htmlFor="work-location-state" className="block text-xs text-muted-foreground">State</label><Input id="work-location-state" autoComplete="address-level1" value={workState} onChange={e => setWorkState(e.target.value)} placeholder="Florida" /></div>
        <div className="space-y-2"><label htmlFor="work-location-postal-code" className="block text-xs text-muted-foreground">ZIP code</label><Input id="work-location-postal-code" autoComplete="postal-code" inputMode="numeric" value={workPostalCode} onChange={e => setWorkPostalCode(e.target.value)} placeholder="33755" /></div>
      </div>
    </div>}
    {usesServiceCity && <div className="space-y-2">
      <label htmlFor="service-city" className="block text-sm font-medium">What city and state do you serve?</label>
      <Input id="service-city" value={city} onChange={e => setCity(e.target.value)} onBlur={() => setCity(formatServiceCity(city))} placeholder="e.g. Clearwater, Florida" />
    </div>}
    <div className="space-y-3">
      <label htmlFor="website-status" className="block text-sm font-medium">Do you currently have a website?</label>
      <Select value={website} onValueChange={(value: WebsiteStatus) => setWebsite(value)}>
        <SelectTrigger id="website-status" className={selectTriggerClass} onPointerDown={(event) => makeRoomForMenu(event.currentTarget)} onKeyDown={(event) => { if (['Enter', ' ', 'ArrowDown'].includes(event.key)) makeRoomForMenu(event.currentTarget); }}>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent className={selectContentClass} style={selectContentStyle} side="bottom" sideOffset={4} avoidCollisions={false}>
          <SelectItem className={optionClass(website === 'yes')} value="yes">Yes, I have a website</SelectItem>
          <SelectSeparator className={selectDividerClass} />
          <SelectItem className={optionClass(website === 'no')} value="no">No, I don’t have a website</SelectItem>
          <SelectSeparator className={selectDividerClass} />
          <SelectItem className={optionClass(website === 'being_set_up')} value="being_set_up">It’s currently being set up</SelectItem>
        </SelectContent>
      </Select>
      {website === 'yes' && <div><label htmlFor="website-url" className="mb-2 block text-sm text-muted-foreground">Your website URL</label><Input id="website-url" type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="yourwebsite.com" /></div>}
    </div>
    <div className="space-y-3">
      <label htmlFor="booking-app-status" className="block text-sm font-medium">Do you currently use a booking app?</label>
      <Select value={booking} onValueChange={(value: Answer) => setBooking(value)}>
        <SelectTrigger id="booking-app-status" className={selectTriggerClass} onPointerDown={(event) => makeRoomForMenu(event.currentTarget)} onKeyDown={(event) => { if (['Enter', ' ', 'ArrowDown'].includes(event.key)) makeRoomForMenu(event.currentTarget); }}>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent className={selectContentClass} style={selectContentStyle} side="bottom" sideOffset={4} avoidCollisions={false}>
          <SelectItem className={optionClass(booking === 'yes')} value="yes">Yes, I use a booking app</SelectItem>
          <SelectSeparator className={selectDividerClass} />
          <SelectItem className={optionClass(booking === 'no')} value="no">No, I don’t use a booking app</SelectItem>
        </SelectContent>
      </Select>
      {booking === 'yes' && <div className="space-y-3 pl-0 md:pl-2">
        <label htmlFor="booking-choice" className="block text-sm font-medium">How should we get your booking link?</label>
        <Select value={bookingChoice} onValueChange={(value: BookingChoice) => { setBookingChoice(value); setBookingCandidates([]); setBookingSearchMessage(''); setBookingSearchAttempted(false); setBookingUrl(''); }}>
          <SelectTrigger id="booking-choice" className={selectTriggerClass} onPointerDown={(event) => makeRoomForMenu(event.currentTarget)} onKeyDown={(event) => { if (['Enter', ' ', 'ArrowDown'].includes(event.key)) makeRoomForMenu(event.currentTarget); }}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent className={selectContentClass} style={selectContentStyle} side="bottom" sideOffset={4} avoidCollisions={false}>
            <SelectItem className={optionClass(bookingChoice === 'link')} value="link">I’ll paste my booking link</SelectItem>
            <SelectSeparator className={selectDividerClass} />
            <SelectItem className={optionClass(bookingChoice === 'search')} value="search">Please find my booking link</SelectItem>
          </SelectContent>
        </Select>
        {bookingChoice === 'link' && <div><label htmlFor="booking-url" className="mb-2 block text-sm text-muted-foreground">Your booking link</label><Input id="booking-url" type="url" value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="booking-app.com/your-name" /></div>}
        {bookingChoice === 'search' && <div className="space-y-3">
          <p className="text-xs text-muted-foreground">We’ll search using your name and city. Your website helps confirm the right page.</p>
          {needsBookingSearchCity && <div className="space-y-2">
            <label htmlFor="booking-search-city" className="block text-sm font-medium">What city and state should we search?</label>
            <Input id="booking-search-city" value={city} onChange={event => setCity(event.target.value)}
              onBlur={() => setCity(formatServiceCity(city))} placeholder="e.g. Clearwater, Florida" />
          </div>}
          <SetupSelect id="booking-platform" label="Which booking app do you use?" value={bookingPlatform}
            onChange={(value) => { setBookingPlatform(value); setBookingCandidates([]); setBookingSearchAttempted(false); setBookingUrl(''); }}
            options={[
              { value: 'Booksy', label: 'Booksy' }, { value: 'Vagaro', label: 'Vagaro' },
              { value: 'TheCut', label: 'The Cut' }, { value: 'StyleSeat', label: 'StyleSeat' },
              { value: 'Fresha', label: 'Fresha' }, { value: 'Square', label: 'Square' },
              { value: 'Squire', label: 'Squire' }, { value: 'GlossGenius', label: 'GlossGenius' },
              { value: 'Other', label: 'Other / not sure' },
            ]} />
          <Button id="find-booking-link" type="button" variant="outline" onClick={findBookingLink} disabled={searchingBooking}>
            {searchingBooking ? 'Searching…' : 'Find my booking link'}
          </Button>
          {bookingSearchAttempted && bookingSearchKey !== bookingLookupKey
            ? <p role="status" className="text-xs text-muted-foreground">Your details changed. Search again to check the right booking page.</p>
            : bookingSearchMessage && <p role="status" className="text-xs text-muted-foreground">{bookingSearchMessage}</p>}
          {bookingCandidates.length > 0 && bookingSearchKey === bookingLookupKey && <div id="booking-candidates" tabIndex={-1} className="space-y-2 rounded-lg" aria-label="Booking page matches">
            {bookingCandidates.map(candidate => <button key={candidate.url} type="button"
              aria-pressed={bookingUrl === candidate.url}
              onClick={() => setBookingUrl(candidate.url)}
              className={`block w-full rounded-lg border p-3 text-left text-sm ${bookingUrl === candidate.url ? 'border-primary bg-primary/10' : 'border-border bg-background/40'}`}>
              <span className="block font-medium">{candidate.title || candidate.businessName || candidate.url}</span>
              {candidate.confidence === 'possible' && <span className="mt-1 block text-xs font-medium text-primary">Possible match — check the barber and location</span>}
              <span className="block text-xs text-muted-foreground break-all">{candidate.url}</span>
              {candidate.location && <span className="mt-1 block text-xs text-muted-foreground">{candidate.location}</span>}
              {candidate.evidence && <span className="mt-1 block text-xs text-muted-foreground">{candidate.evidence}</span>}
            </button>)}
          </div>}
        </div>}
      </div>}
    </div>
    <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</Button>
  </section>;
}

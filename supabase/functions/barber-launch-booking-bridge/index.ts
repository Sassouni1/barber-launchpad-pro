import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

function publicWebsite(value: string) {
  if (!value) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
        !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':') ||
        /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)) return null;
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}

type BookingCandidate = { url: string; title: string; evidence: string; businessName: string; location: string; confidence: 'confirmed' | 'possible' };
const bookingHost = /(^|\.)(booksy\.com|vagaro\.com|styleseat\.com|fresha\.com|glossgenius\.com|getsquire\.com|squire\.com|thecut\.co|square\.site|squareup\.com|calendly\.com|acuityscheduling\.com|schedulicity\.com|setmore\.com)$/i;
const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
function bookingUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    if (url.username || url.password || url.port || !bookingHost.test(url.hostname)) return '';
    url.hash = '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}
function bookingIdentity(value: string) {
  const parsed = new URL(value);
  const booksy = /(^|\.)booksy\.com$/i.test(parsed.hostname) && parsed.pathname.match(/^\/en-us\/(\d+)_/i);
  return booksy ? `booksy:${booksy[1]}` : `${parsed.origin}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
}
function domainBusinessName(website: string) {
  if (!website) return '';
  const labels = new URL(website).hostname.replace(/^www\./i, '').split('.');
  return labels[0].replace(/[-_]+/g, ' ').trim().slice(0, 100);
}
async function fuzzyBookingMatches(name: string, businessName: string, city: string, website: string): Promise<BookingCandidate[]> {
  const key = Deno.env.get('SERPER_API_KEY');
  if (!key) return [];
  const domainName = domainBusinessName(website);
  const business = businessName || domainName;
  const queries = [
    `"${name}" barber booking`,
    `site:booksy.com "${name}"`,
    ...[businessName, domainName].filter((value, index, values) => value && values.indexOf(value) === index)
      .map(value => `"${value}" ${city} booking`),
  ];
  const searches = await Promise.allSettled(queries.map(async query => {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'us', hl: 'en', num: 10 }),
    });
    if (!response.ok) throw new Error(`Search HTTP ${response.status}`);
    return (await response.json() as { organic?: Array<{ title?: string; link?: string; snippet?: string }> }).organic || [];
  }));
  console.info('barber-launch fuzzy searches', JSON.stringify({
    queryCount: queries.length,
    results: searches.map((search, index) => ({ index, count: search.status === 'fulfilled' ? search.value.length : -1,
      error: search.status === 'rejected' ? String(search.reason).slice(0, 160) : '' })),
  }));
  const identityKeys = [name, businessName, domainName].map(compact).filter(value => value.length >= 4);
  const found = new Map<string, BookingCandidate>();
  for (const [searchIndex, search] of searches.entries()) {
    if (search.status !== 'fulfilled') continue;
    for (const hit of search.value) {
      const url = bookingUrl(hit.link || '');
      if (!url) continue;
      const parsed = new URL(url);
      const isBooksy = /(^|\.)booksy\.com$/i.test(parsed.hostname);
      const isBooksyProfile = isBooksy && /\/en-us\/\d+_/i.test(parsed.pathname);
      if (isBooksy && !isBooksyProfile) continue;
      const identityKey = compact(`${hit.title || ''} ${url}`);
      const exactNameBookingSearch = searchIndex === 1 && isBooksyProfile;
      if (!identityKeys.some(value => identityKey.includes(value)) && !exactNameBookingSearch) continue;
      found.set(url, { url, title: (hit.title || new URL(url).hostname).slice(0, 180),
        evidence: (hit.snippet || 'Possible name or business match. Check the location before choosing.').slice(0, 500),
        businessName: business, location: '', confidence: 'possible' });
    }
  }
  return [...found.values()].slice(0, 16);
}
async function websiteBookingMatches(website: string): Promise<BookingCandidate[]> {
  if (!website) return [];
  const found = new Map<string, BookingCandidate>();
  const visited = new Set<string>();
  const pages = [website];
  for (let index = 0; index < pages.length && index < 2; index++) {
    const page = pages[index];
    if (visited.has(page)) continue;
    visited.add(page);
    try {
      const response = await fetch(page, { signal: AbortSignal.timeout(6500), redirect: 'follow', headers: { 'User-Agent': 'BarberLaunchBookingLookup/1.0' } });
      if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) continue;
      const html = (await response.text()).slice(0, 500000);
      for (const match of html.matchAll(/<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const href = match[1].replace(/&amp;/gi, '&');
        const label = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        let resolved: URL;
        try { resolved = new URL(href, response.url); } catch { continue; }
        const booking = bookingUrl(resolved.href);
        if (booking) found.set(booking, { url: booking, title: label && !/^book(?: now)?$/i.test(label) ? label.slice(0, 180) : `Book on ${resolved.hostname}`,
          evidence: `Linked from ${new URL(page).hostname}${index ? ' locations page' : ''}. Check which location and barber this page books.`,
          businessName: domainBusinessName(website), location: '', confidence: 'possible' });
        else if (index === 0 && resolved.origin === new URL(website).origin && /location|book/i.test(`${resolved.pathname} ${label}`) && pages.length < 2)
          pages.push(resolved.href);
      }
    } catch { /* A member website may be unavailable; search results can still be shown. */ }
  }
  return [...found.values()].slice(0, 12);
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return json({ error: 'Please sign in.' }, 401);
    const barberUrl = Deno.env.get('BARBER_LAUNCH_SUPABASE_URL');
    const barberKey = Deno.env.get('BARBER_LAUNCH_ANON_KEY');
    const secret = Deno.env.get('BARBER_LAUNCH_RESEARCH_SECRET');
    const vlixUrl = Deno.env.get('SUPABASE_URL');
    if (!barberUrl || !barberKey || !secret || !vlixUrl) return json({ error: 'Booking research is not configured.' }, 503);
    const db = createClient(barberUrl, barberKey, {
      auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: auth, error: authError } = await db.auth.getUser(token);
    if (authError || !auth.user) return json({ error: 'Please sign in again.' }, 401);
    const raw = await request.text();
    if (raw.length > 3000) return json({ error: 'Request too large.' }, 413);
    const input = JSON.parse(raw) as Record<string, unknown>;
    const city = typeof input.city === 'string' ? input.city.trim() : '';
    const websiteText = typeof input.website === 'string' ? input.website.trim() : '';
    const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
    const currentBusinessName = typeof input.businessName === 'string' ? input.businessName.trim() : null;
    const scope = input.scope === 'shop' ? 'shop' : 'individual';
    const website = publicWebsite(websiteText);
    if (!city || city.length > 160 || websiteText.length > 1000 || website === null || platform.length > 80 ||
        (currentBusinessName !== null && currentBusinessName.length > 160))
      return json({ error: 'Enter a valid city, website, and booking app.' }, 400);
    const [{ data: profile, error: profileError }, { data: onboarding, error: onboardingError }] = await Promise.all([
      db.from('profiles').select('full_name').eq('id', auth.user.id).maybeSingle(),
      db.from('member_onboarding_profiles').select('business_name').eq('user_id', auth.user.id).maybeSingle(),
    ]);
    if (profileError || onboardingError) return json({ error: 'Could not read your member profile.' }, 502);
    const name = String(profile?.full_name || auth.user.user_metadata?.full_name || '').trim().slice(0, 160);
    const businessName = currentBusinessName ?? String(onboarding?.business_name || '').trim().slice(0, 160);
    if (!name && !businessName) return json({ error: 'Add your name to your profile before searching.' }, 400);
    const supplement = Promise.allSettled([fuzzyBookingMatches(name || businessName, businessName, city, website || ''), websiteBookingMatches(website || '')]);
    const body = JSON.stringify({
      action: 'barber_booking', memberId: auth.user.id, name: name || businessName,
      businessName, city, website, bookingPlatform: /^(other|not sure|other \/ not sure)$/i.test(platform) ? '' : platform, scope,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
    const signature = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const response = await fetch(`${vlixUrl}/functions/v1/profile-research`, {
      method: 'POST', signal: AbortSignal.timeout(125000),
      headers: { 'Content-Type': 'application/json', 'x-barber-launch-timestamp': timestamp,
        'x-barber-launch-signature': signature },
      body,
    });
    const result = await response.json();
    if (!response.ok) return json({ error: result?.error || 'Booking research could not finish.' }, response.status);
    const extra = await supplement;
    const candidates = new Map<string, BookingCandidate>();
    const identityNames = [name, businessName, domainBusinessName(website || '')]
      .map(compact).filter(value => value.length >= 4);
    if (Array.isArray(result?.candidates)) for (const candidate of result.candidates as Array<Record<string, unknown>>) {
      const url = bookingUrl(String(candidate.url || ''));
      if (url && identityNames.some(value => compact(`${candidate.title || ''} ${url}`).includes(value))) candidates.set(bookingIdentity(url), { url, title: String(candidate.title || ''), evidence: String(candidate.description || ''),
        businessName: String(candidate.businessName || ''), location: String(candidate.location || ''), confidence: 'confirmed' });
    }
    for (const item of extra) if (item.status === 'fulfilled') for (const candidate of item.value) {
      const identity = bookingIdentity(candidate.url);
      if (!candidates.has(identity)) candidates.set(identity, candidate);
    }
    return json({
      candidates: [...candidates.values()].slice(0, 20),
      warning: result?.warning || '', runId: result?.runId,
    });
  } catch {
    return json({ error: 'Booking research could not finish. Please try again.' }, 502);
  }
});

// Copied unchanged from Vlix Booking (vlix-cert-release) so Barber Launch reads booking-page prices the same way Vlix onboarding does. Only import paths differ.
import { parseServicePrice, type ServicePrice } from './service-price.ts';
export type SourceKind = 'instagram' | 'facebook' | 'tiktok' | 'booking' | 'website';
export type Candidate = { url: string; title: string; description: string; kind: SourceKind; supplied: boolean; confidence?: 'confirmed' | 'potential'; businessName?: string; location?: string; avatar?: string | null };
export type ServiceVersion = ServicePrice & { description: string; duration: string; source: string; sources?: string[] };
export type ImportedService = ServiceVersion & { name: string; versions?: ServiceVersion[] };
export type ImportedPage = { servicesChecked?:boolean; serviceWarning?:string; source: string; title: string; bio: string; bioKind?: 'personal' | 'business' | 'unknown'; address?: string; avatar: string | null; photos: string[]; services: ImportedService[]; links: Candidate[]; warning?: string; instagramPhotos?: {photoPolicyVersion?:number;status:'pending'|'ready'; job?:string; continuation?:string; postLimit:number; importedAt?:number; hasMore?:boolean; warning?:string; coverage?:'complete'|'partial'|'unknown'; postsScanned?:number; totalPosts?:number; videoPosts?:number} };
export type DiscoveryInput = { depth?: 'quick' | 'deep'; scope?: 'shop' | 'individual'; ownerName?: string; nickname?: string; website?: string; name: string; city: string; instagram: string; facebook: string; tiktok: string; booking: string; bookingPlatform?: string; knownLinks?: Candidate[]; searchMissing: boolean; excluded: SourceKind[] };
export type DiscoveryResult = { candidates: Candidate[]; warning?: string };
export function publicUrl(value: string): string {
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  const h = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80','443'].includes(url.port)) || !h.includes('.') || /^[\d.]+$/.test(h) || h.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(h) || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('Use a public website link.');
  url.hash = ''; return url.href;
}
export function kindOf(url: string): SourceKind {
  const h = new URL(url).hostname.replace(/^www\./, '');
  if (h === 'instagram.com') return 'instagram';
  if (h === 'facebook.com' || h === 'm.facebook.com' || h === 'fb.com') return 'facebook';
  if (h === 'tiktok.com' || h === 'vm.tiktok.com') return 'tiktok';
  return /(^|\.)(booksy.com|getsquire.com|squire.com|vagaro.com|glossgenius.com|square.site|squareup.com|fresha.com|acuityscheduling.com|schedulicity.com|styleseat.com|setmore.com|calendly.com)$/.test(h) ? 'booking' : 'website';
}
export function suppliedCandidates(input: DiscoveryInput): Candidate[] {
  return (['booking','instagram','facebook','tiktok','website'] as const).flatMap(kind => {
    let value = (input[kind] || '').trim(); if (!value) return [];
    if (kind === 'instagram' && !value.includes('/')) value = `https://www.instagram.com/${value.replace(/^@/, '')}/`;
    if (kind === 'tiktok' && !value.includes('/')) value = `https://www.tiktok.com/@${value.replace(/^@/, '')}`;
    const url = publicUrl(value);
    if (kind === 'instagram' && kindOf(url) !== 'instagram') throw new Error('Use an Instagram username or profile link.');
    if (kind === 'facebook' && kindOf(url) !== 'facebook') throw new Error('Use a Facebook page link.');
    if (kind === 'tiktok' && kindOf(url) !== 'tiktok') throw new Error('Use a TikTok username or profile link.');
    return [{ url, title: new URL(url).hostname, description: 'Link you provided', kind, supplied: true }];
  });
}
export function uniqueCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  const identity=(value:string)=>{
    const parsed=new URL(value);
    parsed.hash='';
    for(const key of [...parsed.searchParams.keys()])if(/^(utm_.+|fbclid|gclid|igsh|igshid|_r|_t)$/i.test(key))parsed.searchParams.delete(key);
    parsed.searchParams.sort();
    const host=parsed.hostname.replace(/^www\./,'').toLowerCase();
    const booksyId=host==='booksy.com'&&parsed.pathname.match(/^\/[a-z]{2}(?:-[a-z]{2})?\/(\d+)_/i)?.[1];
    return booksyId?`booksy:${booksyId}`:`${host}${parsed.pathname.replace(/\/$/,'').toLowerCase()}?${parsed.searchParams}`;
  };
  const kept = new Map<string,Candidate>();
  for (const candidate of candidates) {
    const key = identity(candidate.url), previous = kept.get(key);
    if (!previous || (previous.confidence === 'potential' && candidate.confidence === 'confirmed')) kept.set(key,candidate);
  }
  return [...kept.values()].slice(0,40);
}
const clean = (v: unknown, max = 1000) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim().slice(0,max) : '';
function duration(v: unknown) { const m = String(v ?? '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/); const n = m ? Number(m[1] || 0)*60+Number(m[2] || 0) : 0; return n > 0 && n <= 1440 ? String(n) : ''; }
export function extractPage(raw: Record<string, unknown>, source: string): ImportedPage {
  const services: ImportedService[] = [];
  const seen = new Set<string>();
  function walk(node: unknown, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 15) return;
    if (Array.isArray(node)) { node.slice(0,200).forEach(n => walk(n,depth+1)); return; }
    const n = node as Record<string, unknown>;
    const type = String(n['@type'] || '');
    if (/^(Service|Offer|Product)$/.test(type)) {
      const item = (n.itemOffered && typeof n.itemOffered === 'object' ? n.itemOffered : n) as Record<string, unknown>;
      const name = clean(item.name,120); const key = name.toLowerCase();
      const offer = (Array.isArray(n.offers) ? n.offers[0] : n.offers || n) as Record<string, unknown>;
      if (name && !seen.has(key)) {
        seen.add(key); services.push({ name, description: clean(item.description,2000), ...(!offer.priceCurrency || offer.priceCurrency === 'USD' ? parseServicePrice(offer.price) : {price:'',priceKind:'unknown' as const}), duration: duration(item.duration || item.timeRequired), source });
      }
    }
    Object.values(n).forEach(v => walk(v,depth+1));
  }
  walk(raw.structured);
  if (Array.isArray(raw.serviceCards)) for (const card of raw.serviceCards.slice(0,100)) {
    if (!card || typeof card !== 'object') continue;
    const c=card as Record<string,unknown>; const name=clean(c.name,120); const text=clean(c.text,2000);
    if (!name) continue;
    const price=text.match(/(?:(?:from|starting(?: at)?|starts? at)\s*)?(?:USD\s*|\$)\s*\d[\d,.]*(?:\s*(?:[-–—]|to)\s*\$?\s*\d[\d,.]*|\s*(?:\+|and up))?/i);
    const hours=text.match(/(\d+)\s*(?:hours?|hrs?)\b/i); const mins=text.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
    const minutes=Number(hours?.[1]||0)*60+Number(mins?.[1]||0);
    if(!c.price && !price && !minutes) continue;
    const parsed=parseServicePrice(c.price || price?.[0] || '');
    const existing=services.find(service=>service.name.toLowerCase()===name.toLowerCase());
    if(existing){ if(c.price || price) Object.assign(existing,parsed); if(minutes>0&&minutes<=1440)existing.duration=String(minutes); continue; }
    seen.add(name.toLowerCase()); services.push({name,description:clean(c.description,2000),...parsed,duration:minutes>0&&minutes<=1440?String(minutes):'',source});
  }
  const safeImage = (v: unknown) => { try { return typeof v === 'string' ? publicUrl(v) : null; } catch { return null; } };
  const photos = [...new Set((Array.isArray(raw.images) ? raw.images : []).map(safeImage).filter((x): x is string => !!x))].slice(0,50);
  const links = uniqueCandidates((Array.isArray(raw.links) ? raw.links : []).flatMap(v => { try { const url = publicUrl(String(v)); const kind = kindOf(url); return kind !== 'website' ? [{url,kind,title:new URL(url).hostname,description:'Linked from this page',supplied:false}] : []; } catch { return []; } }));
  return { source, title: clean(raw.title,200), bio: clean(raw.description,1000), bioKind: raw.bioKind === 'personal' || raw.bioKind === 'business' ? raw.bioKind : 'unknown', avatar: safeImage(raw.avatar), photos, services: services.slice(0,60), links, warning: services.length ? undefined : 'No structured services found on this page. You can add services manually.' };
}

export function groupCandidates(candidates:Candidate[]){
  const rawGroups=Object.values(candidates.reduce<Record<string,{name:string;location:string;pages:Candidate[]}>>((acc,c)=>{
    const name=c.businessName||c.title;const location=c.location||'';const key=`${name.toLowerCase()}|${location.toLowerCase()}`;
    (acc[key]??={name,location,pages:[]}).pages.push(c);return acc;
  },{}));
  // A brand can link to several branches. An unverified/shared location must
  // remain separate rather than silently becoming a specific branch's page.
  return rawGroups;
}

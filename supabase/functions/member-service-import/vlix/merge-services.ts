// Copied unchanged from Vlix Booking (vlix-cert-release) so Barber Launch reads booking-page prices the same way Vlix onboarding does. Only import paths differ.
import type { ImportedService, ServiceVersion } from './model.ts';

// Cosmetic spelling differences only; keep kids/adult, beard and package distinctions.
export const serviceIdentity = (name: string) => name.normalize('NFKC').toLowerCase()
  .replace(/\bhair[\s-]+cut(s?)\b/g, 'haircut$1').replace(/&/g, ' and ')
  .replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const priceKey = (value: ServiceVersion) => JSON.stringify([
  value.price ? Number(value.price) : '', value.priceKind || (value.price ? 'fixed' : 'unknown'),
  value.priceMax ? Number(value.priceMax) : '', value.price ? '' : value.priceLabel || '',
]);
export function serviceVersionKey(value: ServiceVersion) { return `${priceKey(value)}:${value.duration}`; }
export function mergeImportedServices(services: ImportedService[]): ImportedService[] {
  const groups = new Map<string, ImportedService[]>();
  for (const service of services) {
    const key=serviceIdentity(service.name); if (!key) continue;
    const group=groups.get(key)||[]; group.push(service); groups.set(key,group);
  }
  return [...groups.values()].map(group=>{
    const candidates=group.flatMap(service=>service.versions?.length?service.versions:[service]);
    const priced=candidates.filter(service=>(service.price !== '' && Number.isFinite(Number(service.price)))||/[€£¥$]|\b(?:USD|EUR|GBP|CAD|AUD)\b/.test(service.priceLabel||''));
    const choices=priced.length?priced:candidates;
    const versions:ServiceVersion[]=[];
    for(const candidate of choices){
      const match=versions.find(version=>priceKey(version)===priceKey(candidate)&&(!version.duration||!candidate.duration||version.duration===candidate.duration));
      const sources=[...new Set([candidate.source,...candidate.sources||[]])];
      if(match){match.sources=[...new Set([...match.sources||[match.source],...sources])];match.duration ||= candidate.duration;match.description ||= candidate.description;}
      else versions.push({price:candidate.price,priceKind:candidate.priceKind,priceMax:candidate.priceMax,priceLabel:candidate.priceLabel,source:candidate.source,sources,duration:candidate.duration,description:candidate.description});
    }
    const first=versions[0];
    return {...group[0],...first,name:group[0].name,versions:versions.length>1?versions:undefined};
  });
}

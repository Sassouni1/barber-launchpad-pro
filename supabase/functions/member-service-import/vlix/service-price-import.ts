// Copied unchanged from Vlix Booking (vlix-cert-release) so Barber Launch reads booking-page prices the same way Vlix onboarding does. Only import paths differ.
import { load } from 'npm:cheerio@1.0.0/slim';
import { publicUrl, kindOf, type ImportedService } from './model.ts';
import { parseServicePrice } from './service-price.ts';
import { mergeImportedServices, serviceIdentity } from './merge-services.ts';
const priceSelector = '[data-testid*="price"], [itemprop="price"], [class*="price"], [class*="Price"]';
const titleSelector = 'h2,h3,h4,h5,h6,[data-testid*="service-name"],[itemprop="name"],[class*="service-name"],[class*="service-title"]';
const amountPattern=/(?:(?:from|starting(?:\s+at)?|starts?\s+at)\s*)?(?:USD\s*|\$)\s*\d[\d,]*(?:\.\d{1,2})?(?:\s*(?:[-–—]|to)\s*(?:\$|USD\s*)?\d[\d,]*(?:\.\d{1,2})?|\s*(?:\+|and up))?/gi;
const tidy=(text:string)=>text.replace(/\s+/g,' ').trim();
function minutes(text:string){
 const iso=text.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i);
 const hours=text.match(/\b(\d+)\s*(?:h|hr|hrs|hour|hours)\b/i),mins=text.match(/\b(\d+)\s*(?:m|min|mins|minutes?)\b/i);
 const count=iso?Number(iso[1]||0)*60+Number(iso[2]||0):Number(hours?.[1]||0)*60+Number(mins?.[1]||0);
 return count>0&&count<=1440?String(count):'';
}
function cleanName(text:string){return tidy(text).replace(/[\s.·:–—-]+$/,'').slice(0,120);}
function meaningfulName(text:string){return text.length>=2&&text.length<=120&&/[a-z]/i.test(text)&&! /^(?:services?|our services|other services|prices?|pricing|menu|book now|book|total|subtotal|deposit|add ons?|extras?|popular services)$/i.test(text)&&! /\b(?:extra|add.on|deposit|gift card|tip|discount|cancellation)\b/i.test(text);}

/** Extract menu evidence even when the research model missed every service. */
export function extractServiceMenu(html:string,source:string,known:ImportedService[]=[]):ImportedService[]{
 const $=load(html), structured:ImportedService[]=[];
 function walk(node:unknown,depth=0){
  if(!node||typeof node!=='object'||depth>18)return;
  if(Array.isArray(node)){node.slice(0,300).forEach(value=>walk(value,depth+1));return;}
  const n=node as Record<string,any>,type=String(n['@type']||'');
  if(/^(Service|Offer)$/.test(type)){
   const item=n.itemOffered||n,name=cleanName(String(item.name||n.name||''));
   if(meaningfulName(name)){
    const offers=Array.isArray(n.offers)?n.offers:[n.offers||n];
    for(const offer of offers){const currency=String(offer.priceCurrency||'USD');const raw=offer.price??offer.priceSpecification?.price??'';
     structured.push({name,description:tidy(String(item.description||'')).slice(0,2000),duration:minutes(String(item.duration||item.timeRequired||'')),source,...parseServicePrice(currency==='USD'?raw:`${currency} ${raw}`)});
    }
   }
  }
  Object.values(n).forEach(value=>walk(value,depth+1));
 }
 $('script[type="application/ld+json"]').each((_,node)=>{try{walk(JSON.parse($(node).text()));}catch{/* Invalid metadata is not service evidence. */}});
 $('script,style,noscript,template,nav,footer,del,s').remove();
 // Exclude directory recommendations and unrelated recently viewed businesses.
 $('[id*="recommend"],[class*="recommend"],[data-testid*="recommend"],[id*="recently"],[class*="recently"],[data-testid*="recently"]').remove();
 const knownNames=new Set([...known,...structured].map(service=>serviceIdentity(service.name)));
 const visible:ImportedService[]=[];
 const allTitles=$(titleSelector).toArray();
 const scoped=(node:any)=>{
  if($(node).closest('[id*="service"],[class*="service"],[id*="menu"],[class*="menu"],[id*="pricing"],[class*="pricing"],[itemtype*="Service"]').length)return true;
  const section=$(node).closest('section,main');
  return section.children('h1,h2,h3').toArray().some(heading=>/^(?:our\s+)?(?:services?|service menu|pricing|prices?|menu|treatments?)$/i.test(tidy($(heading).text())));
 };
 function record(name:string,container:any,explicit=false){
  name=cleanName(name);if(!meaningfulName(name))return;
  const text=tidy(container.text());if(text.length>5000)return;
  const priceNodes=container.find(priceSelector).toArray().filter((node:any)=>!$(node).find(priceSelector).length);
  const tagged=priceNodes.map((node:any)=>tidy($(node).attr('content')||$(node).text())).filter(Boolean);
  const tokens=[...text.matchAll(amountPattern)].map(match=>match[0]);
  // Without a price field, accept only one amount; descriptions may list optional add-ons.
  const prices=tagged.length?[...new Set(tagged)]:tokens.length===1&&!/\b(extra|add.on|deposit|tip)\b/i.test(text)?tokens:[];
  if(!explicit&&!prices.length)return;
  const durationText=container.find('[data-testid*="duration"],[itemprop="duration"],[class*="duration"]').first().text();
  const duration=minutes(tidy(durationText)||text);
  for(const price of prices.length?prices:['']){
   const field=priceNodes.find((node:any)=>tidy($(node).attr('content')||$(node).text())===price);
   const variant=field?$(field).closest('[data-testid="service-variant"],[class*="variant"],[itemprop="offers"]'):null;
   const variantDuration=variant?.length?minutes(tidy(variant.text())):'';
   visible.push({name,description:'',duration:variantDuration||duration,source,...parseServicePrice(price)});
  }
 }
 for(const title of allTitles){
  const name=tidy($(title).text());if(!meaningfulName(name))continue;
  const explicit=knownNames.has(serviceIdentity(name))||scoped(title)||!!$(title).attr('data-testid')?.includes('service-name');
  let container=$(title).parent();
  for(let depth=0;depth<5&&container.length;depth++,container=container.parent()){
   const otherTitles=container.find(titleSelector).toArray().filter(node=>node!==title&&meaningfulName(tidy($(node).text()))&&serviceIdentity($(node).text())!==serviceIdentity(name));
   if(otherTitles.length)break;
   const before=visible.length;record(name,container,false);
   if(visible.length>before)break;
   if(explicit&&depth===0)record(name,container,true);
  }
 }
 // Tables, unstyled lists and short inline menu rows need no special CSS classes.
 $('tr,li,p').each((_,node)=>{
  const row=$(node);if(row.find(titleSelector).length)return;
  const cells=row.children('td,th');const text=tidy(row.text());if(text.length>300)return;
  const tokens=[...text.matchAll(amountPattern)];
  if(cells.length>=2){const name=tidy(cells.first().text());record(name,row,scoped(node));return;}
  if(tokens.length===1&&tokens[0].index!>0){const name=cleanName(text.slice(0,tokens[0].index));record(name,row,true);}
  else if(!tokens.length&&scoped(node)&&row.is('li'))record(text,row,true);
 });
 // Displayed qualifiers override less detailed JSON-LD for the same menu item.
 const visibleNames=new Set(visible.filter(service=>service.price||service.priceLabel).map(service=>serviceIdentity(service.name)));
 const recovered=mergeImportedServices([...visible,...structured.filter(service=>!visibleNames.has(serviceIdentity(service.name)))]);
 const recoveredNames=new Set(recovered.map(service=>serviceIdentity(service.name)));
 return mergeImportedServices([...recovered.map(service=>{
  const prior=known.find(item=>serviceIdentity(item.name)===serviceIdentity(service.name));
  // A missing displayed amount must not erase a previously verified price.
  if(!service.price&&!service.priceLabel&&!service.versions?.length&&prior?.price)return prior;
  return {...service,description:service.description||prior?.description||'',duration:service.duration||prior?.duration||''};
 }),...known.filter(service=>!recoveredNames.has(serviceIdentity(service.name)))]).slice(0,60);
}
export function readServicePrices(html:string,services:ImportedService[]):ImportedService[]{
 const source=services[0]?.source||'https://example.com';
 const extracted=extractServiceMenu(html,source,services);
 return services.map(service=>extracted.find(item=>serviceIdentity(item.name)===serviceIdentity(service.name))||service);
}
export function serviceMenuLinks(html:string,source:string):string[]{
 const $=load(html),base=new URL(source),links:string[]=[];
 $('nav,footer,[id*=recommend],[class*=recommend],[data-testid*=recommend]').remove();
 $('a[href]').each((_,node)=>{try{const target=new URL($(node).attr('href')!,base);target.hash='';
  if(kindOf(source)==='booking'&&!target.pathname.startsWith(base.pathname.replace(/\/$/,'')+'/'))return;
  if(target.origin!==base.origin||target.href===base.href||! /\b(services?|pricing|prices?|menu|treatments?)\b/i.test(`${$(node).text()} ${target.pathname}`))return;
  links.push(publicUrl(target.href));
 }catch{/* Non-public and malformed links are ignored. */}});
 return [...new Set(links)].slice(0,3);
}
async function readHtml(source: string) {
  let target = publicUrl(source);
  const signal = AbortSignal.timeout(10000);
  for (let redirects = 0; redirects < 5; redirects++) {
    const response = await fetch(target, { redirect: 'manual', signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VlixProfileImport/1.0)' } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location) throw new Error('Missing redirect');
      target = publicUrl(new URL(location, target).href); continue;
    }
    if (!response.ok || !/text\/html|application\/xhtml/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); throw new Error('Service page unavailable'); }
    const reader = response.body?.getReader(); if (!reader) throw new Error('Empty page');
    const decoder = new TextDecoder(); let html = '', size = 0;
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 2000000) { await reader.cancel(); break; } html += decoder.decode(chunk.value, { stream: true }); }
    return html + decoder.decode();
  }
  throw new Error('Too many redirects');
}
export async function enrichServicePrices(services: ImportedService[], selectedSources: string[] = [], audit?: {checked:string[];failed:string[]}) {
  const flattened=services.flatMap(service=>service.versions?.length?service.versions.map(version=>({...version,name:service.name})): [service]);
  const sources=[...new Set(selectedSources.length?selectedSources:flattened.flatMap(service=>[service.source,...service.sources||[]]))].slice(0,12);
  const pages=await Promise.all(sources.map(async source=>{
    const original=flattened.filter(service=>meaningfulName(service.name)&&(service.source===source||service.sources?.includes(source)));
    try{
      const html=await readHtml(source);audit?.checked.push(source);
      const extracted=extractServiceMenu(html,source,original);
      // Second pass checks direct menu links even when the homepage contains no menu.
      const linked=await Promise.all(serviceMenuLinks(html,source).filter(link=>!sources.includes(link)).map(async link=>{
        try{const html=await readHtml(link);audit?.checked.push(link);return extractServiceMenu(html,link);}catch{audit?.failed.push(link);return [];}
      }));
      return [...extracted,...linked.flat()];
    }catch{audit?.failed.push(source);return original;}
  }));
  return mergeImportedServices(pages.flat()).slice(0,60);
}
// refreshServicePrices (Vlix sign-in check) is not needed here; the Barber Launch function checks its own member.

export type GuidedTemplate = 'guided-charlotte' | 'guided-kait';

export type GuidedWebsiteAnswers = {
  template: GuidedTemplate;
  businessName: string;
  ownerName: string;
  city: string;
  phone: string;
  hasBookingApp: boolean | null;
  bookingUrl: string;
  hours: string;
  hasInstagram: boolean | null;
  instagram: string;
  photoSourceUrl: string;
  services: string;
  photos: string[];
};

export const emptyGuidedAnswers: GuidedWebsiteAnswers = {
  template: 'guided-charlotte', businessName: '', ownerName: '', city: '', phone: '',
  hasBookingApp: null, bookingUrl: '', hours: '', hasInstagram: null, instagram: '', photoSourceUrl: '',
  services: 'Haircuts\nHair systems', photos: [],
};

export const guidedTemplates = [
  { key: 'guided-charlotte' as const, name: 'Template 1', example: 'Your Business Name', url: '/website-previews/template-1/index.html', description: 'Warm, editorial, and focused on your story.' },
  { key: 'guided-kait' as const, name: 'Template 2', example: 'The Men’s Grooming Suite', url: 'https://themensgroomingsuite.com/', description: 'Bold, dark, and focused on your services and work.' },
];

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function normalizedWebUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return ['https:', 'http:'].includes(url.protocol) && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

export function instagramUrl(value: string): string | null {
  const handle = value.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[a-zA-Z0-9._]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

export function guidedWebsitePages(answers: GuidedWebsiteAnswers, siteSlug: string): Record<string, string> {
  const name = escape(answers.businessName.trim());
  const owner = escape(answers.ownerName.trim());
  const city = escape(answers.city.trim());
  const phone = escape(answers.phone.trim());
  const phoneHref = `tel:${answers.phone.replace(/[^+\d]/g, '')}`;
  const booking = answers.hasBookingApp ? normalizedWebUrl(answers.bookingUrl) : null;
  const instagram = instagramUrl(answers.instagram);
  const ctaHref = booking ?? phoneHref;
  const ctaText = booking ? 'Book a consultation' : 'Call about a consultation';
  const services = answers.services.split(/\n|,/).map(s => s.trim()).filter(Boolean).slice(0, 12);
  const photoUrls = answers.photos.filter(url => /^https:\/\//i.test(url)).slice(0, 6);
  const light = answers.template === 'guided-charlotte';
  const siteRoot = `/${encodeURIComponent(siteSlug)}/`;
  const hairPath = `${siteRoot}hair-loss-solutions/`;
  const css = `:root{font-family:Arial,sans-serif;color:${light ? '#241f1a' : '#f8f4e9'};background:${light ? '#e9dfcf' : '#101111'}}*{box-sizing:border-box}body{margin:0}a{color:inherit}header{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:24px max(5vw,20px);background:${light ? '#f5eee4' : '#0c0d0d'};border-bottom:1px solid ${light ? '#c8b79e' : '#675329'}}header strong{font-family:Georgia,serif;font-size:20px}nav{display:flex;gap:20px;flex-wrap:wrap;font-size:14px}nav a{text-decoration:none}.hero{min-height:520px;padding:110px max(5vw,20px) 85px;background:${light ? 'linear-gradient(120deg,#d8c0a4,#f1e8d9)' : 'linear-gradient(125deg,#171819,#3c3020)'};display:flex;align-items:center}.hero>div{max-width:850px}.eyebrow{color:${light ? '#795a3b' : '#d8a943'};letter-spacing:.24em;text-transform:uppercase;font-size:13px;font-weight:700}h1,h2{font-family:Georgia,serif;line-height:1.04}h1{font-size:clamp(48px,8vw,108px);margin:18px 0 24px}h2{font-size:clamp(36px,5vw,62px);margin:10px 0 24px}p{line-height:1.7}.lead{font-size:clamp(18px,2vw,23px);max-width:660px}.button{display:inline-block;padding:16px 24px;margin:16px 12px 0 0;background:${light ? '#30271f' : '#e8b13f'};color:${light ? '#fff' : '#111'};text-decoration:none;font-weight:700}.secondary{background:transparent;color:inherit;border:1px solid currentColor}.section{padding:78px max(5vw,20px)}.section.alt{background:${light ? '#f5eee4' : '#191a1a'}}.inner{max-width:1120px;margin:auto}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}.card{border:1px solid ${light ? '#c6b49b' : '#6a5935'};padding:28px;min-height:150px}.card h3{font-family:Georgia,serif;font-size:26px}.photos img{width:100%;height:280px;object-fit:cover}.placeholder{border:1px dashed currentColor;padding:45px;text-align:center;opacity:.6}footer{padding:38px max(5vw,20px);background:${light ? '#30271f' : '#090a0a'};color:#fff}footer .inner{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}${light ? '.hero{text-align:center;justify-content:center}.hero>div{max-width:780px}.section:not(.alt){background:#e9dfcf}.card{background:#eee2d1;border-radius:120px 120px 8px 8px;text-align:center;padding-top:52px}' : 'header strong{font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.16em}.hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(270px,.7fr);gap:5vw}.hero:after{content:"";display:block;min-height:420px;background:linear-gradient(150deg,#3b3020,#111 65%,#8d6c35);border:1px solid #8d6c35}.hero h1{text-transform:uppercase;font-family:Arial,sans-serif;font-weight:900;letter-spacing:-.05em}.section:not(.alt){background:#101111}.card{background:#222323;border-radius:3px;border-left:5px solid #d8a943}.card h3{font-family:Arial,sans-serif;text-transform:uppercase;font-size:21px;letter-spacing:.06em}' }@media(max-width:600px){header{align-items:flex-start;flex-direction:column}.hero{min-height:430px;padding-top:75px}.section{padding-top:55px;padding-bottom:55px}${light ? '' : '.hero{display:block}.hero:after{margin-top:36px;min-height:260px}'}}`;
  const head = (title: string) => `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${name} in ${city}. Explore haircuts and hair system consultations."><title>${escape(title)}</title><style>${css}</style>`;
  const header = `<header><strong>${name}</strong><nav><a href="${siteRoot}">Home</a><a href="${siteRoot}#services">Services</a><a href="${hairPath}">Hair Systems</a><a href="${siteRoot}#contact">Contact</a></nav></header>`;
  const footer = `<footer><div class="inner"><strong>${name}</strong><span>${city}</span>${phone ? `<a href="${escape(phoneHref)}">${phone}</a>` : ''}</div></footer>`;
  const photoSection = `<section class="section alt" id="work"><div class="inner"><p class="eyebrow">Our work</p><h2>See the work</h2>${photoUrls.length ? `<div class="grid photos">${photoUrls.map((url, i) => `<img src="${escape(url)}" alt="Work photo ${i + 1} from ${name}" loading="lazy">`).join('')}</div>` : '<div class="placeholder">Add your own work photos in the builder.</div>'}${instagram ? `<a class="button secondary" href="${escape(instagram)}" target="_blank" rel="noopener noreferrer">View Instagram</a>` : ''}</div></section>`;
  const contact = `<section class="section" id="contact"><div class="inner"><p class="eyebrow">Get in touch</p><h2>Ready to talk?</h2><p>Ask about an appointment or a hair system consultation.</p>${phone ? `<p>Call ${phone}</p>` : ''}${!booking && answers.hours.trim() ? `<p><strong>Hours</strong><br>${escape(answers.hours.trim()).replace(/\n/g, '<br>')}</p>` : ''}<a class="button" href="${escape(ctaHref)}">${ctaText}</a></div></section>`;
  const home = `<!doctype html><html lang="en"><head>${head(`${answers.businessName} | ${answers.city}`)}</head><body>${header}<main><section class="hero"><div><p class="eyebrow">${city}</p><h1>${name}</h1><p class="lead">${owner ? `Meet ${owner}. ` : ''}Haircuts, grooming, and hair system consultations in ${city}.</p><a class="button" href="${escape(ctaHref)}">${ctaText}</a><a class="button secondary" href="${hairPath}">Explore hair systems</a></div></section><section class="section" id="services"><div class="inner"><p class="eyebrow">What we do</p><h2>Services</h2><div class="grid">${services.map(service => `<article class="card"><h3>${escape(service)}</h3></article>`).join('')}</div></div></section>${photoSection}${contact}</main>${footer}</body></html>`;
  const hair = `<!doctype html><html lang="en"><head>${head(`Hair Systems | ${answers.businessName}`)}</head><body>${header}<main><section class="hero"><div><p class="eyebrow">Hair loss solutions in ${city}</p><h1>Hair systems</h1><p class="lead">Explore a non surgical option for a fuller looking style. A consultation is the place to discuss your goals, maintenance, and whether a hair system may be right for you.</p><a class="button" href="${escape(ctaHref)}">${ctaText}</a></div></section>${photoSection}${contact}</main>${footer}</body></html>`;
  return { '/': home, '/hair-loss-solutions/': hair };
}

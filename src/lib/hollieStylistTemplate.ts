import { normalizedWebUrl, parseGuidedServices, type GuidedWebsiteAnswers } from './guidedWebsite';
import { template2ServiceContent } from './template2ServiceCatalog';
import { limitServiceDescription } from './serviceDescription';

const salonAddress = '4124 Colonel Glenn Hwy, Dayton, OH 45431';
const salonName = 'Tavernier’s Salon & Spa';
const facebookUrl = 'https://www.facebook.com/hollie.fuentes/photos';

const serviceContent: Record<string, { catalogName?: string; description?: string; image: string }> = {
  "men's cuts": { catalogName: 'mens cuts', image: 'mens-cuts.png' },
  'kids cuts': { image: 'kids-cuts.png' },
  beards: { image: 'beards.webp' },
  'facial waxing': { image: 'facial-waxing.jpg' },
  balayage: { image: 'balayage.jpg' },
  'hair color': { catalogName: 'color', image: 'color.png' },
  'partial highlights': {
    image: 'highlights.png',
    description: 'Add brightness around your face, part, and crown with highlights placed where they make the most impact. A partial service refreshes your look while keeping the rest of your color natural.',
  },
  "women's cuts": { catalogName: 'haircuts and trims', image: 'haircuts-and-trims.png' },
  'full highlights': {
    image: 'halos.webp',
    description: 'Bring dimension throughout your hair with highlights from crown to underneath. Choose a soft blend or brighter contrast, then finish with a tone that suits your cut and natural color.',
  },
  'deep conditioning & scalp treatments': {
    image: 'assets/hollie-scalp-treatment.png',
    description: 'Give your hair and scalp some focused care. Hollie can discuss conditioning and scalp treatment options for your needs, then help you choose the right next step.',
  },
  'corrective color': {
    image: 'assets/color.webp',
    description: 'Corrective color starts with a close look at your current shade, hair history, and desired result. Hollie can discuss a plan to even out tone or change unwanted color.',
  },
};

export function personalizedHollieStylistHtml(
  html: string,
  baseUrl: string,
  answers: GuidedWebsiteAnswers,
  page: 'home' | 'hair',
  siteRoot?: string,
  serviceDetails: Array<{ name: string; description?: string }> = [],
) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const name = answers.businessName.trim() || 'Hair By Hollie';
  const owner = answers.ownerName.trim() || 'Hollie Fuentes';
  const city = answers.city.trim() || 'Dayton, OH';
  const phone = answers.phone.trim();
  const digits = phone.replace(/\D/g, '');
  const displayPhone = digits.length === 11 && digits.startsWith('1')
    ? `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
    : digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone;
  const bookingUrl = answers.hasBookingApp ? normalizedWebUrl(answers.bookingUrl) : null;
  const bookingHref = bookingUrl || `tel:${digits}`;
  const hairHref = siteRoot ? `${siteRoot}hair-loss-solutions/` : '#';

  const setText = (selector: string, text: string) => {
    const node = doc.querySelector(selector);
    if (node) node.textContent = text;
  };
  doc.title = page === 'home' ? `${name} | ${city}` : `Hair Loss Solutions | ${name}`;
  doc.querySelector('meta[name="description"]')?.setAttribute('content',
    page === 'home' ? `${name} at ${salonName} in ${city}. Haircuts, color, highlights, balayage, and more.`
      : `Ask ${owner} about hair systems in ${city}.`);
  doc.querySelectorAll<HTMLLinkElement | HTMLImageElement>('link[href], img[src]').forEach(node => {
    const attr = node.hasAttribute('href') ? 'href' : 'src';
    const value = node.getAttribute(attr) || '';
    if (value && !/^(https?:|data:|#)/i.test(value)) node.setAttribute(attr, new URL(value, baseUrl).href);
  });
  doc.querySelectorAll<HTMLImageElement>('.brand-logo, footer img').forEach(img => {
    const isHeaderLogo = img.classList.contains('brand-logo');
    const wordmark = doc.createElement(isHeaderLogo ? 'a' : 'span');
    wordmark.className = 'hollie-wordmark';
    wordmark.textContent = name;
    if (isHeaderLogo) {
      (wordmark as HTMLAnchorElement).href = siteRoot || '#';
      if (!siteRoot) (wordmark as HTMLAnchorElement).dataset.guidedPage = '/';
      (wordmark as HTMLAnchorElement).setAttribute('aria-label', `${name} home`);
    }
    img.replaceWith(wordmark);
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="../hair-system-template/index.html"]').forEach(link => {
    link.href = hairHref;
    if (!siteRoot) link.dataset.guidedPage = '/hair-loss-solutions/';
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="index.html"]').forEach(link => {
    link.href = siteRoot || '#';
    if (!siteRoot) link.dataset.guidedPage = '/';
  });
  doc.querySelectorAll<HTMLAnchorElement>('a.gold-button').forEach(link => {
    if (/appointment|consultation/i.test(link.textContent || '')) {
      link.href = bookingHref;
      if (bookingUrl) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    }
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href^="tel:"]').forEach(link => {
    link.href = bookingHref;
    if (bookingUrl) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
  });
  setText('footer p', `${name} · ${city}`);
  const footer = doc.querySelector('footer');
  if (footer) {
    const social = doc.createElement('a');
    social.href = facebookUrl;
    social.textContent = 'Facebook';
    social.target = '_blank';
    social.rel = 'noopener noreferrer';
    footer.append(social);
  }

  if (page === 'home') {
    setText('.hero-script', name);
    setText('.hero h1', `THE GO-TO STYLIST IN ${city.toUpperCase()}`);
    setText('.hero .eyebrow', 'CUTS, COLOR & STYLE FOR EVERY AGE');
    setText('.philosophy-script', `The ${name} Philosophy`);
    const philosophy = doc.querySelector('.philosophy-copy');
    if (philosophy) {
      philosophy.replaceChildren();
      for (const copy of [
        `At ${name}, ${owner} offers haircuts, color, highlights, balayage, and personal care for men, women, and kids.`,
        `Visit her private suite at ${salonName} in ${city}. Call to discuss the right service and plan your appointment.`,
      ]) { const p = doc.createElement('p'); p.textContent = copy; philosophy.append(p); }
    }
    const cards = doc.querySelector('.cards');
    if (cards) {
      cards.replaceChildren();
      for (const service of parseGuidedServices(answers.services)) {
        const content = serviceContent[service.name.toLowerCase()];
        const savedDescription = serviceDetails.find(item => item.name.trim().toLowerCase() === service.name.toLowerCase())?.description;
        const article = doc.createElement('article');
        article.className = 'service-card';
        const image = doc.createElement('img');
        image.src = content?.image?.startsWith('assets/')
          ? new URL(content.image, baseUrl).href
          : new URL(`/website-previews/template-2/service-images/${content?.image || 'haircut.jpg'}`, baseUrl).href;
        image.alt = `Illustrative photo for ${service.name}`;
        const body = doc.createElement('div');
        const heading = doc.createElement('h3'); heading.textContent = service.name;
        const description = doc.createElement('p');
        description.textContent = limitServiceDescription(savedDescription)
          || content?.description
          || template2ServiceContent(content?.catalogName || service.name)?.description
          || `${service.name} tailored to your hair and goals. Call ${owner} to discuss the service.`;
        body.append(heading, description); article.append(image, body); cards.append(article);
      }
    }
    setText('.rates h2', 'SERVICES & PRICING');
    const ratesImage = doc.querySelector<HTMLImageElement>('.rates-grid > img');
    if (ratesImage) ratesImage.alt = 'Haircut examples';
    const prices = doc.querySelector('.price-list');
    if (prices) {
      prices.replaceChildren();
      for (const service of parseGuidedServices(answers.services)) {
        const row = doc.createElement('p');
        const label = doc.createElement('span'); label.textContent = service.name;
        const line = doc.createElement('i');
        const price = doc.createElement('b'); price.textContent = service.price || 'Call for pricing';
        row.append(label, line, price); prices.append(row);
      }
    }
    const meetImage = doc.querySelector<HTMLImageElement>('.meet-grid > img');
    if (meetImage) {
      meetImage.src = new URL('assets/hollie-cutting-hair-working.png', baseUrl).href;
      meetImage.alt = 'Illustrative image of Hollie cutting a client’s hair';
    }
    setText('.meet-copy h2', `MEET ${owner.toUpperCase()}`);
    const meetCopy = doc.querySelector('.meet-copy');
    if (meetCopy) {
      meetCopy.querySelectorAll('p').forEach(p => p.remove());
      const portrait = doc.createElement('img');
      portrait.className = 'hollie-headshot';
      portrait.src = new URL('assets/hollie-profile.jpg', baseUrl).href;
      portrait.alt = 'Hollie Fuentes';
      meetCopy.querySelector('h2')?.after(portrait);
      for (const copy of [
        `${owner} welcomes clients to her private suite at ${salonName} in ${city}.`,
        'She offers men’s and women’s cuts, color, highlights, balayage, beard services, kids cuts, facial waxing, and hair and scalp treatments.',
        'Call to ask about services or arrange an appointment.',
      ]) { const p = doc.createElement('p'); p.textContent = copy; meetCopy.append(p); }
    }
    const contact = doc.querySelector('.contact-grid > div');
    if (contact) {
      contact.replaceChildren();
      const h2 = doc.createElement('h2'); h2.textContent = 'Get In Touch';
      const addressHeading = doc.createElement('h3'); addressHeading.textContent = `At ${salonName}`;
      const address = doc.createElement('p'); address.textContent = salonAddress;
      const hoursHeading = doc.createElement('h3'); hoursHeading.textContent = 'Hours';
      const hours = doc.createElement('p'); hours.textContent = answers.hours.trim() || 'By appointment';
      const phoneHeading = doc.createElement('h3'); phoneHeading.textContent = 'Phone';
      const phoneLink = doc.createElement('a'); phoneLink.href = bookingHref; phoneLink.textContent = displayPhone;
      const phoneP = doc.createElement('p'); phoneP.append(phoneLink);
      contact.append(h2, addressHeading, address, hoursHeading, hours, phoneHeading, phoneP);
    }
    const oldMap = doc.querySelector('.contact-grid > img');
    if (oldMap) {
      const map = doc.createElement('div');
      map.className = 'hollie-map';
      const frame = doc.createElement('iframe');
      frame.src = `https://www.google.com/maps?q=${encodeURIComponent(salonAddress)}&output=embed`;
      frame.title = `Map to ${salonName}`;
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      const directions = doc.createElement('a');
      directions.className = 'hollie-directions';
      directions.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(salonAddress)}`;
      directions.textContent = `Get directions to ${salonName} ↗`;
      directions.target = '_blank'; directions.rel = 'noopener noreferrer';
      map.append(frame, directions);
      oldMap.replaceWith(map);
    }
  } else {
    const mobileHomeLink = doc.createElement('a');
    mobileHomeLink.className = 'hollie-home-link';
    mobileHomeLink.href = siteRoot || '#';
    if (!siteRoot) mobileHomeLink.dataset.guidedPage = '/';
    mobileHomeLink.textContent = '← Home';
    doc.querySelector('.site-header .nav-rail')?.append(mobileHomeLink);
    setText('.solution-hero h1', `HAIR LOSS SOLUTIONS IN ${city.toUpperCase()}`);
    setText('.solution-story-copy p:last-child', `Ask ${owner} about available options and next steps in a private conversation.`);
    setText('.solution-consultation-copy', `Call ${owner} to ask about hair systems and arrange a private consultation.`);
    const stylingImage = doc.querySelector<HTMLImageElement>('.solution-card:nth-child(2) img');
    if (stylingImage) {
      stylingImage.src = new URL('assets/hollie-styling-mens-hair.png', baseUrl).href;
      stylingImage.alt = 'Illustrative image of Hollie styling a man’s hair';
    }
  }
  const style = doc.createElement('style');
  style.textContent = `.hollie-wordmark{display:flex;align-items:center;color:#c4a56d;font:600 clamp(20px,2.5vw,34px)/1 Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase;max-width:320px;text-decoration:none}.site-header .hollie-wordmark{min-height:85px}footer .hollie-wordmark{min-height:50px}footer a{color:#fff}.hollie-home-link{display:none;color:#c4a56d;font:600 16px/1 Oswald,sans-serif;text-decoration:none;white-space:nowrap}.services{min-height:0}.service-head{background-color:#35302b;background-blend-mode:multiply}.rates{height:auto;min-height:913px}.rates-grid{height:auto;grid-template-columns:48% 52%;gap:20px}.price-list{padding:30px 25px 20px 0}.price-list p{font-size:clamp(15px,1.6vw,21px)}.price-list b{font-size:.8em;color:#b99b61}.rates-actions{padding:24px 0 40px}.meet{height:auto;min-height:660px}.meet-copy h2{margin-bottom:24px}.hollie-headshot{display:block;width:96px;height:96px;object-fit:cover;border-radius:50%;border:3px solid #b99b61;margin:0 0 24px}.contact{height:auto;min-height:440px}.contact a:not(.hollie-directions){color:#9c713b}.hollie-map{width:100%;min-height:340px;border:2px solid #be8c4d;background:#e8dfd1}.hollie-map iframe{display:block;width:100%;height:290px;border:0}.hollie-directions{display:block;padding:13px 16px;background:#e8dfd1;color:#171717;font:600 19px/1.2 Oswald,sans-serif;text-align:center;text-decoration:none}@media(max-width:900px){.rates-grid{grid-template-columns:1fr}.price-list{padding:0}.hollie-wordmark{max-width:220px}.site-header .hollie-wordmark{min-height:50px}.hollie-home-link{display:block}.contact-grid{grid-template-columns:1fr}.hero h1,.solution-hero h1{font-size:clamp(42px,11vw,57px)}}`;
  doc.head.append(style);
  if (!siteRoot) {
    const previewNavigation = doc.createElement('script');
    previewNavigation.textContent = `document.addEventListener('click',function(e){const a=e.target.closest('a[data-guided-page]');if(a){e.preventDefault();parent.postMessage({type:'guided-template-page',page:a.dataset.guidedPage},'*')}});`;
    doc.body.append(previewNavigation);
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

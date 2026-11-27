import { normalizedWebUrl, parseGuidedServices, type GuidedWebsiteAnswers } from './guidedWebsite';

const salonAddress = '4124 Colonel Glenn Hwy, Dayton, OH 45431';
const salonName = 'Tavernier’s Salon & Spa';
const facebookUrl = 'https://www.facebook.com/hollie.fuentes/photos';

function serviceImage(name: string) {
  if (/beard/i.test(name)) return 'shave.webp';
  if (/color|highlight|balayage/i.test(name)) return 'color.webp';
  if (/conditioning|scalp/i.test(name)) return 'halos.webp';
  if (/wax/i.test(name)) return 'shave.webp';
  return 'cut.webp';
}

export function personalizedHollieStylistHtml(
  html: string,
  baseUrl: string,
  answers: GuidedWebsiteAnswers,
  page: 'home' | 'hair',
  siteRoot?: string,
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
    const wordmark = doc.createElement('span');
    wordmark.className = 'hollie-wordmark';
    wordmark.textContent = name;
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
        const article = doc.createElement('article');
        article.className = 'service-card';
        const image = doc.createElement('img');
        image.src = new URL(`assets/${serviceImage(service.name)}`, baseUrl).href;
        image.alt = `${service.name} example`;
        const body = doc.createElement('div');
        const heading = doc.createElement('h3'); heading.textContent = service.name;
        const description = doc.createElement('p');
        description.textContent = `Ask ${owner} about ${service.name.toLowerCase()} and what to expect at your appointment.`;
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
      meetImage.src = new URL('assets/color.webp', baseUrl).href;
      meetImage.alt = 'Hair styling examples';
    }
    setText('.meet-copy h2', `MEET ${owner.toUpperCase()}`);
    const meetCopy = doc.querySelector('.meet-copy');
    if (meetCopy) {
      meetCopy.querySelectorAll('p').forEach(p => p.remove());
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
      const directions = doc.createElement('a');
      directions.className = 'hollie-directions';
      directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(salonAddress)}`;
      directions.textContent = `Get directions to ${salonName}`;
      directions.target = '_blank'; directions.rel = 'noopener noreferrer';
      oldMap.replaceWith(directions);
    }
  } else {
    setText('.solution-hero h1', `HAIR LOSS SOLUTIONS IN ${city.toUpperCase()}`);
    setText('.solution-story-copy p:last-child', `Ask ${owner} about available options and next steps in a private conversation.`);
    setText('.solution-consultation-copy', `Call ${owner} to ask about hair systems and arrange a private consultation.`);
  }
  const style = doc.createElement('style');
  style.textContent = `.hollie-wordmark{display:flex;align-items:center;color:#c4a56d;font:600 clamp(20px,2.5vw,34px)/1 Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase;max-width:320px}.site-header .hollie-wordmark{min-height:85px}footer .hollie-wordmark{min-height:50px}footer a{color:#fff}.services{min-height:0}.service-head{background-color:#35302b;background-blend-mode:multiply}.rates{height:auto;min-height:913px}.rates-grid{height:auto;grid-template-columns:48% 52%;gap:20px}.price-list{padding:30px 25px 20px 0}.price-list p{font-size:clamp(15px,1.6vw,21px)}.price-list b{font-size:.8em;color:#b99b61}.rates-actions{padding:24px 0 40px}.meet{height:auto;min-height:660px}.meet-copy h2{margin-bottom:30px}.contact{height:auto;min-height:440px}.contact a:not(.hollie-directions){color:#9c713b}.hollie-directions{display:flex;align-items:center;justify-content:center;min-height:300px;padding:40px;background:#e8dfd1;color:#171717;font:600 30px/1.2 Oswald,sans-serif;text-align:center;text-decoration:none;border:2px solid #be8c4d}@media(max-width:900px){.rates-grid{grid-template-columns:1fr}.price-list{padding:0}.hollie-wordmark{max-width:220px}.site-header .hollie-wordmark{min-height:50px}.contact-grid{grid-template-columns:1fr}.hollie-directions{min-height:220px}.hero h1,.solution-hero h1{font-size:clamp(42px,11vw,57px)}}`;
  doc.head.append(style);
  if (!siteRoot) {
    const previewNavigation = doc.createElement('script');
    previewNavigation.textContent = `document.addEventListener('click',function(e){const a=e.target.closest('a[data-guided-page]');if(a){e.preventDefault();parent.postMessage({type:'guided-template-page',page:a.dataset.guidedPage},'*')}});`;
    doc.body.append(previewNavigation);
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

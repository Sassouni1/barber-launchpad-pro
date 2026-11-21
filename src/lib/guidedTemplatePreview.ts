import { instagramUrl, normalizedWebUrl, parseGuidedServices, type GuidedTemplate, type GuidedWebsiteAnswers } from './guidedWebsite';
import { limitServiceDescription } from './serviceDescription';
import { template2ServiceContent } from './template2ServiceCatalog';

// Build the iframe document before loading it. Preview frames may be isolated from their
// parent, so changing their DOM after load is unreliable.
export function personalizedTemplateHtml(
  html: string, template: GuidedTemplate, serviceText: string, baseUrl: string,
  serviceDetails: Array<{ name: string; description?: string; duration?: string }> = [],
  role?: string, siteRoot?: string, answers?: GuidedWebsiteAnswers, businessOwnerType?: string | null,
) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Resolve template assets without a <base>, which would redirect #services links away from the member site.
  doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement>('link[href], script[src], img[src]').forEach(element => {
    const attribute = element.hasAttribute('href') ? 'href' : 'src';
    const value = element.getAttribute(attribute) || '';
    if (value && !/^(?:https?:|data:|#)/i.test(value)) element.setAttribute(attribute, new URL(value, baseUrl).href);
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="index.html"]').forEach(link => { link.href = siteRoot || '#'; });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="hair-loss-solutions/index.html"], a[href="hair-loss-solutions/"]').forEach(link => {
    link.href = siteRoot ? `${siteRoot}hair-loss-solutions/` : new URL('hair-loss-solutions/index.html', baseUrl).href;
  });
  const services = parseGuidedServices(serviceText);

  if (template === 'guided-charlotte') {
    const name = answers?.businessName.trim() || 'Your Business Name';
    const owner = answers?.ownerName.trim() || 'Your Name';
    const city = answers?.city.trim() || 'Your City';
    const isShopOwner = businessOwnerType === 'barbershop' || businessOwnerType === 'salon';
    const shopLabel = businessOwnerType === 'salon' ? 'salon' : 'shop';
    const phone = answers?.phone.trim() || '';
    const bookingUrl = answers?.hasBookingApp ? normalizedWebUrl(answers.bookingUrl) : null;
    const bookingHref = bookingUrl || (phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#visit');
    const descriptionFor = (serviceName: string) =>
      limitServiceDescription(serviceDetails.find(item => item.name.trim().toLowerCase() === serviceName.toLowerCase())?.description)
      || template2ServiceContent(serviceName, role)?.description
      || `Ask about ${serviceName.toLowerCase()} and what to expect at your appointment.`;
    const setText = (selector: string, value: string) => {
      const element = doc.querySelector(selector);
      if (element) element.textContent = value;
    };
    if (answers) {
      setText('title', `${name} | ${city}`);
      doc.querySelector('meta[name="description"]')?.setAttribute('content', `${name} in ${city}. Explore services and book an appointment.`);
      doc.querySelector('.wordmark')?.setAttribute('aria-label', `${name} home`);
      setText('.wordmark span', name);
      setText('.wordmark small', isShopOwner ? city : `${owner} · ${city}`);
      const heroLocation = doc.querySelector('.hero .eyebrow');
      if (heroLocation) {
        const line = heroLocation.querySelector('.line');
        heroLocation.replaceChildren(...(line ? [line] : []), doc.createTextNode(` ${city}`));
      }
      const heroSide = doc.querySelector('.hero-side');
      if (heroSide) heroSide.replaceChildren(doc.createTextNode(`${name} `), Object.assign(doc.createElement('span'), { textContent: ' / ' }), doc.createTextNode(city));
      setText('.hero-lede', `Haircuts, grooming, and personal care at ${name}. Come as you are. Leave feeling like your best self.`);
      setText('.intro-copy p:first-child', isShopOwner
        ? `Explore the services at ${name} in ${city} and find the right appointment for you.`
        : `Meet ${owner} at ${name}. Explore the services available in ${city} and find the right appointment for you.`);
      setText('.intro-copy p:nth-child(2)', `From your first visit to your next appointment, see the services and prices below before you book.`);
      setText('.intro-copy p:nth-child(3)', `Questions about a service? Get in touch and we can help you choose where to start.`);
      setText('.intro-copy .underlined', 'More about the studio ↗');
      setText('.services .section-heading > p', 'Explore the services available at this business and see prices where provided.');
      if (isShopOwner) setText('.intro .eyebrow', `01 / ABOUT THE ${shopLabel.toUpperCase()}`);
      else if (/stylist|salon/i.test(role || '')) setText('.intro .eyebrow', '01 / MEET YOUR STYLIST');
      setText('.systems-copy .button', 'Book a consultation ↗');
      setText('#systems-title em', `${city}.`);
      setText('.footer-grid strong', name);
      setText('.footer-grid > div:first-child span', isShopOwner ? city : `${owner} · ${city}`);
      setText('.footer-grid > div:last-child span', `© ${name}`);
      const instagram = instagramUrl(answers.instagram);
      const footerLinks = doc.querySelector('.footer-grid > div:nth-child(2)');
      if (instagram && footerLinks) {
        const link = doc.createElement('a');
        link.href = instagram;
        link.textContent = 'Instagram';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        footerLinks.append(link);
      }
      setText('.visit-details > div:first-child p', city);
      setText('.visit-details > div:last-child p', phone || 'Contact details coming soon');
      setText('.visit-details > div:nth-child(2) p', answers.hours.trim() || 'See booking page for availability');
      setText('.visit-grid > div:first-child > p:not(.eyebrow)', `Visit ${name} in ${city}. ${bookingUrl ? 'Book online at a time that works for you.' : 'Call to plan your appointment.'}`);
      doc.querySelectorAll<HTMLAnchorElement>('.nav-book, .hero-actions .button, .systems-copy .button, .visit-grid .button, .closing .button, .service > a').forEach(link => {
        link.href = bookingHref;
        if (bookingUrl) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      });
      const offersHairSolutions = services.some(service => /system|replacement|topper/i.test(service.name))
        || /density|hair loss|hair restoration|hair replacement/i.test(name);
      if (!offersHairSolutions) {
        doc.querySelector('#hair-systems')?.remove();
        doc.querySelectorAll<HTMLAnchorElement>('a[href="#hair-systems"], a[href*="hair-loss-solutions/"]').forEach(link => link.remove());
      }
    }
    const list = doc.querySelector('#service-list');
    if (!list) return `<!doctype html>${doc.documentElement.outerHTML}`;
    const rows = services.map((service, index) => {
      const row = doc.createElement('article');
      row.className = 'service';
      row.dataset.category = /system|replacement|topper|extension/i.test(service.name) ? 'systems'
        : /color|highlight|balayage|perm|keratin/i.test(service.name) ? 'color'
          : /beard|shave|wax|brow|facial/i.test(service.name) ? 'care' : 'cuts';
      const number = doc.createElement('div');
      number.className = 'service-num';
      number.textContent = String(index + 1).padStart(2, '0');
      const details = doc.createElement('div');
      const title = doc.createElement('h3');
      title.textContent = service.name;
      details.append(title);
      const description = doc.createElement('p');
      description.textContent = descriptionFor(service.name);
      details.append(description);
      const meta = doc.createElement('div');
      meta.className = 'service-meta';
      if (service.price) {
        const price = doc.createElement('strong');
        price.textContent = service.price;
        meta.append(price);
      }
      const duration = serviceDetails.find(item => item.name.trim().toLowerCase() === service.name.toLowerCase())?.duration;
      if (duration && /^\d+$/.test(duration)) {
        const minutes = doc.createElement('span');
        minutes.textContent = `${duration} min`;
        meta.append(minutes);
      }
      const book = doc.createElement('a');
      book.href = bookingHref;
      if (bookingUrl) { book.target = '_blank'; book.rel = 'noopener noreferrer'; }
      book.setAttribute('aria-label', `Book ${service.name}`);
      book.textContent = '↗';
      row.append(number, details, meta, book);
      return row;
    });
    list.replaceChildren(...rows);
    const note = doc.querySelector('.price-note');
    if (note) note.textContent = 'Services and prices from your profile.';
    doc.querySelector('.feature-strip')?.remove();
    if (!services.length) {
      doc.querySelector('#services')?.remove();
      doc.querySelectorAll('a[href="#services"]').forEach(link => link.remove());
    }
    if (!siteRoot) {
      const previewNavigation = doc.createElement('script');
      previewNavigation.textContent = `document.addEventListener('click', function(event) {
        const link = event.target.closest('a');
        if (!link) return;
        if (link.getAttribute('href').includes('hair-loss-solutions/')) {
          event.preventDefault(); parent.postMessage({type:'guided-template-page', page:'/hair-loss-solutions/'}, '*'); return;
        }
        if (!link.getAttribute('href').startsWith('#')) return;
        const target = document.getElementById(link.getAttribute('href').slice(1));
        if (target) { event.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
      });`;
      doc.body.append(previewNavigation);
    } else doc.querySelector('meta[name="robots"]')?.remove();
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }

  const rates = doc.querySelector('.price-list');
  if (!rates) return `<!doctype html>${doc.documentElement.outerHTML}`;
  if (!services.length) {
    doc.querySelector('.services')?.remove();
    doc.querySelector('.rates')?.remove();
    return `<!doctype html>${doc.documentElement.outerHTML}`;
  }
  const rows = services.map(service => {
    const row = doc.createElement('p');
    const label = doc.createElement('span');
    const link = doc.createElement('a');
    link.href = '#services';
    link.textContent = service.name;
    label.append(link);
    const leader = doc.createElement('i');
    const price = doc.createElement('b');
    price.textContent = service.price || 'Ask for price';
    row.append(label, leader, price);
    return row;
  });
  rates.replaceChildren(...rows);
  const descriptions = new Map(serviceDetails.map(service => [service.name.trim().toLowerCase(), limitServiceDescription(service.description)]));
  const cards = doc.querySelector('.cards');
  if (!cards) return `<!doctype html>${doc.documentElement.outerHTML}`;
  const cardRows = services.map(service => {
    const content = template2ServiceContent(service.name, role);
    const card = doc.createElement('article');
    card.className = 'service-card';
    if (content?.image) {
      const image = doc.createElement('img');
      image.src = new URL(`service-images/${content.image}`, baseUrl).href;
      image.alt = service.name;
      image.loading = 'lazy';
      card.append(image);
    } else {
      const placeholder = doc.createElement('div');
      placeholder.className = 'service-image-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      card.append(placeholder);
    }
    const body = doc.createElement('div');
    const title = doc.createElement('h3');
    title.textContent = service.name;
    const description = doc.createElement('p');
    description.textContent = descriptions.get(service.name.toLowerCase()) || content?.description ||
      `Ask about ${service.name.toLowerCase()} and what to expect at your appointment.`;
    body.append(title, description);
    card.append(body);
    return card;
  });
  cards.replaceChildren(...cardRows);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

export function personalizedTemplateOneHairHtml(html: string, baseUrl: string, answers: GuidedWebsiteAnswers, siteRoot?: string, businessOwnerType?: string | null) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement | HTMLSourceElement>('link[href], script[src], img[src], video[poster], source[src]').forEach(element => {
    const attribute = element.hasAttribute('href') ? 'href' : element.hasAttribute('poster') ? 'poster' : 'src';
    const value = element.getAttribute(attribute) || '';
    if (value && !/^(?:https?:|data:|#)/i.test(value)) element.setAttribute(attribute, new URL(value, baseUrl).href);
  });
  const name = answers.businessName.trim() || 'Your Business Name';
  const isShopOwner = businessOwnerType === 'barbershop' || businessOwnerType === 'salon';
  const owner = isShopOwner ? 'our team' : answers.ownerName.trim() || 'Your Name';
  const city = answers.city.trim() || 'Your City';
  const shopLabel = businessOwnerType === 'salon' ? 'salon' : 'shop';
  const replacements: Record<string, string> = {
    'YOUR BUSINESS NAME': name.toUpperCase(), 'Your Business Name': name,
    'YOUR CITY, YOUR STATE': city.toUpperCase(), 'Your City, Your State': city,
    'YOUR CITY': city.toUpperCase(), 'Your City': city,
    'YOUR NAME': owner.toUpperCase(), 'Your Name': owner,
  };
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    let value = node.textContent || '';
    for (const [placeholder, actual] of Object.entries(replacements)) value = value.split(placeholder).join(actual);
    node.textContent = value;
  }
  if (isShopOwner) {
    const wordmarkLocation = doc.querySelector('.wordmark small');
    if (wordmarkLocation) wordmarkLocation.textContent = city;
    const about = doc.querySelector('#your-barber h2');
    if (about) about.innerHTML = `ABOUT<br><em>OUR ${shopLabel.toUpperCase()}.</em>`;
    const aboutLabel = doc.querySelector('#your-barber .eyebrow');
    if (aboutLabel) aboutLabel.textContent = `07 / ABOUT OUR ${shopLabel.toUpperCase()}`;
    const footerLocation = doc.querySelector('.footer-grid > div:first-child span');
    if (footerLocation) footerLocation.textContent = city;
  }
  doc.title = `Hair Loss Solutions | ${name}`;
  doc.querySelector('meta[name="description"]')?.setAttribute('content', `Explore hair systems and hair loss solutions at ${name} in ${city}.`);
  doc.querySelector('.wordmark')?.setAttribute('aria-label', `${name} home`);
  if (siteRoot) doc.querySelector('meta[name="robots"]')?.remove();
  const booking = answers.hasBookingApp ? normalizedWebUrl(answers.bookingUrl) : null;
  const phone = answers.phone.trim();
  const bookHref = booking || (phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#');
  doc.querySelectorAll<HTMLAnchorElement>('a[href="../#visit"]').forEach(link => {
    if (/book|consultation|ask about/i.test(link.textContent || '')) {
      link.href = bookHref;
      link.textContent = 'Book a hair system consultation ↗';
      if (booking) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    }
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="../"], a[href^="../#"]').forEach(link => {
    const oldHref = link.getAttribute('href') || '';
    if (siteRoot) link.href = `${siteRoot}${oldHref.startsWith('../#') ? oldHref.slice(2) : ''}`;
    else { link.href = '#'; link.dataset.guidedPage = '/'; }
  });
  if (!siteRoot) {
    const previewNavigation = doc.createElement('script');
    previewNavigation.textContent = `document.addEventListener('click', function(event) {
      const link = event.target.closest('a');
      if (!link) return;
      if (link.dataset.guidedPage) {
        event.preventDefault(); parent.postMessage({type:'guided-template-page',page:link.dataset.guidedPage},'*'); return;
      }
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const target = document.getElementById(href.slice(1));
      if (target) { event.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
    });`;
    doc.body.append(previewNavigation);
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

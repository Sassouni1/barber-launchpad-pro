import { parseGuidedServices, type GuidedTemplate } from './guidedWebsite';
import { limitServiceDescription } from './serviceDescription';
import { template2ServiceContent } from './template2ServiceCatalog';

// Build the iframe document before loading it. Preview frames may be isolated from their
// parent, so changing their DOM after load is unreliable.
export function personalizedTemplateHtml(
  html: string, template: GuidedTemplate, serviceText: string, baseUrl: string,
  serviceDetails: Array<{ name: string; description?: string }> = [],
  role?: string, siteRoot?: string,
) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Resolve template assets without a <base>, which would redirect #services links away from the member site.
  doc.querySelectorAll<HTMLLinkElement | HTMLScriptElement | HTMLImageElement>('link[href], script[src], img[src]').forEach(element => {
    const attribute = element.hasAttribute('href') ? 'href' : 'src';
    const value = element.getAttribute(attribute) || '';
    if (value && !/^(?:https?:|data:|#)/i.test(value)) element.setAttribute(attribute, new URL(value, baseUrl).href);
  });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="index.html"]').forEach(link => { link.href = siteRoot || '#'; });
  doc.querySelectorAll<HTMLAnchorElement>('a[href="hair-loss-solutions/index.html"]').forEach(link => {
    link.href = siteRoot ? `${siteRoot}hair-loss-solutions/` : new URL('hair-loss-solutions/index.html', baseUrl).href;
  });
  const services = parseGuidedServices(serviceText);

  if (template === 'guided-charlotte') {
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
      const meta = doc.createElement('div');
      meta.className = 'service-meta';
      if (service.price) {
        const price = doc.createElement('strong');
        price.textContent = service.price;
        meta.append(price);
      }
      const book = doc.createElement('a');
      book.href = '#visit';
      book.setAttribute('aria-label', `Book ${service.name}`);
      book.textContent = '↗';
      row.append(number, details, meta, book);
      return row;
    });
    list.replaceChildren(...rows);
    const note = doc.querySelector('.price-note');
    if (note) note.textContent = 'Services and prices from your profile.';
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

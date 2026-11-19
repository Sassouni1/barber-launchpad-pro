import { parseGuidedServices, type GuidedTemplate } from './guidedWebsite';

// Build the iframe document before loading it. Preview frames may be isolated from their
// parent, so changing their DOM after load is unreliable.
export function personalizedTemplateHtml(html: string, template: GuidedTemplate, serviceText: string, baseUrl: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base');
  base.href = baseUrl;
  doc.head.prepend(base);
  const services = parseGuidedServices(serviceText);
  if (!services.length) return `<!doctype html>${doc.documentElement.outerHTML}`;

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
  const rows = services.map(service => {
    const row = doc.createElement('p');
    const label = doc.createElement('span');
    const link = doc.createElement('a');
    link.href = '#services';
    link.textContent = service.name;
    label.append(link);
    const leader = doc.createElement('i');
    const price = doc.createElement('b');
    price.textContent = service.price;
    row.append(label, leader, price);
    return row;
  });
  rates.replaceChildren(...rows);
  doc.querySelectorAll('.service-card').forEach((card, index) => {
    const service = services[index];
    (card as HTMLElement).hidden = !service;
    if (!service) return;
    const title = card.querySelector('h3');
    const description = card.querySelector('p');
    if (title) title.textContent = service.name;
    if (description) description.textContent = service.price || '';
  });
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

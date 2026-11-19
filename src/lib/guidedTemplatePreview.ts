import { parseGuidedServices, type GuidedTemplate } from './guidedWebsite';

// The design examples are static files. Replace their sample menu inside each same-origin
// iframe so the full design preview shows the member's actual saved service menu.
export function populateTemplateServices(frame: HTMLIFrameElement, template: GuidedTemplate, serviceText: string) {
  const services = parseGuidedServices(serviceText);
  if (!services.length) return;
  const doc = frame.contentDocument;
  if (!doc) return;

  if (template === 'guided-charlotte') {
    const list = doc.querySelector('#service-list');
    if (!list) return;
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
    return;
  }

  const rates = doc.querySelector('.price-list');
  if (!rates) return;
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
}

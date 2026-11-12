const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  nav.classList.toggle('open', open);
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', 'Open menu');
}));

const serviceList = document.querySelector('#service-list');
const serviceToggle = document.querySelector('.service-toggle');
const services = serviceList ? [...serviceList.querySelectorAll(':scope > .service')] : [];
const previewLimit = 11;

if (serviceList && serviceToggle && services.length > previewLimit) {
  const setServicesExpanded = (expanded) => {
    services.slice(previewLimit).forEach(service => { service.hidden = !expanded; });
    serviceList.classList.toggle('is-collapsed', !expanded);
    serviceToggle.setAttribute('aria-expanded', String(expanded));
    serviceToggle.innerHTML = expanded
      ? 'Show fewer services <span aria-hidden="true">↑</span>'
      : 'See all services <span aria-hidden="true">↓</span>';
  };

  serviceToggle.hidden = false;
  setServicesExpanded(false);
  serviceToggle.addEventListener('click', () => {
    const expanded = serviceToggle.getAttribute('aria-expanded') === 'true';
    const toggleTop = serviceToggle.getBoundingClientRect().top;
    setServicesExpanded(!expanded);
    if (expanded) {
      requestAnimationFrame(() => {
        window.scrollBy({
          top: serviceToggle.getBoundingClientRect().top - toggleTop,
          behavior: 'instant'
        });
      });
    }
  });
}

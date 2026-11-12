const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('#site-nav');
const themeButtons = [...document.querySelectorAll('[data-theme-option]')];
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeOption === theme)));
  try { localStorage.setItem('template-one-color-theme', theme); } catch {}
}
setTheme(document.documentElement.dataset.theme === 'green' ? 'green' : 'tan');
themeButtons.forEach(button => button.addEventListener('click', () => setTheme(button.dataset.themeOption)));
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

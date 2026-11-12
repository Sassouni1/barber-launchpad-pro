(() => {
  const grid = document.querySelector('.work-grid');
  const dialog = document.querySelector('.work-lightbox');
  if (!grid || !dialog) return;

  const photos = [...grid.querySelectorAll('a[href]')];
  const enlarged = dialog.querySelector('img');
  const video = dialog.querySelector('iframe');
  const close = dialog.querySelector('.work-lightbox-close');
  let current = 0;

  function show(index) {
    current = (index + photos.length) % photos.length;
    const item = photos[current];
    const reelId = item.dataset.reel;
    video.removeAttribute('src');
    enlarged.removeAttribute('src');
    dialog.classList.toggle('is-reel', Boolean(reelId));
    video.hidden = !reelId;
    enlarged.hidden = Boolean(reelId);
    if (reelId) {
      video.title = item.getAttribute('aria-label');
      video.src = `https://www.instagram.com/reel/${reelId}/embed/`;
    } else {
      enlarged.src = item.href;
      enlarged.alt = item.querySelector('img').alt;
    }
  }

  grid.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link || !grid.contains(link)) return;
    event.preventDefault();
    show(photos.indexOf(link));
    dialog.showModal();
    close.focus();
  });

  close.addEventListener('click', () => dialog.close());
  dialog.querySelector('.work-lightbox-prev').addEventListener('click', () => show(current - 1));
  dialog.querySelector('.work-lightbox-next').addEventListener('click', () => show(current + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
  dialog.addEventListener('close', () => {
    enlarged.removeAttribute('src');
    video.removeAttribute('src');
  });
})();

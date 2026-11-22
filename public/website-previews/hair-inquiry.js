(function () {
  const section = document.getElementById('hair-system-request');
  const form = section?.querySelector('form.hair-inquiry-form');
  if (!form) return;
  const modal = document.getElementById('hair-inquiry-modal');
  const modalBody = modal?.querySelector('.hair-inquiry-modal-body');
  let modalForm;

  function bind(current) {
    current.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!current.reportValidity()) return;
      const status = current.querySelector('.hair-inquiry-status');
      const button = current.querySelector('button[type="submit"]');
      const slug = current.dataset.siteSlug;
      if (!slug) { status.textContent = 'This is a preview. Inquiries can be sent from a published website.'; return; }
      const fields = Object.fromEntries(new FormData(current));
      fields.siteSlug = slug;
      fields.requestId = current.dataset.requestId || crypto.randomUUID();
      current.dataset.requestId = fields.requestId;
      status.textContent = '';
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const response = await fetch(current.action, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(fields) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send your request.');
        delete current.dataset.requestId;
        current.hidden = true;
        const success = current.parentElement.querySelector('.hair-inquiry-success');
        if (success) { success.hidden = false; success.focus(); }
      } catch (error) {
        status.textContent = error.message || 'Could not send your request. Please try again.';
      } finally { button.disabled = false; button.textContent = 'Send hair-system inquiry ↗'; }
    });
  }
  bind(form);
  if (modal && modalBody && typeof modal.showModal === 'function') {
    modalForm = form.cloneNode(true);
    modalForm.id = 'hair-inquiry-modal-form';
    modalForm.querySelectorAll('[id]').forEach(el => {
      const old = el.id;
      el.id = old + '-modal';
      modalForm.querySelector('label[for="' + old + '"]')?.setAttribute('for', el.id);
    });
    const success = section.querySelector('.hair-inquiry-success').cloneNode(true);
    modalBody.append(modalForm, success);
    bind(modalForm);
    let opener;
    document.querySelectorAll('a[href="#hair-system-request"]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault(); opener = link; modal.showModal(); modalForm.querySelector('input[name="firstName"]')?.focus();
    }));
    modal.querySelector('.hair-inquiry-close')?.addEventListener('click', () => modal.close());
    modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
    modal.addEventListener('close', () => { opener?.focus(); if (modalForm.hidden) { modalForm.hidden = false; modalForm.reset(); success.hidden = true; } });
    if (location.hash === '#hair-system-popup') modal.showModal();
  }
})();

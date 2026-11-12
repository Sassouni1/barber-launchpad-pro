const previewForm = document.querySelector('#hair-system-form');
const modal = document.querySelector('#hair-system-modal');

function attachPreviewSubmit(form) {
  form?.addEventListener('submit', event => {
    event.preventDefault();
    form.querySelector('.request-status').textContent = 'This form is a design preview.';
  });
}

attachPreviewSubmit(previewForm);

if (previewForm && modal?.showModal) {
  const modalForm = previewForm.cloneNode(true);
  modalForm.id = 'hair-system-modal-request-form';
  modalForm.querySelectorAll('[id]').forEach(field => { field.id += '-modal'; });
  modalForm.querySelectorAll('label[for]').forEach(label => { label.htmlFor += '-modal'; });
  document.querySelector('#hair-system-modal-form').append(modalForm);
  attachPreviewSubmit(modalForm);

  document.querySelectorAll('a[href="#hair-system-request"]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      if (!modal.open) modal.showModal();
      document.body.classList.add('hair-system-modal-open');
      modal.querySelector('input:not([type="hidden"])')?.focus();
    });
  });

  modal.querySelector('.hair-system-modal-close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
  modal.addEventListener('close', () => document.body.classList.remove('hair-system-modal-open'));
}

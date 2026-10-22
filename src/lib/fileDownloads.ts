export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverFile(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: blob.type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
    }
  }
  downloadBlob(blob, filename);
  return true;
}

export async function fetchDownload(url: string): Promise<Blob> {
  let response: Response;
  try { response = await fetch(url); }
  catch (error) {
    if (!/^https?:\/\//.test(url)) throw error;
    const proxy = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-file?url=${encodeURIComponent(url)}`;
    response = await fetch(proxy);
  }
  if (!response.ok) throw new Error(`Could not download file (${response.status})`);
  const blob = await response.blob();
  if (!blob.size || /text\/html|application\/json/.test(blob.type)) {
    throw new Error('The file is unavailable. Please try again.');
  }
  return blob;
}

// Opens an image (e.g. a certificate) in a print-ready view and triggers the
// browser print dialog. Landscape page, image fitted to the sheet. Falls back
// to a hidden iframe when popups are blocked (common on mobile).
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the file for printing'));
    reader.readAsDataURL(blob);
  });
}

export async function printImageFromUrl(url: string, title = 'Certificate'): Promise<boolean> {
  const blob = await fetchDownload(url);
  // Inline the image as a data URL: Safari cannot resolve blob: URLs created
  // in the opener window inside a document.write'd popup, which left the
  // print view showing a broken image.
  const dataUrl = await blobToDataUrl(blob);
  const cleanup = () => {};
  const html = `<!doctype html><html><head><title>${title}</title><style>@page{size:landscape;margin:0}html,body{margin:0;padding:0;height:100%}img{display:block;width:100vw;height:100vh;object-fit:contain}</style></head><body><img src="${dataUrl}" alt="${title}"></body></html>`;
  const wireUp = (doc: Document, win: Window, done: () => void) => {
    const img = doc.querySelector('img');
    const trigger = () => { win.focus(); win.print(); done(); };
    if (!img) { done(); return; }
    if (img.complete) trigger();
    else img.addEventListener('load', trigger, { once: true });
  };

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    wireUp(printWindow.document, printWindow, cleanup);
    return true;
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    cleanup();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  wireUp(doc, win, () => {
    cleanup();
    window.setTimeout(() => iframe.remove(), 60_000);
  });
  return true;
}
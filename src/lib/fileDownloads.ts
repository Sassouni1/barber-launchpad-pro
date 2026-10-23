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

// Certificate printing. Prints from the main document using a print-only
// stylesheet (no popup, no iframe): popups are blocked on mobile and a hidden
// 0x0 iframe gives the image zero size, which printed a blank page in Safari.
// The image is preloaded + decoded before the click so window.print() can run
// synchronously inside the user's tap.
const preparedImages = new Map<string, Promise<HTMLImageElement>>();

export function preparePrintImage(url: string): Promise<HTMLImageElement> {
  let pending = preparedImages.get(url);
  if (!pending) {
    pending = (async () => {
      const blob = await fetchDownload(url);
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      if (img.decode) await img.decode();
      else await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not load the certificate')); });
      return img;
    })();
    pending.catch(() => preparedImages.delete(url));
    preparedImages.set(url, pending);
  }
  return pending;
}

const PRINT_ROOT_ID = 'print-image-root';
const PRINT_STYLE_ID = 'print-image-style';
const isSafari = /^((?!chrome|crios|fxios|edg|opr).)*safari/i.test(navigator.userAgent);
const PRINT_CSS = `
#${PRINT_ROOT_ID}{display:none}
@media print{
  @page{size:letter landscape;margin:0}
  html,body{margin:0!important;padding:0!important;height:auto!important;overflow:visible!important;background:#fff!important}
  body>*:not(#${PRINT_ROOT_ID}){display:none!important}
  #${PRINT_ROOT_ID}{display:flex!important;align-items:center;justify-content:center;box-sizing:border-box;width:11in;height:8.5in;padding:0.25in;margin:0;page-break-inside:avoid;break-inside:avoid}
  #${PRINT_ROOT_ID} img{display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;object-position:center;margin:0}
  #${PRINT_ROOT_ID}.safari-portrait{position:relative;width:8in;height:9.5in;padding:0;overflow:hidden;transform:translateY(0.6in)}
  #${PRINT_ROOT_ID}.safari-portrait img{position:absolute;top:50%;left:50%;width:9.5in;height:7.5in;max-width:none;max-height:none;transform:translate(-50%,-50%) rotate(90deg)}
}`;

export function printPreparedImage(img: HTMLImageElement, title = 'Certificate') {
  document.getElementById(PRINT_ROOT_ID)?.remove();
  if (!document.getElementById(PRINT_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = PRINT_STYLE_ID;
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
  }
  const root = document.createElement('div');
  root.id = PRINT_ROOT_ID;
  if (isSafari) root.className = 'safari-portrait';
  const copy = img.cloneNode() as HTMLImageElement;
  copy.alt = title;
  root.appendChild(copy);
  document.body.appendChild(root);

  const previousTitle = document.title;
  document.title = title; // used as the default "Save as PDF" filename
  const cleanup = () => {
    root.remove();
    document.title = previousTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // Fallback for browsers that don't fire afterprint.
  window.setTimeout(() => { if (root.isConnected) cleanup(); }, 120_000);
}

export async function printImageFromUrl(url: string, title = 'Certificate'): Promise<boolean> {
  const img = await preparePrintImage(url);
  printPreparedImage(img, title);
  return true;
}

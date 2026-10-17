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
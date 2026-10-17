import { test, expect, afterEach } from 'bun:test';
import { downloadBlob, deliverFile, fetchDownload } from '../src/lib/fileDownloads';

const originals = new Map<string, PropertyDescriptor | undefined>();
function mockGlobal(key: string, value: unknown) {
  originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, value });
}
afterEach(() => {
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  originals.clear();
});

test('save clicks a local blob attachment and retains URL for 30 seconds', () => {
  const events: string[] = [];
  const link = { href: '', download: '', click() { events.push('click'); }, remove() { events.push('remove'); } };
  mockGlobal('URL', { createObjectURL: () => 'blob:local-file', revokeObjectURL: () => events.push('revoke') });
  mockGlobal('document', { createElement: () => link, body: { appendChild: () => events.push('append') } });
  let cleanup: (() => void) | undefined;
  mockGlobal('window', { setTimeout: (callback: () => void, delay: number) => { expect(delay).toBe(30000); cleanup = callback; } });
  downloadBlob(new Blob(['file']), 'checklist.pdf');
  expect(link.href).toBe('blob:local-file');
  expect(link.download).toBe('checklist.pdf');
  expect(events).toEqual(['append', 'click', 'remove']);
  cleanup?.();
  expect(events).toContain('revoke');
});

test('mobile shares a prepared ZIP without navigation', async () => {
  mockGlobal('matchMedia', () => ({ matches: true }));
  let sharedName = '';
  mockGlobal('navigator', { canShare: () => true, share: async ({ files }: { files: File[] }) => { sharedName = files[0].name; } });
  expect(await deliverFile(new Blob(['zip'], { type: 'application/zip' }), 'images.zip')).toBe(true);
  expect(sharedName).toBe('images.zip');
});

test('cancelled mobile share does not trigger a fallback save', async () => {
  mockGlobal('matchMedia', () => ({ matches: true }));
  mockGlobal('navigator', { canShare: () => true, share: async () => { throw new DOMException('Cancelled', 'AbortError'); } });
  expect(await deliverFile(new Blob(['zip']), 'images.zip')).toBe(false);
});

test('failed file response is not saved as a receipt', async () => {
  mockGlobal('fetch', async () => new Response('Denied', { status: 403 }));
  await expect(fetchDownload('/file.pdf')).rejects.toThrow('Could not download file (403)');
});

test('HTML preview response is rejected instead of downloaded as a file', async () => {
  mockGlobal('fetch', async () => new Response('<html>preview</html>', { headers: { 'Content-Type': 'text/html' } }));
  await expect(fetchDownload('/file.pdf')).rejects.toThrow('The file is unavailable');
});
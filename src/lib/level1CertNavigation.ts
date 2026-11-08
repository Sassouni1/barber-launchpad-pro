export const OPEN_LEVEL_1_CERT_EVENT = 'barber-launch:open-level-1-cert';

export function openLevel1CertPanel() {
  window.dispatchEvent(new Event(OPEN_LEVEL_1_CERT_EVENT));
}

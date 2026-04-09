import { BusinessCard } from '@/hooks/useBusinessCard';

export function generateVCard(card: BusinessCard): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.business_name}`,
    `ORG:${card.business_name}`,
  ];

  if (card.phone) lines.push(`TEL;TYPE=WORK:${card.phone}`);
  if (card.email) lines.push(`EMAIL;TYPE=WORK:${card.email}`);
  if (card.booking_url) lines.push(`item1.URL:${card.booking_url}`, `item1.X-ABLabel:Book Free Consultation`);
  if (card.gallery_url) lines.push(`item2.URL:${card.gallery_url}`, `item2.X-ABLabel:See Transformations`);
  if (card.logo_url) lines.push(`PHOTO;VALUE=URI:${card.logo_url}`);

  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function downloadVCard(card: BusinessCard) {
  const vcf = generateVCard(card);
  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${card.business_name.replace(/\s+/g, '-')}.vcf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

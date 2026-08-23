/**
 * Utilities for the Stay Faded website editor.
 *
 * The templates live in `public/stay-faded/*.html` and are loaded in a
 * same-origin iframe, so we can walk and patch their DOM directly.
 */

export type StayFadedPageKey = 'home' | 'hair-systems';

export const STAY_FADED_PAGES: { key: StayFadedPageKey; label: string; src: string }[] = [
  { key: 'home', label: 'Home', src: '/stay-faded/home.html' },
  { key: 'hair-systems', label: 'Hair Systems', src: '/stay-faded/hair-systems.html' },
];

export type StayFadedField = {
  key: string;
  kind: 'text' | 'image';
  label: string;
  section: string;
  original: string;
  /** Hard character limit for text fields (undefined for images). */
  limit?: number;
  /** Natural/rendered target dimensions for image fields. */
  width?: number;
  height?: number;
};

export type StayFadedPageDraft = Record<string, string>;
export type StayFadedDraft = Partial<Record<StayFadedPageKey, StayFadedPageDraft>>;

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE']);

/** Stable structural key: index path from <body>. */
export function elementKey(el: Element): string {
  const parts: number[] = [];
  let node: Element | null = el;
  while (node && node.parentElement && node.tagName !== 'BODY') {
    parts.unshift(Array.prototype.indexOf.call(node.parentElement.children, node));
    node = node.parentElement;
  }
  return parts.join('.');
}

export function elementFromKey(doc: Document, key: string): Element | null {
  if (!doc.body) return null;
  let node: Element | null = doc.body;
  for (const part of key.split('.')) {
    const index = Number(part);
    if (!node || Number.isNaN(index)) return null;
    node = node.children[index] ?? null;
  }
  return node;
}

/** Longer prose is allowed to grow; short layout-sensitive copy is kept tight. */
export function characterLimitFor(text: string): number {
  const length = text.length;
  if (length > 220) return Math.ceil(length * 1.6);
  if (length > 90) return Math.ceil(length * 1.35);
  return Math.max(length + 12, Math.ceil(length * 1.25));
}

function sectionLabel(el: Element): string {
  const section = el.closest('section, header, footer, nav, main');
  if (!section) return 'Page';
  const id = section.getAttribute('id');
  const heading = section.querySelector('h1, h2, h3');
  const tag = section.tagName.toLowerCase();
  const name =
    heading?.textContent?.trim().slice(0, 40) ||
    (id ? id.replace(/[-_]/g, ' ') : '') ||
    tag;
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldLabel(el: Element, text: string): string {
  const tag = el.tagName.toLowerCase();
  const map: Record<string, string> = {
    h1: 'Headline',
    h2: 'Heading',
    h3: 'Subheading',
    h4: 'Subheading',
    h5: 'Subheading',
    h6: 'Subheading',
    a: 'Link / button',
    button: 'Button',
    li: 'List item',
    small: 'Small text',
    strong: 'Highlight',
    span: 'Text',
    p: 'Paragraph',
    summary: 'FAQ question',
    dt: 'Term',
    dd: 'Detail',
  };
  const kind = map[tag] ?? 'Text';
  return `${kind}: ${text.slice(0, 46)}${text.length > 46 ? '…' : ''}`;
}

/** True when the element's own content is a single run of text. */
function isLeafText(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return false;
  if (el.children.length > 0) return false;
  const text = el.textContent?.trim() ?? '';
  return text.length > 0;
}

export function scanFields(doc: Document): StayFadedField[] {
  const fields: StayFadedField[] = [];
  if (!doc.body) return fields;

  doc.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (SKIP_TAGS.has(el.tagName)) return;

    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      const src = img.getAttribute('src') || '';
      if (!src) return;
      fields.push({
        key: elementKey(el),
        kind: 'image',
        label: img.getAttribute('alt')?.slice(0, 60) || 'Image',
        section: sectionLabel(el),
        original: src,
        width: img.naturalWidth || img.clientWidth || undefined,
        height: img.naturalHeight || img.clientHeight || undefined,
      });
      return;
    }

    if (!isLeafText(el)) return;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    fields.push({
      key: elementKey(el),
      kind: 'text',
      label: fieldLabel(el, text),
      section: sectionLabel(el),
      original: text,
      limit: characterLimitFor(text),
    });
  });

  return fields;
}

export function applyDraft(doc: Document, draft: StayFadedPageDraft) {
  Object.entries(draft).forEach(([key, value]) => {
    const el = elementFromKey(doc, key);
    if (!el) return;
    if (el.tagName === 'IMG') (el as HTMLImageElement).src = value;
    else el.textContent = value;
  });
}

export const EDITOR_STYLE_ID = 'sf-editor-style';

export const EDITOR_CSS = `
[data-sf-editable]{outline:1px dashed rgba(212,175,55,.55);outline-offset:2px;cursor:pointer;transition:outline-color .15s ease,background-color .15s ease}
[data-sf-editable]:hover{outline:2px solid rgba(212,175,55,.95);background-color:rgba(212,175,55,.10)}
[data-sf-selected]{outline:3px solid #d4af37 !important;background-color:rgba(212,175,55,.16)}
`;

/** Marks every scanned field so it is clickable inside the iframe. */
export function decorateFields(doc: Document, fields: StayFadedField[]) {
  if (!doc.getElementById(EDITOR_STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = EDITOR_STYLE_ID;
    style.textContent = EDITOR_CSS;
    doc.head.appendChild(style);
  }
  fields.forEach((field) => {
    const el = elementFromKey(doc, field.key);
    if (el) el.setAttribute('data-sf-editable', field.kind);
  });
}

export function setSelected(doc: Document, key: string | null) {
  doc.querySelectorAll('[data-sf-selected]').forEach((el) => el.removeAttribute('data-sf-selected'));
  if (!key) return;
  const el = elementFromKey(doc, key);
  if (el) {
    el.setAttribute('data-sf-selected', 'true');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Shared primitives for the member Website Editor.
 *
 * Nothing in here is client- or host-specific: every template is described by a
 * `WebsiteTemplateConfig` record loaded from `public.website_templates`, and the
 * same scanning / editing / rendering code runs for all of them.
 */

export type TemplatePage = {
  key: string;
  label: string;
  /** Same-origin file used inside the editor iframe. */
  source: string;
  /** Optional same-origin stylesheet inlined at publish time. */
  stylesheet?: string;
  /** Path this page is published at on the client's own site. */
  path: string;
};

/** Optional per-field overrides, keyed by structural field key. */
export type FieldRule = {
  limit?: number;
  width?: number;
  height?: number;
  locked?: boolean;
};

/**
 * Declares one explicitly repeatable card group. Templates opt in by adding
 * rules to `website_templates.repeat_rules` — the editor never clones arbitrary
 * DOM, only items matched by these configured selectors.
 */
export type RepeatRule = {
  /** Stable id used as the draft layout key. */
  key: string;
  /** Singular noun shown in the editor controls, e.g. "service". */
  label: string;
  /** CSS selector for the wrapper that holds the repeated items. */
  container: string;
  /** CSS selector for one repeatable item inside the container. */
  item: string;
  /** Optional cap on how many items a member may create. */
  max?: number;
};

/** ruleKey -> ordered list of original item indices (duplicates repeat an index). */
export type LayoutState = Record<string, number[]>;

export type WebsiteTemplateConfig = {
  templateKey: string;
  displayName: string;
  /** Origin that hosts the template's existing images/fonts. */
  assetOrigin: string | null;
  pages: TemplatePage[];
  fieldRules: Record<string, FieldRule>;
  repeatRules: RepeatRule[];
};


export type EditableField = {
  key: string;
  kind: 'text' | 'image';
  label: string;
  section: string;
  original: string;
  /** Hard character limit for text fields (undefined for images). */
  limit?: number;
  /** Target dimensions for image fields. */
  width?: number;
  height?: number;
};

export type PageDraft = Record<string, string>;
/** pageKey -> fieldKey -> value */
export type EditorDraft = Record<string, PageDraft>;

const SKIP_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'SVG',
  'PATH',
  'TEMPLATE',
  'HEAD',
  'META',
  'LINK',
  'TITLE',
]);

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

export function elementFromKey(root: Document | HTMLElement, key: string): Element | null {
  let node: Element | null = 'body' in root ? root.body : root;
  if (!node) return null;
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
  const name = heading?.textContent?.trim().slice(0, 40) || (id ? id.replace(/[-_]/g, ' ') : '') || tag;
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldLabel(el: Element, text: string): string {
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
  const kind = map[el.tagName.toLowerCase()] ?? 'Text';
  return `${kind}: ${text.slice(0, 46)}${text.length > 46 ? '…' : ''}`;
}

/** True when the element's own content is a single run of text. */
function isLeafText(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return false;
  if (el.children.length > 0) return false;
  return (el.textContent?.trim() ?? '').length > 0;
}

export function scanFields(doc: Document, rules: Record<string, FieldRule> = {}): EditableField[] {
  const fields: EditableField[] = [];
  if (!doc.body) return fields;

  doc.body.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (SKIP_TAGS.has(el.tagName)) return;
    const key = elementKey(el);
    const rule = rules[key];
    if (rule?.locked) return;

    if (el.tagName === 'IMG') {
      const img = el as HTMLImageElement;
      const src = img.getAttribute('src') || '';
      if (!src) return;
      fields.push({
        key,
        kind: 'image',
        label: img.getAttribute('alt')?.slice(0, 60) || 'Image',
        section: sectionLabel(el),
        original: src,
        width: rule?.width ?? img.naturalWidth ?? img.clientWidth ?? undefined,
        height: rule?.height ?? img.naturalHeight ?? img.clientHeight ?? undefined,
      });
      return;
    }

    if (!isLeafText(el)) return;
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    fields.push({
      key,
      kind: 'text',
      label: fieldLabel(el, text),
      section: sectionLabel(el),
      original: text,
      limit: rule?.limit ?? characterLimitFor(text),
    });
  });

  return fields;
}

export function applyDraft(root: Document | HTMLElement, draft: PageDraft) {
  Object.entries(draft).forEach(([key, value]) => {
    if (key.startsWith('__')) return; // reserved editor state, not a field
    const el = elementFromKey(root, key);
    if (!el) return;
    if (el.tagName === 'IMG') el.setAttribute('src', value);
    else el.textContent = value;
  });
}

/* ------------------------------------------------------------------ *
 * Repeatable items (configured card groups only)
 * ------------------------------------------------------------------ */

/** Reserved page-draft key holding the serialized repeat layout. */
export const LAYOUT_KEY = '__layout';

export function readLayout(pageDraft: PageDraft): LayoutState {
  try {
    const raw = pageDraft[LAYOUT_KEY];
    return raw ? (JSON.parse(raw) as LayoutState) : {};
  } catch {
    return {};
  }
}

export function writeLayout(pageDraft: PageDraft, layout: LayoutState): PageDraft {
  return { ...pageDraft, [LAYOUT_KEY]: JSON.stringify(layout) };
}

/** Pristine copies of each rule's items, captured before any rebuild. */
export type RepeatOriginals = Record<string, Element[]>;

export const ITEM_ATTR = 'data-we-item';
export const ITEM_POS_ATTR = 'data-we-item-pos';

function containerFor(root: Document | HTMLElement, rule: RepeatRule): Element | null {
  const scope: ParentNode = 'body' in root ? (root.body as ParentNode) : root;
  return scope.querySelector(rule.container);
}

function itemsIn(container: Element, rule: RepeatRule): Element[] {
  return Array.from(container.querySelectorAll(rule.item)).filter((el) => el.parentElement === container);
}

/**
 * Rebuilds every configured repeat container from its pristine items following
 * the member's layout. Deterministic: the same layout always produces the same
 * DOM, so structural field keys stay stable.
 */
export function applyLayout(
  root: Document | HTMLElement,
  rules: RepeatRule[],
  layout: LayoutState,
  originals: RepeatOriginals = {},
): RepeatOriginals {
  rules.forEach((rule) => {
    const container = containerFor(root, rule);
    if (!container) return;

    if (!originals[rule.key]) {
      originals[rule.key] = itemsIn(container, rule).map((el) => el.cloneNode(true) as Element);
    }
    const pristine = originals[rule.key];
    if (!pristine.length) return;

    const order = (layout[rule.key] ?? pristine.map((_, i) => i)).filter(
      (index) => Number.isInteger(index) && index >= 0 && index < pristine.length,
    );
    const finalOrder = order.length ? order : pristine.map((_, i) => i);

    const current = itemsIn(container, rule);
    const anchor = current[0]?.nextSibling ?? null;
    current.forEach((el) => el.remove());

    finalOrder.forEach((sourceIndex, position) => {
      const clone = pristine[sourceIndex].cloneNode(true) as Element;
      clone.setAttribute(ITEM_ATTR, rule.key);
      clone.setAttribute(ITEM_POS_ATTR, String(position));
      container.insertBefore(clone, anchor);
    });
  });
  return originals;
}

/** Element keys of a rule's items in their current rendered order. */
export function itemKeys(root: Document | HTMLElement, rule: RepeatRule): string[] {
  const container = containerFor(root, rule);
  if (!container) return [];
  return itemsIn(container, rule).map((el) => elementKey(el));
}

/**
 * Moves the member's edits with their card. `mapping[newPosition] = oldPosition`
 * (an old position may appear twice when a card is duplicated).
 */
export function remapItemDraft(
  pageDraft: PageDraft,
  oldKeys: string[],
  newKeys: string[],
  mapping: number[],
): PageDraft {
  const next: PageDraft = {};
  const owned = (key: string) => oldKeys.some((itemKey) => key === itemKey || key.startsWith(`${itemKey}.`));

  Object.entries(pageDraft).forEach(([key, value]) => {
    if (key.startsWith('__') || !owned(key)) next[key] = value;
  });

  mapping.forEach((oldPosition, newPosition) => {
    const oldKey = oldKeys[oldPosition];
    const newKey = newKeys[newPosition];
    if (oldKey === undefined || newKey === undefined) return;
    Object.entries(pageDraft).forEach(([key, value]) => {
      if (key === oldKey) next[newKey] = value;
      else if (key.startsWith(`${oldKey}.`)) next[`${newKey}${key.slice(oldKey.length)}`] = value;
    });
  });

  return next;
}

export function currentOrder(layout: LayoutState, ruleKey: string, itemCount: number): number[] {
  const order = layout[ruleKey];
  if (order && order.length) return [...order];
  return Array.from({ length: itemCount }, (_, i) => i);
}


export const EDITOR_STYLE_ID = 'website-editor-style';

export const EDITOR_CSS = `
[data-we-editable]{outline:1px dashed rgba(212,175,55,.55);outline-offset:2px;cursor:pointer;transition:outline-color .15s ease,background-color .15s ease}
[data-we-editable]:hover{outline:2px solid rgba(212,175,55,.95);background-color:rgba(212,175,55,.10)}
[data-we-selected]{outline:3px solid #d4af37 !important;background-color:rgba(212,175,55,.16)}
`;

/** Marks every scanned field so it is clickable inside the iframe. */
export function decorateFields(doc: Document, fields: EditableField[]) {
  if (!doc.getElementById(EDITOR_STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = EDITOR_STYLE_ID;
    style.textContent = EDITOR_CSS;
    doc.head.appendChild(style);
  }
  fields.forEach((field) => {
    const el = elementFromKey(doc, field.key);
    if (el) el.setAttribute('data-we-editable', field.kind);
  });
}

export function setSelected(doc: Document, key: string | null) {
  doc.querySelectorAll('[data-we-selected]').forEach((el) => el.removeAttribute('data-we-selected'));
  if (!key) return;
  const el = elementFromKey(doc, key);
  if (el) {
    el.setAttribute('data-we-selected', 'true');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Produces the standalone HTML published for one page: the template source with
 * the member's draft applied, its stylesheet inlined and every remaining
 * relative asset resolved against the template's configured asset origin.
 */
export async function renderTemplatePage(
  template: WebsiteTemplateConfig,
  page: TemplatePage,
  draft: PageDraft,
): Promise<string> {
  const html = await fetch(page.source).then((r) => {
    if (!r.ok) throw new Error(`Could not load the ${page.label} template.`);
    return r.text();
  });

  const doc = new DOMParser().parseFromString(html, 'text/html');
  applyDraft(doc, draft);

  // Editor-only markup never ships.
  doc.querySelectorAll('[data-we-editable]').forEach((el) => el.removeAttribute('data-we-editable'));
  doc.querySelectorAll('[data-we-selected]').forEach((el) => el.removeAttribute('data-we-selected'));
  doc.getElementById(EDITOR_STYLE_ID)?.remove();
  doc.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());

  if (page.stylesheet) {
    const css = await fetch(page.stylesheet).then((r) => (r.ok ? r.text() : ''));
    if (css) {
      doc
        .querySelectorAll('link[rel="stylesheet"]')
        .forEach((link) => {
          const href = link.getAttribute('href') ?? '';
          if (!/^https?:/i.test(href)) link.remove();
        });
      const style = doc.createElement('style');
      style.textContent = css;
      doc.head.appendChild(style);
    }
  }

  // Anything still relative belongs to the client's existing asset origin.
  if (template.assetOrigin) {
    const origin = template.assetOrigin.replace(/\/+$/, '');
    doc.querySelectorAll('[src], [href]').forEach((el) => {
      (['src', 'href'] as const).forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        if (/^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(value)) return;
        el.setAttribute(attr, `${origin}/${value.replace(/^\.?\//, '')}`);
      });
    });
  }

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

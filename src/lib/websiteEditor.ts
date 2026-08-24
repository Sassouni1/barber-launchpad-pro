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

/**
 * Optional per-field overrides. Keys are either a structural field key or a
 * CSS selector prefixed with `@` (matched at scan time).
 */
export type FieldRule = {
  limit?: number;
  width?: number;
  height?: number;
  locked?: boolean;
  /**
   * Treats every narrative paragraph inside the matched container as ONE
   * editable block (blank lines separate paragraphs in the textarea).
   */
  group?: boolean;
  /** Selector for paragraphs inside the container that stay standalone. */
  groupExclude?: string;
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

/**
 * Grouped narrative blocks are stored under a prefixed key so they can be told
 * apart from single-element fields.
 */
export const GROUP_PREFIX = 'group:';

export const isGroupKey = (key: string) => key.startsWith(GROUP_PREFIX);

export function elementFromKey(root: Document | HTMLElement, key: string): Element | null {
  const path = isGroupKey(key) ? key.slice(GROUP_PREFIX.length) : key;
  let node: Element | null = 'body' in root ? root.body : root;
  if (!node) return null;
  if (path === '') return node;
  for (const part of path.split('.')) {
    const index = Number(part);
    if (!node || Number.isNaN(index)) return null;
    node = node.children[index] ?? null;
  }
  return node;
}

/** Paragraph nodes that make up one continuous narrative block. */
export function narrativeParagraphs(container: Element, exclude?: string): Element[] {
  return Array.from(container.querySelectorAll('p')).filter((p) => {
    if (p.classList.contains('sf-kicker')) return false;
    if (exclude && p.matches(exclude)) return false;
    if (p.querySelector('img')) return false;
    if (p.closest('[data-we-overlay]')) return false;
    return (p.textContent ?? '').trim().length > 0;
  });
}

type NarrativeGroup = { container: Element; key: string; paragraphs: Element[]; rule: FieldRule };

/** Resolves every configured narrative group present in the document. */
export function collectGroups(
  root: Document | HTMLElement,
  rules: Record<string, FieldRule> = {},
): NarrativeGroup[] {
  const scope: ParentNode = 'body' in root ? (root.body as ParentNode) : root;
  const groups: NarrativeGroup[] = [];
  const seen = new Set<Element>();

  Object.entries(rules).forEach(([ruleKey, rule]) => {
    if (!rule?.group) return;
    const containers: Element[] = ruleKey.startsWith('@')
      ? Array.from(scope.querySelectorAll(ruleKey.slice(1)))
      : [elementFromKey(root, ruleKey)].filter((el): el is Element => !!el);

    containers.forEach((container) => {
      if (seen.has(container)) return;
      const paragraphs = narrativeParagraphs(container, rule.groupExclude);
      // A single paragraph is not a narrative block — leave it as a normal field.
      if (paragraphs.length < 2) return;
      seen.add(container);
      groups.push({ container, key: `${GROUP_PREFIX}${elementKey(container)}`, paragraphs, rule });
    });
  });

  return groups;
}

/** Reads a group's current text with blank lines between paragraphs. */
function groupText(paragraphs: Element[]): string {
  return paragraphs.map((p) => (p.textContent ?? '').replace(/\s+/g, ' ').trim()).join('\n\n');
}

/** Writes into the innermost styled wrapper so formatting is preserved. */
function setParagraphText(p: Element, text: string) {
  let target: Element = p;
  while (
    target.children.length === 1 &&
    (target.textContent ?? '').trim() === (target.children[0].textContent ?? '').trim()
  ) {
    target = target.children[0];
  }
  target.textContent = text;
}

/**
 * Applies an edited narrative block back onto its paragraphs, keeping the
 * original markup/styling and adding or removing paragraphs as needed.
 */
export function applyGroupValue(container: Element, value: string, exclude?: string) {
  const paragraphs = narrativeParagraphs(container, exclude);
  if (!paragraphs.length) return;
  const parts = value
    .split(/\n\s*\n/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!parts.length) return;

  parts.forEach((text, index) => {
    const existing = paragraphs[index];
    if (existing) {
      setParagraphText(existing, text);
      return;
    }
    const last = paragraphs[paragraphs.length - 1];
    const clone = last.cloneNode(true) as Element;
    setParagraphText(clone, text);
    last.parentElement?.insertBefore(clone, last.nextSibling);
    paragraphs.push(clone);
  });

  paragraphs.slice(parts.length).forEach((p) => p.remove());
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
    // Editor-only overlay controls are never editable content.
    if (el.closest('[data-we-overlay]')) return;
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
    // A placeholder keeps the group's exact position among any sibling markup.
    const anchor = container.ownerDocument.createComment('we-items');
    if (current[0]) container.insertBefore(anchor, current[0]);
    else container.appendChild(anchor);
    current.forEach((el) => el.remove());

    finalOrder.forEach((sourceIndex, position) => {
      const clone = pristine[sourceIndex].cloneNode(true) as Element;
      clone.setAttribute(ITEM_ATTR, rule.key);
      clone.setAttribute(ITEM_POS_ATTR, String(position));
      container.insertBefore(clone, anchor);
    });
    anchor.remove();
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

export const ITEM_ACTIVE_ATTR = 'data-we-item-active';
/** Editor-only floating duplicate control rendered on each repeatable card. */
export const OVERLAY_ATTR = 'data-we-overlay';

export const EDITOR_CSS = `
[data-we-editable]{outline:1px dashed rgba(212,175,55,.55);outline-offset:2px;cursor:pointer;transition:outline-color .15s ease,background-color .15s ease}
[data-we-editable]:hover{outline:2px solid rgba(212,175,55,.95);background-color:rgba(212,175,55,.10)}
[data-we-selected]{outline:3px solid #d4af37 !important;background-color:rgba(212,175,55,.16)}
[data-we-item]{cursor:pointer;position:relative}
[data-we-item-active]{outline:3px solid #d4af37 !important;outline-offset:6px;background-color:rgba(212,175,55,.06)}
[${OVERLAY_ATTR}]{position:absolute;top:6px;z-index:2147483000;display:flex;align-items:center;justify-content:center;width:36px;height:36px;min-width:36px;min-height:36px;padding:0;margin:0;border:1px solid rgba(212,175,55,.9);border-radius:8px;background:rgba(12,12,12,.92);color:#d4af37;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s ease;box-shadow:0 2px 8px rgba(0,0,0,.35);line-height:0}
[${OVERLAY_ATTR}="duplicate"]{right:6px}
[${OVERLAY_ATTR}="delete"]{right:48px;border-color:rgba(220,80,70,.9);color:#ff6b60}
[${OVERLAY_ATTR}] svg{width:18px;height:18px;display:block;pointer-events:none}
[data-we-item]:hover > [${OVERLAY_ATTR}],
[data-we-item]:focus-within > [${OVERLAY_ATTR}],
[${ITEM_ACTIVE_ATTR}] > [${OVERLAY_ATTR}],
[${OVERLAY_ATTR}]:focus{opacity:1;pointer-events:auto}
[${OVERLAY_ATTR}="duplicate"]:hover{background:#d4af37;color:#0c0c0c}
[${OVERLAY_ATTR}="delete"]:hover{background:#c0392b;color:#fff;border-color:#c0392b}
@media (hover:none){[data-we-item] > [${OVERLAY_ATTR}]{opacity:.85;pointer-events:auto}}
`;

const COPY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';

const TRASH_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';

/**
 * Adds the editor-only duplicate/delete overlay to each configured repeatable
 * card. Called after fields are scanned so overlays never become editable
 * fields. Delete is only offered while more than one item remains in the group,
 * so a card group can never be emptied from the overlay.
 */
export function decorateItems(doc: Document, rules: RepeatRule[]) {
  const labels = new Map(rules.map((rule) => [rule.key, rule.label]));
  const counts = new Map<string, number>();
  doc.querySelectorAll(`[${ITEM_ATTR}]`).forEach((item) => {
    const ruleKey = item.getAttribute(ITEM_ATTR) ?? '';
    counts.set(ruleKey, (counts.get(ruleKey) ?? 0) + 1);
  });

  doc.querySelectorAll(`[${ITEM_ATTR}]`).forEach((item) => {
    item.querySelectorAll(`[${OVERLAY_ATTR}]`).forEach((el) => el.remove());
    const ruleKey = item.getAttribute(ITEM_ATTR) ?? '';
    const label = labels.get(ruleKey);
    if (!label) return;

    const makeButton = (action: 'duplicate' | 'delete', verb: string, icon: string) => {
      const button = doc.createElement('button');
      button.setAttribute('type', 'button');
      button.setAttribute(OVERLAY_ATTR, action);
      button.setAttribute('aria-label', `${verb} ${label}`);
      button.setAttribute('title', `${verb} ${label}`);
      button.innerHTML = icon;
      item.appendChild(button);
    };

    makeButton('duplicate', 'Duplicate', COPY_ICON_SVG);
    // Never allow the last remaining card in a group to be removed.
    if ((counts.get(ruleKey) ?? 0) > 1) makeButton('delete', 'Delete', TRASH_ICON_SVG);
  });
}


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
  doc.querySelectorAll(`[${ITEM_ACTIVE_ATTR}]`).forEach((el) => el.removeAttribute(ITEM_ACTIVE_ATTR));
  if (!key) return;
  const el = elementFromKey(doc, key);
  if (el) {
    el.setAttribute('data-we-selected', 'true');
    // Outline the whole repeatable card so its actions are obviously available.
    const item = el.closest(`[${ITEM_ATTR}]`);
    if (item) item.setAttribute(ITEM_ACTIVE_ATTR, 'true');
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
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
  // Structure first (duplicated / reordered cards), then the member's content.
  applyLayout(doc, template.repeatRules ?? [], readLayout(draft));
  applyDraft(doc, draft);

  // Editor-only markup never ships.
  doc.querySelectorAll(`[${OVERLAY_ATTR}]`).forEach((el) => el.remove());
  doc.querySelectorAll('[data-we-editable]').forEach((el) => el.removeAttribute('data-we-editable'));
  doc.querySelectorAll('[data-we-selected]').forEach((el) => el.removeAttribute('data-we-selected'));
  doc.querySelectorAll(`[${ITEM_ATTR}]`).forEach((el) => {
    el.removeAttribute(ITEM_ATTR);
    el.removeAttribute(ITEM_POS_ATTR);
  });
  doc.querySelectorAll(`[${ITEM_ACTIVE_ATTR}]`).forEach((el) => el.removeAttribute(ITEM_ACTIVE_ATTR));

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

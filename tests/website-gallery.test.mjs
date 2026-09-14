/**
 * Regression coverage for the member photo-gallery editor: add (duplicate +
 * upload), reorder, remove, draft serialization, and the published render.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/lib/websiteEditor.ts', import.meta.url), 'utf8');
// Drop the publish renderer's browser-only fetch/DOMParser tail helpers by
// evaluating the module in a DOM-backed sandbox instead of stubbing them out.
const dom = new JSDOM(readFileSync(new URL('../public/stay-faded/home.html', import.meta.url), 'utf8'));
const context = vm.createContext({
  exports: {},
  window: dom.window,
  document: dom.window.document,
  Node: dom.window.Node,
  Element: dom.window.Element,
  HTMLElement: dom.window.HTMLElement,
  DOMParser: dom.window.DOMParser,
  fetch: async () => {
    throw new Error('network disabled in tests');
  },
  console,
});
vm.runInContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS }), context);
const {
  ALT_SUFFIX,
  applyDraft,
  applyItemPlan,
  applyLayout,
  copyPlan,
  currentOrder,
  galleryPhotos,
  readLayout,
  removePlan,
  swapPlan,
} = context.exports;

const rule = {
  key: 'gallery',
  label: 'photo',
  container: '.sf-photo-gallery-grid',
  item: '.sf-photo-gallery-card',
  max: 24,
  gallery: true,
  shareAnchor: 'inside-stay-faded',
  dropClasses: ['sf-photo-owner', 'sf-photo-location'],
};
const rules = [rule];
const doc = dom.window.document;

let originals = applyLayout(doc, rules, {}, {});
let draft = {};

// --- baseline -------------------------------------------------------------
let photos = galleryPhotos(doc, rule, draft);
assert.equal(photos.length, 9, 'the nine existing photos are preserved');
const baselineSources = photos.map((p) => p.src);

// The CSS order pins must be gone so the member's arrangement wins on mobile.
assert.equal(doc.querySelectorAll('.sf-photo-owner, .sf-photo-location').length, 0);

// --- add ------------------------------------------------------------------
const order0 = currentOrder(readLayout(draft), rule.key, originals[rule.key].length);
let plan = copyPlan(order0, order0.length - 1);
let applied = applyItemPlan(doc, rules, rule, draft, plan, originals);
draft = applied.pageDraft;
originals = applied.originals;
const created = galleryPhotos(doc, rule, draft)[plan.nextPosition];
draft = {
  ...draft,
  [created.imageKey]: 'https://example.test/new-photo.jpg',
  [`${created.imageKey}${ALT_SUFFIX}`]: 'A brand new gallery photo',
};
applyDraft(doc, draft, {});
photos = galleryPhotos(doc, rule, draft);
assert.equal(photos.length, 10, 'uploading adds one card');
assert.equal(photos[9].src, 'https://example.test/new-photo.jpg');
assert.equal(photos[9].alt, 'A brand new gallery photo');
const newImg = doc.querySelectorAll('.sf-photo-gallery-card img')[9];
assert.equal(newImg.getAttribute('src'), 'https://example.test/new-photo.jpg', 'lightbox source follows the card');
assert.match(
  newImg.closest('button').getAttribute('aria-label'),
  /A brand new gallery photo/,
  'the lightbox trigger describes the new photo',
);
assert.deepEqual(
  photos.slice(0, 9).map((p) => p.src),
  baselineSources,
  'existing photos are untouched',
);

// --- reorder --------------------------------------------------------------
const orderBefore = currentOrder(readLayout(draft), rule.key, originals[rule.key].length);
plan = swapPlan(orderBefore, 9, 8);
applied = applyItemPlan(doc, rules, rule, draft, plan, originals);
draft = applied.pageDraft;
originals = applied.originals;
applyDraft(doc, draft, {});
photos = galleryPhotos(doc, rule, draft);
assert.equal(photos[8].src, 'https://example.test/new-photo.jpg', 'the photo moved earlier');
assert.equal(photos[8].alt, 'A brand new gallery photo', 'its description moved with it');
assert.equal(photos.length, 10);

// --- draft serialization --------------------------------------------------
const serialized = JSON.parse(JSON.stringify(draft));
assert.deepEqual(readLayout(serialized).gallery, readLayout(draft).gallery);
assert.equal(readLayout(serialized).gallery.length, 10, 'the layout survives a save/load round trip');
assert.ok(
  Object.keys(serialized).some((key) => key.endsWith(ALT_SUFFIX)),
  'photo descriptions are stored in the draft',
);

// --- remove ---------------------------------------------------------------
const orderNow = currentOrder(readLayout(draft), rule.key, originals[rule.key].length);
plan = removePlan(orderNow, 8);
applied = applyItemPlan(doc, rules, rule, draft, plan, originals);
draft = applied.pageDraft;
originals = applied.originals;
applyDraft(doc, draft, {});
photos = galleryPhotos(doc, rule, draft);
assert.equal(photos.length, 9, 'removing drops exactly one card');
assert.ok(!photos.some((p) => p.src.includes('new-photo')), 'the removed photo is gone');
assert.deepEqual(photos.map((p) => p.src), baselineSources, 'the original nine survive intact');

// --- publish render -------------------------------------------------------
const publishDom = new JSDOM(readFileSync(new URL('../public/stay-faded/home.html', import.meta.url), 'utf8'));
const publishDoc = publishDom.window.document;
applyLayout(publishDoc, rules, readLayout(draft), {});
applyDraft(publishDoc, draft, {});
const published = publishDoc.querySelectorAll('.sf-photo-gallery-card');
assert.equal(published.length, 9, 'published HTML matches the member layout');
assert.equal(publishDoc.querySelectorAll('.sf-photo-owner, .sf-photo-location').length, 0);

console.log('PASS: gallery add, reorder, remove, draft serialization and publish render.');

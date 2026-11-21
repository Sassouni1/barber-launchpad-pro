import { test, expect } from 'bun:test';
import { revealScrollDelta } from '../src/lib/revealInScroll';

test('opening Get Support at the bottom scrolls just enough to show the whole submenu', () => {
  // menu area 0..700, Get Support row at 650, submenu ends at 800
  expect(revealScrollDelta({ top: 0, bottom: 700 }, { top: 650, bottom: 800 })).toBe(108);
});

test('never scrolls the Get Support row itself out of view', () => {
  expect(revealScrollDelta({ top: 0, bottom: 300 }, { top: 100, bottom: 900 })).toBe(92);
});

test('no scroll when the submenu is already visible', () => {
  expect(revealScrollDelta({ top: 0, bottom: 700 }, { top: 300, bottom: 450 })).toBe(0);
});

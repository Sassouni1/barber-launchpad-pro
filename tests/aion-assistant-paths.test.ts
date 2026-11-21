import { test, expect } from 'bun:test';
import { isAionAssistantPath } from '../src/lib/aionAssistantPaths';

test('floating Aion never appears on the Message Support page', () => {
  expect(isAionAssistantPath('/support')).toBe(false);
  expect(isAionAssistantPath('/support/anything')).toBe(false);
});

test('floating Aion still appears on member pages like the dashboard', () => {
  expect(isAionAssistantPath('/dashboard')).toBe(true);
  expect(isAionAssistantPath('/courses/abc')).toBe(true);
});

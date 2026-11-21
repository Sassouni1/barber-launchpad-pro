import { test, expect } from 'bun:test';
import { countOwnUnreadSupportReplies, fetchOwnSupportConversationId, supportReplyNoticeText, type SupportUnreadDb } from '../src/lib/supportUnread';

function fakeDb(result: { data?: unknown; count?: number }) {
  const calls: { table: string; ops: [string, ...unknown[]][] }[] = [];
  const db: SupportUnreadDb = {
    from(table: string) {
      const entry = { table, ops: [] as [string, ...unknown[]][] };
      calls.push(entry);
      const b: any = {
        select: (...a: unknown[]) => (entry.ops.push(['select', ...a]), b),
        eq: (c: string, v: unknown) => (entry.ops.push(['eq', c, v]), b),
        neq: (c: string, v: unknown) => (entry.ops.push(['neq', c, v]), b),
        is: (c: string, v: unknown) => (entry.ops.push(['is', c, v]), b),
        maybeSingle: async () => ({ data: result.data ?? null, error: null }),
        then: (res: (v: unknown) => unknown) => Promise.resolve({ count: result.count ?? 0, error: null }).then(res),
      };
      return b;
    },
  };
  return { db, calls };
}

test('conversation lookup is scoped to the signed-in user (admins never get another member)', async () => {
  const { db, calls } = fakeDb({ data: { id: 'conv-own' } });
  expect(await fetchOwnSupportConversationId(db, 'user-1')).toBe('conv-own');
  expect(calls[0].table).toBe('support_conversations');
  expect(calls[0].ops).toContainEqual(['eq', 'member_id', 'user-1']);
});

test('unread count only covers the own conversation, team-sent, unread, not unsent', async () => {
  const { db, calls } = fakeDb({ count: 2 });
  expect(await countOwnUnreadSupportReplies(db, 'user-1', 'conv-own')).toBe(2);
  expect(calls[0].table).toBe('support_messages');
  expect(calls[0].ops).toContainEqual(['eq', 'conversation_id', 'conv-own']);
  expect(calls[0].ops).toContainEqual(['neq', 'sender_id', 'user-1']);
  expect(calls[0].ops).toContainEqual(['is', 'read_by_member_at', null]);
  expect(calls[0].ops).toContainEqual(['is', 'deleted_at', null]);
});

test('no own conversation means zero and no message query at all', async () => {
  const { db, calls } = fakeDb({ count: 99 });
  expect(await countOwnUnreadSupportReplies(db, 'admin-1', null)).toBe(0);
  expect(calls.length).toBe(0);
});

test('notice copy pluralizes with the unread count', () => {
  expect(supportReplyNoticeText(1)).toEqual({ title: 'Barber Launch Support replied to you', countLabel: '1 unread reply' });
  expect(supportReplyNoticeText(3).countLabel).toBe('3 unread replies');
  expect(supportReplyNoticeText(3).title).not.toBe(supportReplyNoticeText(1).title);
});

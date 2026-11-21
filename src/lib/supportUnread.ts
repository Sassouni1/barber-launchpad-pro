// Unread Barber Launch team replies in the signed-in user's OWN support conversation.
// Scoped explicitly by member_id = user and that conversation's id, so admins (whose
// row-level access covers every conversation) never see other members' counts.

type Builder = {
  select: (...args: unknown[]) => Builder;
  eq: (col: string, val: unknown) => Builder;
  neq: (col: string, val: unknown) => Builder;
  is: (col: string, val: unknown) => Builder;
  maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
} & PromiseLike<{ count?: number | null; error: unknown }>;

export type SupportUnreadDb = { from: (table: string) => Builder };

/** The user's own conversation id, or null. Read-only: never creates a conversation. */
export async function fetchOwnSupportConversationId(db: SupportUnreadDb, userId: string): Promise<string | null> {
  const { data, error } = await db.from('support_conversations').select('id').eq('member_id', userId).maybeSingle();
  if (error) throw error;
  return (data as { id?: string } | null)?.id ?? null;
}

/** Team replies in that conversation that the member hasn't read and that weren't unsent. */
export async function countOwnUnreadSupportReplies(db: SupportUnreadDb, userId: string, conversationId: string | null): Promise<number> {
  if (!conversationId) return 0;
  const { count, error } = await db
    .from('support_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_by_member_at', null)
    .is('deleted_at', null);
  if (error) throw error;
  return count || 0;
}

export function supportReplyNoticeText(count: number) {
  return {
    title: count === 1 ? 'Barber Launch Support replied to you' : 'Barber Launch Support sent you new replies',
    countLabel: count === 1 ? '1 unread reply' : `${count} unread replies`,
  };
}

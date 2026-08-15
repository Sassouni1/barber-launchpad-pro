import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SupportThread } from '@/components/support/SupportThread';
import { useSupportMessages, type SupportConversation } from '@/hooks/useSupportMessages';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type MemberProfile = { id: string; full_name: string | null; email: string | null };
const supportDb = supabase as any;

function useSupportInbox() {
  return useQuery({
    queryKey: ['support-conversations'],
    queryFn: async () => {
      const { data: conversations, error } = await supportDb
        .from('support_conversations')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const typedConversations = (conversations || []) as SupportConversation[];
      const memberIds = typedConversations.map((conversation) => conversation.member_id);
      if (!memberIds.length) return [] as Array<SupportConversation & { member: MemberProfile | null }>;
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberIds);
      if (membersError) throw membersError;
      const memberById = new Map((members || []).map((member) => [member.id, member as MemberProfile]));
      return typedConversations.map((conversation) => ({ ...conversation, member: memberById.get(conversation.member_id) || null }));
    },
  });
}

function InboxPreview({ conversation, selected, onSelect }: { conversation: SupportConversation & { member: MemberProfile | null }; selected: boolean; onSelect: () => void }) {
  const { data: messages = [] } = useSupportMessages(conversation.id);
  const lastMessage = messages.at(-1);
  const unread = messages.filter((message) => message.sender_id === conversation.member_id && !message.read_by_admin_at).length;
  const name = conversation.member?.full_name || conversation.member?.email || 'Member';

  return (
    <button onClick={onSelect} className={cn('w-full border-b border-border px-4 py-4 text-left transition-colors', selected ? 'bg-primary/10' : 'hover:bg-secondary/50')}>
      <div className="flex items-center gap-2"><span className="min-w-0 flex-1 truncate font-medium">{name}</span>{unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">{unread}</span>}</div>
      <p className="mt-1 truncate text-xs text-muted-foreground">{lastMessage?.body || 'No messages yet'}</p>
    </button>
  );
}

export default function SupportInbox() {
  const { data: conversations = [], isLoading } = useSupportInbox();
  const [activeId, setActiveId] = useState<string>();
  const active = useMemo(() => conversations.find((conversation) => conversation.id === activeId) || conversations[0], [activeId, conversations]);

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  return (
    <DashboardLayout isAdminView>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3"><MessageSquare className="h-7 w-7 text-primary" /><div><h1 className="font-display text-3xl font-semibold">Member Support</h1><p className="text-sm text-muted-foreground">Private messages from Barber Launch members.</p></div></div>
        {isLoading ? <div className="flex h-80 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading inbox…</div> : conversations.length === 0 ? <div className="rounded-2xl border border-border p-10 text-center text-muted-foreground">Member support conversations will appear here.</div> : (
          <div className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="max-h-[70vh] overflow-y-auto border-b border-border md:border-b-0 md:border-r">{conversations.map((conversation) => <InboxPreview key={conversation.id} conversation={conversation} selected={conversation.id === active?.id} onSelect={() => setActiveId(conversation.id)} />)}</aside>
            <div className="min-w-0">{active && <SupportThread conversationId={active.id} title={active.member?.full_name || active.member?.email || 'Member'} participantName={active.member?.full_name || active.member?.email || 'Member'} description="Private conversation. You are replying as Barber Launch." />}</div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

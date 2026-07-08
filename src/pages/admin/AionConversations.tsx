import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Loader2, MessageSquare, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

type Convo = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  email: string | null;
  message_count: number;
};

type Msg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
};

export default function AionConversations() {
  const [loading, setLoading] = useState(true);
  const [convos, setConvos] = useState<Convo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: convs } = await supabase
        .from('aion_conversations')
        .select('id, user_id, title, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (!convs) { setLoading(false); return; }

      const userIds = Array.from(new Set(convs.map(c => c.user_id)));
      const convIds = convs.map(c => c.id);

      const [{ data: profiles }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email').in('id', userIds),
        supabase.from('aion_messages').select('conversation_id').in('conversation_id', convIds),
      ]);

      const profMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const countMap = new Map<string, number>();
      (msgs || []).forEach((m: any) => {
        countMap.set(m.conversation_id, (countMap.get(m.conversation_id) || 0) + 1);
      });

      const merged: Convo[] = convs.map((c: any) => {
        const p: any = profMap.get(c.user_id);
        return {
          ...c,
          full_name: p?.full_name || null,
          email: p?.email || null,
          message_count: countMap.get(c.id) || 0,
        };
      });

      setConvos(merged);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setMsgsLoading(true);
    supabase
      .from('aion_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages((data as Msg[]) || []);
        setMsgsLoading(false);
      });
  }, [activeId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return convos;
    return convos.filter(c =>
      (c.full_name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.title || '').toLowerCase().includes(q)
    );
  }, [convos, search]);

  const active = convos.find(c => c.id === activeId) || null;

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-7xl mx-auto space-y-4">
        <div>
          <h1 className="font-display text-4xl font-bold mb-2 flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" /> Aion Conversations
          </h1>
          <p className="text-muted-foreground">All member chats with Aion.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-16rem)]">
          {/* List */}
          <div className="glass-card rounded-2xl border-primary/10 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name, email, title…"
                  className="pl-9"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {loading ? 'Loading…' : `${filtered.length} conversation${filtered.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (
                <div className="p-2 space-y-1">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setActiveId(c.id)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg transition-all',
                        activeId === c.id ? 'bg-primary/10' : 'hover:bg-secondary/50'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium truncate">
                          {c.full_name || c.email || 'Unknown user'}
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> {c.message_count}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {format(new Date(c.updated_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Thread */}
          <div className="glass-card rounded-2xl border-primary/10 flex flex-col overflow-hidden">
            {active ? (
              <>
                <div className="p-4 border-b border-border/50">
                  <p className="font-semibold text-sm">{active.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{active.email}</p>
                  <p className="text-xs text-muted-foreground mt-1">{active.title}</p>
                </div>
                <ScrollArea className="flex-1 p-4">
                  {msgsLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-10">No messages in this conversation.</p>
                  ) : (
                    <div className="space-y-4">
                      {messages.map(m => (
                        <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {m.role === 'assistant' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className={cn(
                            'rounded-xl px-4 py-2.5 max-w-[75%] text-sm',
                            m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-foreground'
                          )}>
                            {m.role === 'assistant' ? (
                              <div className="prose prose-sm prose-invert max-w-none [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                                <ReactMarkdown>{m.content}</ReactMarkdown>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{m.content}</div>
                            )}
                            <p className={cn(
                              'text-[10px] mt-1.5 opacity-60',
                              m.role === 'user' ? 'text-primary-foreground' : 'text-muted-foreground'
                            )}>
                              {format(new Date(m.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                          {m.role === 'user' && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                              <User className="w-4 h-4 text-secondary-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                Select a conversation to view messages.
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

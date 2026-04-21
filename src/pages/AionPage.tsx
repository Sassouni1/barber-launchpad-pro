import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AionChat } from '@/components/dashboard/AionChat';
import { useAionConversations, useAionMessages } from '@/hooks/useAionChat';
import { Bot, Plus, Trash2, MessageSquare, Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function AionPage() {
  const location = useLocation();
  const initialMessage = (location.state as any)?.initialMessage as string | undefined;

  const { conversations, isLoading: convsLoading, createConversation, deleteConversation, updateTitle } = useAionConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingInitial, setPendingInitial] = useState(initialMessage);

  const { data: dbMessages = [], isLoading: msgsLoading } = useAionMessages(activeId);

  // Auto-select first conversation or create one
  useEffect(() => {
    if (convsLoading) return;
    if (conversations.length > 0 && !activeId) {
      // If we have an initial message, create a new conversation
      if (pendingInitial) {
        handleNewChat();
      } else {
        setActiveId(conversations[0].id);
      }
    } else if (conversations.length === 0 && !convsLoading) {
      handleNewChat();
    }
  }, [conversations, convsLoading]);

  const handleNewChat = useCallback(async () => {
    try {
      const conv = await createConversation.mutateAsync('New Chat');
      setActiveId(conv.id);
    } catch { /* ignore */ }
  }, [createConversation]);

  const handleDelete = async (id: string) => {
    try {
      await deleteConversation.mutateAsync(id);
      if (activeId === id) {
        const remaining = conversations.filter(c => c.id !== id);
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch { /* ignore */ }
  };

  // Auto-title conversation based on first user message
  const handleFirstUserMessage = useCallback(async (text: string) => {
    if (!activeId) return;
    const title = text.length > 40 ? text.slice(0, 40) + '…' : text;
    try {
      await updateTitle.mutateAsync({ id: activeId, title });
    } catch { /* ignore */ }
  }, [activeId, updateTitle]);

  const chatMessages = dbMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto flex h-[calc(100vh-8rem)] gap-4">
        {/* Conversation sidebar */}
        <div className="hidden md:flex flex-col w-72 glass-card rounded-2xl border-primary/10 overflow-hidden">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <span className="font-display font-semibold text-sm">Aion Chats</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => { setPendingInitial(undefined); handleNewChat(); }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {convsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No conversations yet
                </div>
              ) : (
                conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer group transition-all',
                      activeId === conv.id
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                    )}
                    onClick={() => { setPendingInitial(undefined); setActiveId(conv.id); }}
                  >
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(conv.updated_at), 'MMM d')}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile conversation picker */}
          <div className="md:hidden flex items-center gap-2 mb-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Menu className="w-4 h-4" /> Chats
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-border/50">
                  <SheetTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" /> Aion Chats
                  </SheetTitle>
                </SheetHeader>
                <div className="p-3 border-b border-border/50">
                  <Button
                    size="sm"
                    className="w-full gap-1 gold-gradient"
                    onClick={() => { setPendingInitial(undefined); handleNewChat(); }}
                  >
                    <Plus className="w-4 h-4" /> New Chat
                  </Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-2 space-y-1">
                    {conversations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">No conversations yet</div>
                    ) : (
                      conversations.map(conv => (
                        <div
                          key={conv.id}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer group transition-all',
                            activeId === conv.id
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                          )}
                          onClick={() => { setPendingInitial(undefined); setActiveId(conv.id); }}
                        >
                          <MessageSquare className="w-4 h-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{conv.title}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(conv.updated_at), 'MMM d')}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(conv.id); }}
                            className="opacity-60 hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setPendingInitial(undefined); handleNewChat(); }}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> New
            </Button>
            <span className="text-sm text-muted-foreground truncate flex-1">
              {conversations.find(c => c.id === activeId)?.title || 'New Chat'}
            </span>
          </div>

          <div className="glass-card rounded-2xl border-primary/10 p-6 flex-1 min-h-0 flex flex-col">
            {activeId ? (
              msgsLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <AionChat
                  key={activeId}
                  conversationId={activeId}
                  initialMessages={chatMessages.length > 0 ? chatMessages : undefined}
                  initialMessage={pendingInitial}
                  onInitialSent={() => setPendingInitial(undefined)}
                  onFirstUserMessage={handleFirstUserMessage}
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-3">
                  <Bot className="w-12 h-12 mx-auto opacity-50" />
                  <p>Start a new chat with Aion</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

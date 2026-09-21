import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, ExternalLink, Loader2, MessageSquarePlus, Minus, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AionChat } from '@/components/dashboard/AionChat';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAionConversations, useAionMessages } from '@/hooks/useAionChat';
import { useAuth } from '@/hooks/useAuth';

type AssistantState = 'closed' | 'minimized' | 'open';

const MEMBER_PATHS = [
  '/dashboard',
  '/courses',
  '/todos',
  '/products',
  '/training',
  '/schedule-call',
  '/orders',
  '/marketing',
  '/social-media-post',
  '/support',
  '/ads',
  '/website',
  '/affiliates',
  '/content-rewards',
  '/rewards',
  '/checklist',
  '/business-card',
  '/my-links',
];

const STATE_KEY = 'aion-floating-state';
const CONVERSATION_KEY = 'aion-floating-conversation';

function readState(): AssistantState {
  if (typeof window === 'undefined') return 'closed';
  const saved = window.localStorage.getItem(STATE_KEY);
  return saved === 'open' || saved === 'minimized' ? saved : 'closed';
}

export function AionFloatingAssistant() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading, isManufacturer } = useAuth();
  const { conversations, isLoading: conversationsLoading, createConversation, updateTitle } = useAionConversations();
  const [panelState, setPanelState] = useState<AssistantState>(readState);
  const [activeId, setActiveId] = useState<string | null>(() => (
    typeof window === 'undefined' ? null : window.localStorage.getItem(CONVERSATION_KEY)
  ));
  const [isStarting, setIsStarting] = useState(false);
  const { data: dbMessages = [], isLoading: messagesLoading } = useAionMessages(activeId);

  const isMemberPath = MEMBER_PATHS.some((path) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  ));
  const shouldRender = Boolean(
    !authLoading && user && !isManufacturer && isMemberPath && location.pathname !== '/aion'
  );

  const setPersistentState = useCallback((next: AssistantState) => {
    setPanelState(next);
    window.localStorage.setItem(STATE_KEY, next);
  }, []);

  const startConversation = useCallback(async () => {
    if (isStarting) return null;
    setIsStarting(true);
    try {
      const conversation = await createConversation.mutateAsync('New Chat');
      setActiveId(conversation.id);
      window.localStorage.setItem(CONVERSATION_KEY, conversation.id);
      return conversation.id;
    } catch {
      return null;
    } finally {
      setIsStarting(false);
    }
  }, [createConversation, isStarting]);

  useEffect(() => {
    if (conversationsLoading) return;
    const savedExists = activeId && conversations.some((conversation) => conversation.id === activeId);
    if (savedExists) return;

    const latest = conversations[0];
    if (latest) {
      setActiveId(latest.id);
      window.localStorage.setItem(CONVERSATION_KEY, latest.id);
    } else {
      setActiveId(null);
      window.localStorage.removeItem(CONVERSATION_KEY);
    }
  }, [activeId, conversations, conversationsLoading]);

  useEffect(() => {
    if (panelState !== 'open' || conversationsLoading || activeId || conversations.length > 0) return;
    void startConversation();
  }, [activeId, conversations.length, conversationsLoading, panelState, startConversation]);

  const chatMessages = useMemo(() => dbMessages.map((message) => ({
    role: message.role,
    content: message.content,
    messageType: message.message_type === 'image' ? 'image' as const : 'text' as const,
    metadata: (message.metadata || {}) as Record<string, unknown>,
  })), [dbMessages]);

  const handleFirstUserMessage = useCallback(async (text: string) => {
    if (!activeId) return;
    const title = text.length > 40 ? `${text.slice(0, 40)}…` : text;
    try {
      await updateTitle.mutateAsync({ id: activeId, title });
    } catch {
      // The conversation and messages still remain available if a title update fails.
    }
  }, [activeId, updateTitle]);

  const openAssistant = async () => {
    setPersistentState('open');
    if (!conversationsLoading && !activeId && conversations.length === 0) {
      await startConversation();
    }
  };

  if (!shouldRender) return null;

  return (
    <aside className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex flex-col items-end px-3 sm:inset-x-auto sm:right-5 sm:px-0" aria-label="Aion assistant">
      {panelState === 'open' && (
        <section
          className="pointer-events-auto mb-3 flex h-[min(68vh,480px)] w-full flex-col overflow-hidden rounded-lg border border-primary/30 bg-background shadow-2xl sm:h-[560px] sm:w-[380px]"
          aria-label="Chat with Aion"
        >
          <header className="flex h-14 flex-shrink-0 items-center gap-1.5 border-b border-border/70 bg-card px-2 min-[360px]:gap-3 min-[360px]:px-3">
            <div className="flex size-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/40 bg-primary/10 min-[360px]:size-9">
              <img src="/icons/barber-launch-maskable.png" alt="" className="size-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-semibold text-foreground">Aion</h2>
              <p className="hidden truncate text-xs text-muted-foreground min-[360px]:block">Barber Launch assistant</p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 min-[360px]:size-9" onClick={() => void startConversation()} disabled={isStarting} aria-label="Start a new Aion chat">
                  {isStarting ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>New chat</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 min-[360px]:size-9" onClick={() => setPersistentState('minimized')} aria-label="Minimize Aion">
                  <Minus />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Minimize</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8 min-[360px]:size-9" onClick={() => setPersistentState('closed')} aria-label="Close Aion">
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </header>

          <div className="min-h-0 flex-1 p-3">
            {conversationsLoading || messagesLoading || isStarting || !activeId ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin text-primary" /> Opening Aion…
              </div>
            ) : (
              <AionChat
                key={activeId}
                conversationId={activeId}
                initialMessages={chatMessages.length > 0 ? chatMessages : undefined}
                onFirstUserMessage={handleFirstUserMessage}
              />
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/aion')}
            className="h-9 flex-shrink-0 rounded-none border-t border-border/70 bg-card text-xs text-muted-foreground hover:bg-card hover:text-primary"
          >
            Open full Aion <ExternalLink className="size-3.5" aria-hidden="true" />
          </Button>
        </section>
      )}

      {panelState === 'minimized' && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void openAssistant()}
          className="pointer-events-auto mb-3 h-11 rounded-full border-primary/30 bg-card px-3 text-foreground shadow-xl hover:border-primary/60 hover:bg-card"
          aria-label="Restore Aion assistant"
        >
          <Bot className="size-4 text-primary" aria-hidden="true" />
          Aion minimized
        </Button>
      )}

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            onClick={() => void openAssistant()}
            className="pointer-events-auto size-14 overflow-hidden rounded-full border border-primary/60 bg-card p-0 shadow-xl transition-transform hover:scale-105"
            aria-label={panelState === 'open' ? 'Aion is open' : 'Open Aion assistant'}
          >
            <img src="/icons/barber-launch-maskable.png" alt="" className="size-full object-cover" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Ask Aion</TooltipContent>
      </Tooltip>
    </aside>
  );
}
import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import { toast } from '@/hooks/use-toast';
import { saveAionMessage } from '@/hooks/useAionChat';
import { useQueryClient } from '@tanstack/react-query';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/member-help-chat`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  // Get the user's session token for personalized context
  const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages, conversationId: (window as any).__aionConversationId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Something went wrong' }));
    onError(err.error || 'Something went wrong');
    return;
  }

  if (!resp.body) {
    onError('No response stream');
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;

      const json = line.slice(6).trim();
      if (json === '[DONE]') { streamDone = true; break; }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (!raw.startsWith('data: ')) continue;
      const json = raw.slice(6).trim();
      if (json === '[DONE]') continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

interface AionChatProps {
  conversationId: string | null;
  initialMessages?: Msg[];
  initialMessage?: string;
  onInitialSent?: () => void;
  onFirstUserMessage?: (text: string) => void;
}

export function AionChat({ conversationId, initialMessages, initialMessage, onInitialSent, onFirstUserMessage }: AionChatProps) {
  // Expose conversationId for the streamChat function
  useEffect(() => {
    (window as any).__aionConversationId = conversationId;
    return () => { (window as any).__aionConversationId = null; };
  }, [conversationId]);
  const [messages, setMessages] = useState<Msg[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: 'assistant', content: "Hey! 👋 I'm **Aion**, your personal Barber Launch coach. I already know where you are in your training, so we can skip the small talk and get straight to work.\n\nHere's what I can help you with:\n\n• **\"What should I work on next?\"** — I'll tell you based on your actual checklist\n• **\"How do I get my first client?\"** — step-by-step game plan with exact steps\n• **\"What should I charge?\"** — pricing guidance for installs, retouches & memberships\n• **\"How do I grow on social media?\"** — content ideas, bio updates, posting strategies\n• **\"I have a technical question\"** — adhesives, systems, installation tips, you name it\n\nThink of me like a coach in your pocket. What's on your mind?" }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);
  const queryClient = useQueryClient();
  const userMsgCountRef = useRef(initialMessages ? initialMessages.filter(m => m.role === 'user').length : 0);

  // Reset messages when conversation changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      userMsgCountRef.current = initialMessages.filter(m => m.role === 'user').length;
    } else {
      setMessages([{ role: 'assistant', content: "Hey! 👋 I'm **Aion**, your personal Barber Launch coach. I already know where you are in your training, so we can skip the small talk and get straight to work.\n\nHere's what I can help you with:\n\n• **\"What should I work on next?\"** — I'll tell you based on your actual checklist\n• **\"How do I get my first client?\"** — step-by-step game plan with exact steps\n• **\"What should I charge?\"** — pricing guidance for installs, retouches & memberships\n• **\"How do I grow on social media?\"** — content ideas, bio updates, posting strategies\n• **\"I have a technical question\"** — adhesives, systems, installation tips, you name it\n\nThink of me like a coach in your pocket. What's on your mind?" }]);
      userMsgCountRef.current = 0;
    }
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialMessage && !initialSentRef.current) {
      initialSentRef.current = true;
      onInitialSent?.();
      setTimeout(() => {
        sendMessage(initialMessage);
      }, 300);
    }
  }, [initialMessage]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Msg = { role: 'user', content: text.trim() };
    setInput('');
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // If this is the first user message, notify parent (to create conversation & auto-title)
    userMsgCountRef.current += 1;
    if (userMsgCountRef.current === 1) {
      onFirstUserMessage?.(text.trim());
    }

    // Save user message to DB
    if (conversationId) {
      try { await saveAionMessage(conversationId, 'user', text.trim()); } catch { /* ignore */ }
    }

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    const allMessages = [...messages, userMsg];

    try {
      await streamChat({
        messages: allMessages,
        onDelta: upsert,
        onDone: async () => {
          setLoading(false);
          // Save assistant message to DB
          if (conversationId && assistantSoFar) {
            try {
              await saveAionMessage(conversationId, 'assistant', assistantSoFar);
              queryClient.invalidateQueries({ queryKey: ['aion-messages', conversationId] });
            } catch { /* ignore */ }
          }
        },
        onError: (msg) => {
          toast({ title: 'Aion is unavailable', description: msg, variant: 'destructive' });
          setLoading(false);
        },
      });
    } catch {
      toast({ title: 'Connection error', description: 'Could not reach Aion. Try again.', variant: 'destructive' });
      setLoading(false);
    }
  }, [conversationId, messages, loading, onFirstUserMessage, queryClient]);

  const send = () => sendMessage(input);

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-4 py-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`rounded-xl px-4 py-2.5 max-w-[80%] text-sm ${
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-foreground'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:my-4 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>ul]:my-3 [&>ol]:my-3 [&>h1]:mt-5 [&>h2]:mt-5 [&>h3]:mt-4 [&>h1]:mb-2 [&>h2]:mb-2 [&>h3]:mb-2 [&_li]:my-1.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
              {m.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4 text-secondary-foreground" />
                </div>
              )}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="rounded-xl px-4 py-2.5 bg-muted/50">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex gap-2 pt-3 border-t border-border/50"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Aion anything..."
          disabled={loading}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()} className="gold-gradient">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}

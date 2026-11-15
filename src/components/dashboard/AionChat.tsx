import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, Download, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { saveAionMessage } from '@/hooks/useAionChat';
import { useQueryClient } from '@tanstack/react-query';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { FileDownloadButton } from '@/components/ui/file-download-button';

type ImageMeta = {
  imageUrl?: string;
  imageId?: string;
  imagePrompt?: string;
  provider?: string;
  model?: string;
  width?: number;
  height?: number;
};

type Msg = {
  role: 'user' | 'assistant';
  content: string;
  messageType?: 'text' | 'image';
  metadata?: ImageMeta | Record<string, unknown>;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/member-help-chat`;
const IMAGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aion-generate-image`;

const IMAGE_VERB = /\b(generate|create|make|design|render|produce|build|show)\b/i;
const IMAGE_NOUN = /\b(image|images|photo|photos|picture|pictures|graphic|graphics|visual|visuals|flyer|flyers|poster|posters|creative|creatives)\b/i;
const IMAGE_FOLLOW_UP = /\b(again|another|variation|version|redo|regenerate|fix|change|adjust|flip|rotate|upside.down|backwards|wrong|incorrect|darker|lighter|too\s+\w+)\b/i;
const LEAKED_IMAGE_TOOL = /"action"\s*:\s*"dalle\.text2im"|"thought"\s*:/i;

function isImageRequest(text: string): boolean {
  return IMAGE_VERB.test(text) && IMAGE_NOUN.test(text);
}

function detectAspect(text: string): 'square' | 'portrait' | 'landscape' {
  if (/\b(story|stories|reel|reels|vertical|portrait|9:16)\b/i.test(text)) return 'portrait';
  if (/\b(wide|banner|landscape|horizontal|16:9)\b/i.test(text)) return 'landscape';
  return 'square';
}

function isLeakedImageTool(text: string): boolean {
  return LEAKED_IMAGE_TOOL.test(text);
}

function imageRevision(feedback: string): string {
  // A member describing what is wrong with the previous result is asking us to correct it.
  if (/\b(?:hair system|system)\s+is\s+upside.down\b/i.test(feedback)) {
    return 'Correct the previous image: show the hair system right side up, in its natural orientation as worn on the head. Do not show it upside down.';
  }
  return feedback;
}



async function streamChat({
  messages,
  conversationId,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  conversationId: string | null;
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
    body: JSON.stringify({ messages, conversationId }),
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
  const GREETINGS = [
    "Hi there 👋 How can I help?",
    "Hello! What can I help you with today?",
    "Hi! What would you like to work on?",
    "Hey there — how can I help?",
    "Hi 👋 What's on your mind?",
    "Hello! Ready when you are.",
    "Hi! Ask me anything.",
    "Welcome back — how can I help?",
    "Hi there! What can I do for you?",
    "Hello 👋",
  ];
  const GREETING = useRef(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]).current;
  const [messages, setMessages] = useState<Msg[]>(
    initialMessages && initialMessages.length > 0
      ? initialMessages
      : [{ role: 'assistant', content: GREETING }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialSentRef = useRef(false);
  const queryClient = useQueryClient();
  const userMsgCountRef = useRef(initialMessages ? initialMessages.filter(m => m.role === 'user').length : 0);

  // Reset messages when conversation changes
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      userMsgCountRef.current = initialMessages.filter(m => m.role === 'user').length;
    } else {
      setMessages([{ role: 'assistant', content: GREETING }]);
      userMsgCountRef.current = 0;
    }
  }, [conversationId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

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

    const lastImageIndex = messages.map(m => m.messageType === 'image' && Boolean((m.metadata as ImageMeta)?.imagePrompt)).lastIndexOf(true);
    const lastImage = lastImageIndex >= 0 ? messages[lastImageIndex] : null;
    const revisingImage = Boolean(lastImage && IMAGE_FOLLOW_UP.test(text));
    const priorFeedback = revisingImage
      ? messages.slice(lastImageIndex + 1).filter(m => m.role === 'user' && IMAGE_FOLLOW_UP.test(m.content)).map(m => imageRevision(m.content))
      : [];
    const originalPrompt = (lastImage?.metadata as ImageMeta | undefined)?.imagePrompt || '';
    const imagePrompt = revisingImage
      ? `${originalPrompt}\n\nCreate a corrected variation of this image. ${[...priorFeedback, imageRevision(text)].join(' ')}\nPreserve the original requested format and exact marketing text.`.slice(0, 2000)
      : text.trim();
    const originalMeta = lastImage?.metadata as ImageMeta | undefined;
    const imageAspect = originalMeta?.width && originalMeta?.height
      ? originalMeta.height > originalMeta.width ? 'portrait' : originalMeta.width > originalMeta.height ? 'landscape' : 'square'
      : detectAspect(imagePrompt);

    // Explicit image requests and revisions of the last generated image use the image engine.
    if (isImageRequest(text) || revisingImage) {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
          toast({ title: 'Sign in required', description: 'Please sign in again to generate images.', variant: 'destructive' });
          setLoading(false);
          return;
        }

        const resp = await fetch(IMAGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ prompt: imagePrompt, conversationId, aspect: imageAspect }),
        });
        const result = await resp.json().catch(() => ({ success: false, error: 'Image generation failed.' }));

        if (!resp.ok || !result?.success || !result?.url) {
          toast({
            title: 'Image not generated',
            description: result?.error || 'Image generation failed. Please try again.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const metadata: ImageMeta = {
          imageUrl: result.url,
          imageId: result.id,
          imagePrompt: result.prompt || imagePrompt,
          provider: result.provider,
          model: result.model,
          width: result.width,
          height: result.height,
        };

        setMessages(prev => [...prev, { role: 'assistant', content: 'Created it.', messageType: 'image', metadata }]);

        if (conversationId) {
          try {
            await saveAionMessage(conversationId, 'assistant', 'Created it.', { messageType: 'image', metadata });
            queryClient.invalidateQueries({ queryKey: ['aion-messages', conversationId] });
          } catch { /* ignore */ }
        }
      } catch {
        toast({ title: 'Image not generated', description: 'Could not reach the image engine. Try again.', variant: 'destructive' });
      }
      setLoading(false);
      return;
    }

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      // Hold JSON-shaped model output until it can be checked. Tool instructions are not chat replies.
      if (assistantSoFar.trimStart().startsWith('{')) return;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > 1 && prev[prev.length - 2]?.role === 'user') {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: 'assistant', content: assistantSoFar }];
      });
    };

    const allMessages = [...messages, userMsg]
      .filter(m => m.messageType !== 'image' && !isLeakedImageTool(m.content))
      .map(m => ({ role: m.role, content: m.content }));


    try {
      await streamChat({
        messages: allMessages,
        conversationId,
        onDelta: upsert,
        onDone: async () => {
          setLoading(false);
          const safeReply = isLeakedImageTool(assistantSoFar)
            ? 'The image did not render. Ask me to generate it again.'
            : assistantSoFar;
          if (assistantSoFar.trimStart().startsWith('{')) {
            setMessages(prev => [...prev, { role: 'assistant', content: safeReply }]);
          }
          // Save assistant message to DB
          if (conversationId && safeReply) {
            try {
              await saveAionMessage(conversationId, 'assistant', safeReply);
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0">
        <ConversationContent className="gap-4 px-1 py-2 sm:px-2">
          {messages.map((m, i) => (
            <Message key={`${m.role}-${i}`} from={m.role}>
              <div className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="mt-0.5 flex size-7 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                    <Bot className="size-3.5 text-primary" aria-hidden="true" />
                  </div>
                )}
                <MessageContent
                  className={m.role === 'user'
                    ? 'max-w-[82%] bg-primary px-3.5 py-2.5 text-primary-foreground'
                    : 'max-w-[calc(100%-2.5rem)] px-0 py-0 text-foreground'}
                >
                {m.role === 'assistant' ? (
                  m.messageType === 'image' && (m.metadata as ImageMeta)?.imageUrl ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Created it.</p>
                      <img
                        src={(m.metadata as ImageMeta).imageUrl}
                        alt={(m.metadata as ImageMeta).imagePrompt || 'Generated image'}
                        loading="lazy"
                        className="rounded-lg max-w-full border border-border/50"
                      />
                      <div className="flex flex-wrap gap-2 pt-1">
                        <FileDownloadButton url={(m.metadata as ImageMeta).imageUrl || ''} filename={`aion-${(m.metadata as ImageMeta).imageId || 'image'}.png`} label="Download" />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInput(`Create a variation of this image: ${(m.metadata as ImageMeta).imagePrompt || ''}`)}
                        >
                          <Wand2 className="w-3.5 h-3.5 mr-1.5" /> Create variation
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <MessageResponse className="prose-sm prose-invert [&>p]:my-3 [&_li]:my-1">{isLeakedImageTool(m.content) ? 'The image did not render. Ask me to generate it again.' : m.content}</MessageResponse>
                  )
                ) : (
                  m.content
                )}
                </MessageContent>
              </div>
            </Message>
          ))}
          {loading && messages[messages.length - 1]?.role === 'user' && (
            <Message from="assistant">
              <div className="flex items-center gap-2.5">
                <div className="flex size-7 flex-shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                  <Bot className="size-3.5 text-primary" aria-hidden="true" />
                </div>
                <Shimmer className="text-sm">Aion is thinking…</Shimmer>
              </div>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton className="bottom-2 size-8" />
      </Conversation>

      <PromptInput
        onSubmit={({ text }) => sendMessage(text)}
        className="mt-3 flex-shrink-0 border-t border-border/50 pt-3"
      >
        <PromptInputTextarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Aion anything..."
          disabled={loading}
          className="min-h-12 max-h-28 py-3"
        />
        <PromptInputFooter className="justify-end pb-2 pt-0">
          <PromptInputSubmit
            status={loading ? 'submitted' : 'ready'}
            disabled={loading || !input.trim()}
            className="gold-gradient text-primary-foreground"
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

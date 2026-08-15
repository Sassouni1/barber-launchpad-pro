import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, Pencil, Send, SmilePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useEditSupportMessage, useMarkSupportMessagesRead, useSendSupportMessage, useSupportMessages, useSupportReactions, useToggleSupportReaction, useUnsendSupportMessage } from '@/hooks/useSupportMessages';
import { playMessageReceivedSound, playMessageSentSound, primeMessageSounds } from '@/lib/messageSounds';
import { toast } from 'sonner';

interface SupportThreadProps {
  conversationId?: string;
  title: string;
  description?: string;
  participantName?: string;
}

const reactionChoices = ['👍', '❤️', '😂', '🎉', '👀', '🙏'];

export function SupportThread({ conversationId, title, description, participantName = 'Barber Launch Support' }: SupportThreadProps) {
  const { user, isAdmin } = useAuth();
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File>();
  const [imagePreview, setImagePreview] = useState<string>();
  const [editingMessageId, setEditingMessageId] = useState<string>();
  const [editingBody, setEditingBody] = useState('');
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const firstUnreadId = useRef<string>();
  const knownMessageIds = useRef<Set<string>>(new Set());
  const { data: messages = [], isLoading } = useSupportMessages(conversationId);
  const { data: reactions = [] } = useSupportReactions(conversationId);
  const sendMessage = useSendSupportMessage(conversationId);
  const editMessage = useEditSupportMessage(conversationId);
  const unsendMessage = useUnsendSupportMessage(conversationId);
  const toggleReaction = useToggleSupportReaction(conversationId);
  const markRead = useMarkSupportMessagesRead(conversationId);

  const reactionsByMessage = useMemo(() => {
    const grouped = new Map<string, Map<string, string[]>>();
    reactions.forEach((reaction) => {
      const emojiGroup = grouped.get(reaction.message_id) || new Map<string, string[]>();
      emojiGroup.set(reaction.emoji, [...(emojiGroup.get(reaction.emoji) || []), reaction.user_id]);
      grouped.set(reaction.message_id, emojiGroup);
    });
    return grouped;
  }, [reactions]);

  useEffect(() => {
    if (conversationId && messages.length) markRead.mutate();
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (firstUnreadId.current || !messages.length) return;
    const firstUnread = messages.find((message) => message.sender_id !== user?.id && (isAdmin ? !message.read_by_admin_at : !message.read_by_member_at));
    firstUnreadId.current = firstUnread?.id;
  }, [isAdmin, messages, user?.id]);

  useEffect(() => {
    if (!messages.length) return;
    if (knownMessageIds.current.size === 0) {
      messages.forEach((message) => knownMessageIds.current.add(message.id));
      return;
    }

    const hasIncomingMessage = messages.some((message) => !knownMessageIds.current.has(message.id) && message.sender_id !== user?.id);
    messages.forEach((message) => knownMessageIds.current.add(message.id));
    if (hasIncomingMessage && document.visibilityState === 'visible') playMessageReceivedSound();
  }, [messages, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    if (!image) {
      setImagePreview(undefined);
      return;
    }
    const preview = URL.createObjectURL(image);
    setImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [image]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (!message && !image) return;
    // This is intentional UI feedback, like a chat-app send click. It must run
    // inside the physical tap because iPhone and Android block post-network audio.
    primeMessageSounds();
    playMessageSentSound();
    try {
      await sendMessage.mutateAsync({ body: message, image });
      setBody('');
      setImage(undefined);
    } catch (error: any) {
      toast.error(error?.message || 'Your message could not be sent.');
    }
  };

  const beginEditing = (messageId: string, messageBody: string) => {
    setEditingMessageId(messageId);
    setEditingBody(messageBody);
  };

  const saveEdit = async (messageId: string) => {
    try {
      await editMessage.mutateAsync({ messageId, body: editingBody });
      setEditingMessageId(undefined);
      setEditingBody('');
    } catch (error: any) {
      toast.error(error?.message || 'Your edit could not be saved.');
    }
  };

  const unsend = async (messageId: string) => {
    if (!window.confirm('Unsend this message for everyone? Barber Launch will retain it in the private message history.')) return;
    try {
      await unsendMessage.mutateAsync(messageId);
      if (editingMessageId === messageId) {
        setEditingMessageId(undefined);
        setEditingBody('');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Your message could not be unsent.');
    }
  };

  const chooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextImage = event.target.files?.[0];
    event.target.value = '';
    if (!nextImage) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(nextImage.type)) {
      toast.error('Choose a JPG, PNG, WebP, or GIF image.');
      return;
    }
    if (nextImage.size > 10 * 1024 * 1024) {
      toast.error('Images must be 10 MB or smaller.');
      return;
    }
    setImage(nextImage);
  };

  const react = async (messageId: string, emoji: string) => {
    try {
      await toggleReaction.mutateAsync({ messageId, emoji });
      setReactionPickerMessageId(undefined);
    } catch (error: any) {
      toast.error(error?.message || 'Your reaction could not be saved.');
    }
  };

  return (
    <section className="flex h-[calc(100dvh-3.5rem)] min-h-[420px] flex-col overflow-hidden bg-card md:h-[calc(100dvh-8rem)] md:rounded-2xl md:border md:border-border md:shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <header className="flex items-center gap-3 border-b border-border bg-background/75 px-4 py-3 backdrop-blur">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-black text-primary-foreground">BL</div>
        <div className="min-w-0">
          <h2 className="font-semibold leading-5">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted-foreground">This is your private conversation with Barber Launch. Send a message whenever you need help.</div>
        ) : messages.map((message, index) => {
          const isMine = message.sender_id === user?.id;
          const previous = messages[index - 1];
          const isGrouped = previous?.sender_id === message.sender_id && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60 * 1000;
          const senderName = isMine ? 'You' : participantName;
          return (
            <div key={message.id}>
              {message.id === firstUnreadId.current && <div className="my-3 flex items-center gap-3 px-5"><div className="h-px flex-1 bg-primary/50" /><span className="text-xs font-semibold text-primary">New messages</span><div className="h-px flex-1 bg-primary/50" /></div>}
              <article className={cn('group flex gap-3 px-5 py-1.5 hover:bg-secondary/35', !isGrouped && 'mt-3')}>
                <div className="w-9 shrink-0 pt-0.5">
                  {!isGrouped && <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold', isMine ? 'bg-primary/15 text-primary' : 'bg-secondary text-foreground')}>{isMine ? 'Y' : 'BL'}</div>}
                </div>
                <div className="min-w-0 flex-1 text-sm leading-6">
                  {!isGrouped && <div className="flex items-baseline gap-2"><span className="font-semibold text-foreground">{senderName}</span><time className="text-xs text-muted-foreground">{new Date(message.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>{message.edited_at && <span className="text-xs text-muted-foreground">edited</span>}</div>}
                  {editingMessageId === message.id ? (
                    <div className="mt-1 rounded-xl border border-primary/30 bg-background p-2">
                      <Textarea
                        aria-label="Edit message"
                        value={editingBody}
                        onChange={(event) => setEditingBody(event.target.value)}
                        className="min-h-20 resize-none bg-secondary/45"
                        maxLength={4000}
                        autoFocus
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Button type="button" size="sm" onClick={() => saveEdit(message.id)} disabled={editMessage.isPending || !editingBody.trim()}>Save</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingMessageId(undefined); setEditingBody(''); }} disabled={editMessage.isPending}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {message.attachment_url && (
                          <a href={message.attachment_url} target="_blank" rel="noreferrer" className="mb-2 block w-fit" aria-label={`Open ${message.attachment_name || 'attached image'}`}>
                            <img src={message.attachment_url} alt={message.attachment_name || 'Attached support image'} className="max-h-72 max-w-full rounded-xl border border-border object-contain" />
                          </a>
                        )}
                        {message.body && <p className="whitespace-pre-wrap break-words text-foreground/90">{message.body}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReactionPickerMessageId(reactionPickerMessageId === message.id ? undefined : message.id)} title="Add reaction" aria-label="Add reaction"><SmilePlus className="h-3.5 w-3.5" /></Button>
                        {isMine && <>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => beginEditing(message.id, message.body)} title="Edit message" aria-label="Edit message"><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => unsend(message.id)} disabled={unsendMessage.isPending} title="Unsend for everyone" aria-label="Unsend for everyone"><Trash2 className="h-3.5 w-3.5" /></Button>
                        </>}
                      </div>
                    </div>
                  )}
                  {reactionPickerMessageId === message.id && <div className="mt-1 flex w-fit items-center gap-0.5 rounded-full border border-border bg-background p-1 shadow-lg">{reactionChoices.map((emoji) => <Button key={emoji} type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-full text-base" onClick={() => react(message.id, emoji)} disabled={toggleReaction.isPending} aria-label={`React with ${emoji}`}>{emoji}</Button>)}</div>}
                  {(reactionsByMessage.get(message.id)?.size || 0) > 0 && <div className="mt-1 flex flex-wrap gap-1">{Array.from(reactionsByMessage.get(message.id)!.entries()).map(([emoji, userIds]) => <Button key={emoji} type="button" variant="outline" size="sm" className={cn('h-7 gap-1 rounded-full px-2 text-xs', userIds.includes(user?.id || '') && 'border-primary/60 bg-primary/10')} onClick={() => react(message.id, emoji)} disabled={toggleReaction.isPending} aria-label={`${emoji} reaction, ${userIds.length}`}><span>{emoji}</span><span>{userIds.length}</span></Button>)}</div>}
                </div>
              </article>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-border bg-background/90 p-3 backdrop-blur">
        {image && <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary/55 p-2">
          {imagePreview && <img src={imagePreview} alt="Selected image preview" className="h-12 w-12 rounded-lg object-cover" />}
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{image.name}</span>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setImage(undefined)} disabled={sendMessage.isPending} aria-label="Remove attached image"><X className="h-4 w-4" /></Button>
        </div>}
        <div className="flex gap-2">
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={chooseImage} />
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={() => imageInputRef.current?.click()} disabled={!conversationId || sendMessage.isPending} aria-label="Attach image"><ImagePlus className="h-5 w-5" /></Button>
          <Textarea
            aria-label="Support message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Message Barber Launch…"
            className="min-h-11 resize-none rounded-xl bg-secondary/55"
            rows={1}
            maxLength={4000}
            disabled={!conversationId || sendMessage.isPending}
            onFocus={primeMessageSounds}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onPointerDown={primeMessageSounds} disabled={!conversationId || sendMessage.isPending || (!body.trim() && !image)}>
            {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </form>
    </section>
  );
}

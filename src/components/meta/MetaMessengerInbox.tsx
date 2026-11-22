import * as React from 'react';

type Product = 'vlix' | 'barber_launch';
type Connection = { connected: boolean; pageId: string | null; pageName: string | null };
type Thread = {
  id: string; sender_psid: string; last_message_at: string;
  last_message_text: string | null; last_inbound_at: string | null;
};
type Message = {
  id: string; direction: 'inbound' | 'outbound'; body: string;
  attachments: Array<{ type: string; url: string | null }>; sent_at: string;
};
type Page = { id: string; name: string };

export type MetaMessengerInboxProps = {
  apiUrl: string;
  product: Product;
  shopId?: string | null;
  getToken: () => Promise<string | null>;
  returnPath: string;
  callbackMode?: boolean;
};

export function MetaMessengerInbox({ apiUrl, product, shopId, getToken, returnPath, callbackMode = false }: MetaMessengerInboxProps) {
  const [connection, setConnection] = React.useState<Connection | null>(null);
  const [threads, setThreads] = React.useState<Thread[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [pages, setPages] = React.useState<Page[]>([]);
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const callbackStarted = React.useRef(false);

  const request = React.useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const token = await getToken();
    if (!token) throw new Error('Sign in again to use Facebook messages.');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, product, shopId, ...extra }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) throw new Error(result.error || 'Facebook request failed.');
    return result;
  }, [apiUrl, getToken, product, shopId]);

  const refresh = React.useCallback(async () => {
    const state = await request('connection');
    setConnection(state.connection);
    if (state.connection?.connected) {
      const inbox = await request('threads');
      setThreads(inbox.threads ?? []);
      setSelectedId((current) => current ?? inbox.threads?.[0]?.id ?? null);
    } else {
      setThreads([]);
      setSelectedId(null);
      setMessages([]);
    }
  }, [request]);

  React.useEffect(() => {
    if (callbackMode) return;
    let live = true;
    const run = async () => {
      try { await refresh(); if (live) setError(''); }
      catch (cause) { if (live) setError(cause instanceof Error ? cause.message : 'Could not load Facebook messages.'); }
      finally { if (live) setLoading(false); }
    };
    void run();
    const timer = window.setInterval(() => void run(), 10_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [callbackMode, refresh]);

  React.useEffect(() => {
    if (!callbackMode || callbackStarted.current) return;
    callbackStarted.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error_description') || params.get('error');
    window.history.replaceState({}, '', window.location.pathname);
    if (denied || !code || !state) {
      setError(denied ? 'Facebook did not authorize the Page.' : 'Facebook connection link is incomplete.');
      setLoading(false);
      return;
    }
    void request('complete', { code, state }).then((result) => {
      setPages(result.pages ?? []);
      if (!result.pages?.length) setError('No Pages with Messenger access were returned.');
    }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Could not connect Facebook.'))
      .finally(() => setLoading(false));
  }, [callbackMode, request]);

  React.useEffect(() => {
    if (!selectedId || callbackMode) return;
    let live = true;
    const load = async () => {
      try {
        const result = await request('messages', { threadId: selectedId });
        if (live) setMessages(result.messages ?? []);
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : 'Could not load conversation.'); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [callbackMode, request, selectedId]);

  const start = async () => {
    setBusy(true); setError('');
    try {
      const result = await request('start');
      window.sessionStorage.setItem(`meta-messenger:${product}`, JSON.stringify({ shopId, returnPath }));
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start Facebook connection.');
      setBusy(false);
    }
  };
  const selectPage = async (page: Page) => {
    setBusy(true); setError('');
    try {
      await request('selectPage', { pageId: page.id });
      window.location.assign(returnPath);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect Page.');
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true); setError('');
    try { await request('disconnect'); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not disconnect Page.'); }
    finally { setBusy(false); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !draft.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await request('send', { threadId: selectedId, message: draft.trim() });
      setDraft('');
      const result = await request('messages', { threadId: selectedId });
      setMessages(result.messages ?? []);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message did not send.'); }
    finally { setBusy(false); }
  };

  const selected = threads.find((thread) => thread.id === selectedId);
  const replyOpen = selected?.last_inbound_at && Date.now() - Date.parse(selected.last_inbound_at) < 24 * 60 * 60_000;
  const gold = 'rounded-lg bg-[#e8b13f] px-4 py-2.5 text-sm font-semibold text-[#11100d] disabled:opacity-50';

  return <div className="min-h-[65vh] rounded-xl border border-white/10 bg-[#111214] p-4 text-[#f6efe3] sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold">Facebook messages</h1><p className="mt-1 text-sm text-[#b8b1a8]">{callbackMode ? 'Choose the Page you want to connect.' : connection?.pageName ? `Page: ${connection.pageName}` : 'Connect a Page to receive Messenger inquiries.'}</p></div>
      {!callbackMode && connection?.connected && <button type="button" className="rounded-lg border border-white/15 px-3 py-2 text-sm" disabled={busy} onClick={disconnect}>Disconnect Page</button>}
    </div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
    {loading ? <p className="text-sm text-[#b8b1a8]">Loading…</p> : callbackMode ? (
      <div className="space-y-2">{pages.map((page) => <button key={page.id} type="button" disabled={busy} onClick={() => void selectPage(page)} className="flex w-full items-center justify-between rounded-lg border border-white/15 p-4 text-left hover:border-[#e8b13f]/60"><span>{page.name}</span><span className="text-[#e8b13f]">Connect</span></button>)}</div>
    ) : !connection?.connected ? (
      <button type="button" className={gold} disabled={busy} onClick={() => void start()}>{busy ? 'Connecting…' : 'Connect Facebook Page'}</button>
    ) : <div className="grid min-h-[420px] overflow-hidden rounded-lg border border-white/10 md:grid-cols-[minmax(230px,300px)_minmax(0,1fr)]">
      <aside className="max-h-[55vh] overflow-y-auto border-b border-white/10 md:border-b-0 md:border-r">
        {threads.length ? threads.map((thread) => <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)} className={`block w-full border-b border-white/10 p-3 text-left ${selectedId === thread.id ? 'bg-[#e8b13f]/10' : 'hover:bg-white/[0.04]'}`}><span className="block truncate font-medium">Facebook contact · {thread.sender_psid.slice(-6)}</span><span className="mt-1 block truncate text-xs text-[#b8b1a8]">{thread.last_message_text ?? 'New message'}</span></button>) : <p className="p-4 text-sm text-[#b8b1a8]">No Messenger conversations yet. Send a test message to this Page.</p>}
      </aside>
      <div className="flex min-h-[420px] flex-col">
        <div className="max-h-[55vh] min-h-[300px] flex-1 space-y-3 overflow-y-auto p-4">
          {selected ? messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${message.direction === 'outbound' ? 'ml-auto bg-[#3a2d13]' : 'bg-[#252729]'}`}><p className="whitespace-pre-wrap">{message.body || '[Attachment]'}</p>{message.attachments?.map((attachment, index) => attachment.url ? <a className="mt-2 block text-[#e8b13f] underline" href={attachment.url} target="_blank" rel="noreferrer" key={index}>{attachment.type || 'Attachment'}</a> : null)}<time className="mt-1 block text-[11px] text-[#b8b1a8]">{new Date(message.sent_at).toLocaleString()}</time></div>) : <p className="text-sm text-[#b8b1a8]">Choose a conversation.</p>}
        </div>
        {selected && <form onSubmit={(event) => void send(event)} className="flex gap-2 border-t border-white/10 p-3"><input aria-label="Facebook reply" className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0b0c0b] px-3 py-2 text-sm outline-none focus:border-[#e8b13f]" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={replyOpen ? 'Reply on Messenger…' : 'Reply window closed'} disabled={!replyOpen || busy} maxLength={2000} /><button type="submit" className={gold} disabled={!replyOpen || !draft.trim() || busy}>Send</button></form>}
      </div>
    </div>}
  </div>;
}

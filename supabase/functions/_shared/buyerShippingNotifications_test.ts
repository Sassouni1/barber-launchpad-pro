import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildShippingEmail, buildShippingSms, KIT_SUBJECT, MAX_ATTEMPTS, processQueueRow, QUEUE_DELAY_MINUTES, REGULAR_SUBJECT, type Channel, type Deps, type ManualRecipientBinding, type MemberProfile, type QueueRow, type ShipOrder } from './buyerShippingNotifications.ts';

const base = (over: Partial<ShipOrder> = {}, details: Record<string, unknown> = {}): ShipOrder => ({
  id: '11111111-1111-1111-1111-111111111111', status: 'processing', customer_email: 'Buyer@Example.com', customer_name: 'Jamie Buyer', user_id: null,
  tracking_number: '7777 1111', tracking_url: null, order_details: { phone: '727-555-0100', supplier_tracking_carrier: 'FedEx', ...details }, ...over,
});

type ManualOpts = { binding?: ManualRecipientBinding | null | 'error'; profile?: MemberProfile | null | 'error' };
function harness(order: ShipOrder | null, opts: { optedOut?: boolean; emailResult?: any; smsResult?: any } & ManualOpts = {}) {
  const manualReads = { binding: 0, profile: 0 };
  const channels = new Map<string, { status: string; keys: string[]; notificationId: string; channel: Channel }>();
  const sent: { channel: Channel; body: any }[] = [];
  const rows: Record<string, string> = {};
  const deps: Deps = {
    readOrder: async () => order,
    profilePhone: async () => null,
    manualRecipientBinding: async () => { manualReads.binding++; if (opts.binding === 'error') throw new Error('read'); return opts.binding ?? null; },
    memberProfile: async () => { manualReads.profile++; if (opts.profile === 'error') throw new Error('read'); return opts.profile ?? null; },
    notified: async (_o, channel, excludeId) => {
      const r = [...channels.values()].filter(c => c.channel === channel && c.notificationId !== excludeId && ['sent', 'sending', 'uncertain'].includes(c.status));
      return { keys: new Set(r.flatMap(c => c.keys)), anySent: r.some(c => c.status === 'sent') };
    },
    claimChannel: async (row, channel, keys) => {
      const k = `${row.id}:${channel}`; const e = channels.get(k);
      if (e && e.status !== 'retry') return false;
      channels.set(k, { status: 'sending', keys, notificationId: row.id, channel }); return true;
    },
    finishChannel: async (row, channel, p) => { const e = channels.get(`${row.id}:${channel}`)!; e.status = p.status; },
    recordSkip: async (row, channel) => { channels.set(`${row.id}:${channel}`, { status: 'skipped', keys: [], notificationId: row.id, channel }); },
    finishRow: async (row, status) => { rows[row.id] = status; },
    optedOut: async () => !!opts.optedOut,
    sendEmail: async (i) => { sent.push({ channel: 'email', body: i }); return opts.emailResult ?? { ok: true, messageId: 'e1' }; },
    sendSms: async (i) => { sent.push({ channel: 'sms', body: i }); return opts.smsResult ?? { ok: true, messageId: 's1' }; },
  };
  return { deps, sent, rows, channels, manualReads };
}
const row = (id: string, keys: string[], attempts = 1): QueueRow => ({ id, order_id: '11111111-1111-1111-1111-111111111111', new_keys: keys, attempts });

Deno.test('queue delay is ten minutes (matches database default)', () => {
  assertEquals(QUEUE_DELAY_MINUTES, 10);
  const sql = Deno.readTextFileSync(new URL('../../../drizzle/migrations/0005_buyer_shipping_notifications.sql', import.meta.url));
  assertStringIncludes(sql, "due_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')");
});

Deno.test('regular order copy: exact SMS and subject', async () => {
  const h = harness(base());
  await processQueueRow(h.deps, row('n1', ['77771111']));
  const sms = h.sent.find(s => s.channel === 'sms')!.body;
  assertEquals(sms.message, 'Barber Launch: Your hair system order has shipped. Here’s your tracking number: 7777 1111 (FedEx). https://www.fedex.com/fedextrack/?trknbr=7777%201111 Reply STOP to opt out.');
  assertEquals(sms.phone, '+17275550100');
  const email = h.sent.find(s => s.channel === 'email')!.body;
  assertEquals(email.subject, REGULAR_SUBJECT);
  assertEquals(email.to, 'buyer@example.com');
});

Deno.test('kit order copy uses kit SMS and subject', async () => {
  const h = harness(base({}, { supplier_kit: true }));
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertStringIncludes(h.sent.find(s => s.channel === 'sms')!.body.message, 'Barber Launch: Your hair system kit is on its way. Here’s the tracking number: 7777 1111 (FedEx).');
  assertEquals(h.sent.find(s => s.channel === 'email')!.body.subject, KIT_SUBJECT);
  const k2 = harness(base({}, { kit_order: true }));
  await processQueueRow(k2.deps, row('n1', ['77771111']));
  assertEquals(k2.sent.find(s => s.channel === 'email')!.body.subject, KIT_SUBJECT);
});

Deno.test('reopened order (no tracking) is suppressed with no sends', async () => {
  const h = harness(base({ tracking_number: null }));
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.length, 0); assertEquals(h.rows.n1, 'suppressed');
});

Deno.test('changed tracking before due time never sends the stale number', async () => {
  const h = harness(base({ tracking_number: '9999' }));
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.length, 0); assertEquals(h.rows.n1, 'suppressed');
});

Deno.test('multiple packages: all newly queued numbers with carriers; later package sends only the new one', async () => {
  const extras = { supplier_additional_tracking: [{ tracking_number: 'JD0002', carrier: 'DHL', tracking_url: null }, { tracking_number: 'X-3', carrier: 'Other', tracking_url: 'https://track.example.com/X-3' }] };
  const h = harness(base({}, extras));
  await processQueueRow(h.deps, row('n1', ['77771111', 'JD0002']));
  const sms1 = h.sent.find(s => s.channel === 'sms')!.body.message as string;
  assertStringIncludes(sms1, 'Here are the tracking numbers: 7777 1111 (FedEx)'); assertStringIncludes(sms1, 'JD0002 (DHL)');
  assert(!sms1.includes('X-3'));
  h.sent.length = 0;
  await processQueueRow(h.deps, row('n2', ['X3', '77771111']));
  const sms2 = h.sent.find(s => s.channel === 'sms')!.body.message as string;
  assertStringIncludes(sms2, 'Another package'); assertStringIncludes(sms2, 'X-3. https://track.example.com/X-3');
  assert(!sms2.includes('7777'));
  const html = h.sent.find(s => s.channel === 'email')!.body.html as string;
  assertStringIncludes(html, 'href="https://track.example.com/X-3"');
});

Deno.test('opted-out or declined phone gets no SMS; email still sends', async () => {
  const h = harness(base(), { optedOut: true });
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.map(s => s.channel), ['email']);
  const d = harness(base({}, { sms_consent: false }));
  await processQueueRow(d.deps, row('n1', ['77771111']));
  assertEquals(d.sent.map(s => s.channel), ['email']);
});

Deno.test('idempotent: re-processing the same row never re-sends', async () => {
  const h = harness(base());
  await processQueueRow(h.deps, row('n1', ['77771111']));
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.length, 2);
});

Deno.test('ambiguous provider response is terminal; definite non-send retries', async () => {
  const h = harness(base(), { smsResult: { ok: false, reason: 'relay_send_sms_http_500:x', definitelyNotSent: false } });
  const r = await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(r.sms, 'uncertain'); assertEquals(h.rows.n1, 'done');
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.filter(s => s.channel === 'sms').length, 1);
  const t = harness(base(), { smsResult: { ok: false, reason: 'relay_key_missing', definitelyNotSent: true } });
  assertEquals((await processQueueRow(t.deps, row('n1', ['77771111']))).sms, 'retry');
  assertEquals(t.rows.n1, 'retry');
});

Deno.test('email escapes untrusted values and has no prices', () => {
  const o = base({ customer_name: '<script>x</script>' }, { order_number: '"><img>', total: 315 });
  const { html, text } = buildShippingEmail(o, [{ key: 'A', number: 'A', carrier: 'Other', url: null }], false, false);
  assert(!html.includes('<script>')); assert(!html.includes('"><img>'));
  assert(!/\$\d/.test(html)); assertStringIncludes(text, 'Order reference');
  assertEquals(buildShippingSms([{ key: 'A', number: 'A', carrier: 'Other', url: null }], false, false), 'Barber Launch: Your hair system order has shipped. Here’s your tracking number: A. Reply STOP to opt out.');
});

Deno.test('coalesced save restarts the 10-minute delay: A at 0, B at +9 cannot dispatch at +10, dispatches at +19', () => {
  const sql = Deno.readTextFileSync(new URL('../../../drizzle/migrations/0006_buyer_shipping_reset_due_on_coalesce.sql', import.meta.url));
  const onConflict = sql.slice(sql.indexOf('ON CONFLICT'));
  assertStringIncludes(onConflict, "due_at = now() + interval '10 minutes'");
  // Model of the trigger + claim rule (claim only when due_at <= now).
  const min = 60_000; let due = 0;
  const save = (at: number) => { due = at + QUEUE_DELAY_MINUTES * min; }; // every distinct-key save resets due_at
  const claimable = (now: number) => due <= now;
  save(0); save(9 * min);
  assert(!claimable(10 * min));
  assert(!claimable(18 * min + 59_000));
  assert(claimable(19 * min));
});

Deno.test('SMS is skipped with a clear reason before the relay when buyer email is invalid or missing', async () => {
  for (const customer_email of [null, 'not-an-email']) {
    const h = harness(base({ customer_email }));
    await processQueueRow(h.deps, row('n1', ['77771111']));
    assertEquals(h.sent.length, 0);
    assertEquals(h.channels.get('n1:sms')?.status, 'skipped');
  }
});

// ---- Existing manual individual orders: immutable verified recipient binding (synthetic data only) ----
const manualOrder = (details: Record<string, unknown> = {}, over: Partial<ShipOrder> = {}) => base({ customer_email: '', customer_name: 'Sample Salon (Owner Q)', ...over },
  { phone: '', manual_source: 'admin_entry', manual_individual: true, supplier_kit: false, full_name: 'Sample Salon (Owner Q)', ...details });
const binding: ManualRecipientBinding = {
  order_id: '11111111-1111-1111-1111-111111111111', profile_id: '22222222-2222-2222-2222-222222222222', ghl_contact_id: 'AbCdEfGhIjKlMnOpQrSt',
  verified_name: 'Quinn Sample', verified_email: 'quinn.sample@example.com', verified_phone: '+15555550123', verified_at: '2026-11-18T00:00:00Z',
};
const matchingProfile: MemberProfile = { full_name: 'Quinn Sample', email: ' Quinn.Sample@Example.com ', phone: '555-555-0123' };

Deno.test('manual order without buyer contact: both channels use the verified recipient exactly once, with verified name', async () => {
  const h = harness(manualOrder(), { binding, profile: matchingProfile });
  const r = await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(r.email, 'sent'); assertEquals(r.sms, 'sent');
  const email = h.sent.find(s => s.channel === 'email')!.body;
  assertEquals(email.to, 'quinn.sample@example.com'); assertEquals(email.name, 'Quinn Sample');
  assertStringIncludes(email.html, 'Hi Quinn,'); assert(!email.html.includes('Hi Sample,'));
  const sms = h.sent.find(s => s.channel === 'sms')!.body;
  assertEquals(sms.phone, '+15555550123'); assertEquals(sms.email, 'quinn.sample@example.com'); assertEquals(sms.name, 'Quinn Sample');
  await processQueueRow(h.deps, row('n1', ['77771111']));
  await processQueueRow(h.deps, row('n2', ['77771111']));
  assertEquals(h.sent.map(s => s.channel).sort(), ['email', 'sms']);
});

Deno.test('manual order with no binding sends nothing', async () => {
  const h = harness(manualOrder(), { binding: null });
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.sent.length, 0); assertEquals(h.manualReads.profile, 0);
  assertEquals(h.channels.get('n1:email')?.status, 'skipped'); assertEquals(h.channels.get('n1:sms')?.status, 'skipped');
});

Deno.test('unreadable binding or profile sends nothing: retries, then stops on the last attempt', async () => {
  for (const o of [{ binding: 'error' as const }, { binding, profile: 'error' as const }]) {
    const h = harness(manualOrder(), o);
    assertEquals((await processQueueRow(h.deps, row('n1', ['77771111']))).row, 'retry');
    assertEquals(h.rows.n1, 'retry'); assertEquals(h.channels.size, 0);
    assertEquals((await processQueueRow(h.deps, row('n1', ['77771111'], MAX_ATTEMPTS))).row, 'suppressed');
    assertEquals(h.sent.length, 0);
  }
});

Deno.test('conflicting or missing profile, or conflicting order contact, sends nothing', async () => {
  const cases: [ShipOrder, MemberProfile | null][] = [
    [manualOrder(), { ...matchingProfile, full_name: 'Quinn Samples' }],
    [manualOrder(), { ...matchingProfile, email: 'other@example.com' }],
    [manualOrder(), { ...matchingProfile, phone: '555-555-0199' }],
    [manualOrder(), { ...matchingProfile, phone: null }],
    [manualOrder(), null],
    [manualOrder({ phone: '555-555-0100' }), matchingProfile],
    [manualOrder({}, { customer_email: 'someone.else@example.com' }), matchingProfile],
  ];
  for (const [order, profile] of cases) {
    const h = harness(order, { binding, profile });
    assertEquals((await processQueueRow(h.deps, row('n1', ['77771111']))).row, 'suppressed');
    assertEquals(h.sent.length, 0); assertEquals(h.channels.size, 0); assertEquals(h.rows.n1, 'suppressed');
  }
  const wrongOrder = harness(manualOrder(), { binding: { ...binding, order_id: '33333333-3333-3333-3333-333333333333' }, profile: matchingProfile });
  await processQueueRow(wrongOrder.deps, row('n1', ['77771111']));
  assertEquals(wrongOrder.sent.length, 0);
});

Deno.test('non-manual and kit orders never read bindings and keep existing behavior', async () => {
  const regular = harness(base(), { binding, profile: matchingProfile });
  await processQueueRow(regular.deps, row('n1', ['77771111']));
  assertEquals(regular.manualReads.binding, 0);
  assertEquals(regular.sent.find(s => s.channel === 'email')!.body.to, 'buyer@example.com');
  assertEquals(regular.sent.find(s => s.channel === 'sms')!.body.phone, '+17275550100');
  const blank = harness(base({ customer_email: '' }, { phone: '' }), { binding, profile: matchingProfile });
  await processQueueRow(blank.deps, row('n1', ['77771111']));
  assertEquals(blank.manualReads.binding, 0); assertEquals(blank.sent.length, 0);
  const kit = harness(manualOrder({ supplier_kit: true }), { binding, profile: matchingProfile });
  await processQueueRow(kit.deps, row('n1', ['77771111']));
  assertEquals(kit.manualReads.binding, 0); assertEquals(kit.sent.length, 0);
});

Deno.test('manual order with complete buyer contact does not need the binding', async () => {
  const h = harness(manualOrder({ phone: '727-555-0100' }, { customer_email: 'buyer@example.com' }), { binding: 'error' });
  await processQueueRow(h.deps, row('n1', ['77771111']));
  assertEquals(h.manualReads.binding, 0); assertEquals(h.sent.length, 2);
});

Deno.test('recipient binding table: service-role read only, no app access, immutable, manual orders only', () => {
  const sql = Deno.readTextFileSync(new URL('../../../drizzle/migrations/0013_manual_order_buyer_recipients.sql', import.meta.url));
  assertStringIncludes(sql, 'order_id uuid PRIMARY KEY REFERENCES public.orders(id)');
  assertStringIncludes(sql, 'REVOKE ALL ON public.manual_order_buyer_recipients FROM PUBLIC, anon, authenticated, service_role;');
  assertStringIncludes(sql, 'GRANT SELECT ON public.manual_order_buyer_recipients TO service_role;');
  assert(!/GRANT\s+(INSERT|UPDATE|DELETE|ALL)/i.test(sql));
  assert(!/CREATE POLICY/i.test(sql));
  assertStringIncludes(sql, 'ENABLE ROW LEVEL SECURITY');
  assertStringIncludes(sql, 'BEFORE INSERT OR UPDATE OR DELETE ON public.manual_order_buyer_recipients');
  assertStringIncludes(sql, 'BEFORE TRUNCATE ON public.manual_order_buyer_recipients');
  assertStringIncludes(sql, "order_details->>'manual_individual' = 'true'");
});

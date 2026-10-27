import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { KIT_LOCATION, KIT_LINK, KIT_PRODUCT, KIT_PRICE, KIT_ITEMS, qualifyKit, processKit, kitOrderRow, type KitEvidence } from './logic.ts';
function fixture(): KitEvidence {
  const now = Date.now();
  return { readAt: new Date(now).toISOString(),
    order: { id:'newGhlOrder', locationId:KIT_LOCATION, paymentLinkId:KIT_LINK, completed:true, paid:true, createdAt:new Date(now-2000).toISOString(), paidAt:new Date(now-1000).toISOString(), productId:KIT_PRODUCT, priceId:KIT_PRICE, oneTime:true },
    transaction: { id:'tx1', orderId:'newGhlOrder', locationId:KIT_LOCATION, status:'succeeded', currency:'usd', receivedMinor:299700, refundedMinor:0, providerPaymentId:'pi_verified' },
    payment: { id:'pi_verified', transactionId:'tx1', orderId:'newGhlOrder', live:true, status:'succeeded', currency:'usd', receivedMinor:299700, refundedMinor:0, disputed:false },
    shipping: {name:'Fixture buyer',address1:'1 Fixture St',city:'City',state:'FL',postal_code:'33764',country:'US'},contact:{email:'fixture@example.com',phone:'7275550100'} };
}
const cutoff = () => new Date(Date.now()-10000).toISOString();
Deno.test('failed payment blocks kit', () => { const e=fixture(); e.transaction.status='failed'; assertEquals(qualifyKit(e,e.order.id,cutoff()),'payment_not_completed'); });
Deno.test('any refund blocks kit', () => { const e=fixture(); e.payment.refundedMinor=1; assertEquals(qualifyKit(e,e.order.id,cutoff()),'refunded_or_unknown'); });
Deno.test('missing shipping blocks kit', () => { const e=fixture(); e.shipping.address1=''; assertEquals(qualifyKit(e,e.order.id,cutoff()),'shipping_missing'); });
Deno.test('historical purchase blocks kit', () => { const e=fixture(); e.order.createdAt='2026-01-01T00:00:00Z'; assertEquals(qualifyKit(e,e.order.id,cutoff()),'historical_or_ambiguous_purchase'); });
Deno.test('299700 received minimum, not quoted price', () => { const e=fixture(); assertEquals(qualifyKit(e,e.order.id,cutoff()),null); e.transaction.receivedMinor=e.payment.receivedMinor=299699; assertEquals(qualifyKit(e,e.order.id,cutoff()),'received_amount_not_verified'); });
Deno.test('non USD blocks kit', () => { const e=fixture(); e.transaction.currency='eur'; assertEquals(qualifyKit(e,e.order.id,cutoff()),'wrong_currency'); });
Deno.test('payment must link to current order', () => { const e=fixture(); e.payment.orderId='other'; assertEquals(qualifyKit(e,e.order.id,cutoff()),'payment_linkage_missing'); });
Deno.test('stale provider snapshot blocks kit', () => { const e=fixture(); e.readAt=new Date(Date.now()-60000).toISOString(); assertEquals(qualifyKit(e,e.order.id,cutoff()),'fresh_evidence_or_cutoff_missing'); });
Deno.test('kit retains payment identity and exact manifest without a member owner', () => { const row=kitOrderRow(fixture()); assertEquals(row.user_id,null); assertEquals(row.external_order_id,'newGhlOrder'); assertEquals(row.payment_reference,'ghl:tx1'); assertEquals(row.order_details.provider_payment_id,'pi_verified'); assertEquals(row.order_details.order.line_items.map(i=>i.title),['One #2 skin hair system','One #2 lace hair system','Color wheel','Adhesive','Tape','C22 spray']); assertEquals(KIT_ITEMS.length,6); });
function deps() {
  let reserved=false, sends=0, rows=0;
  return { readFresh:async()=>fixture(),ensureRow:async()=>{ rows++; return 'row'; },confirmVisible:async()=>true,
    reserve:async()=>{ if(reserved)return false; reserved=true;return true; },
    send:async(mail:unknown)=>{ sends++; const m=mail as {to:string;subject:string;html:string};assertEquals(m.to,'sales30@newtimeshair.com');assertEquals(m.subject,'New Hair System Kit Order');assertEquals(m.html.includes('New order for Fixture buyer at 1 Fixture St, City, FL, 33764, US.'),true);assertEquals(m.html.includes('Click here to view order and add tracking details.'),true);assertEquals(m.html.includes('C22 spray'),false);return {ok:true,messageId:'message'}; },
    finish:async()=>{},count:()=>({sends,rows}) };
}
Deno.test('duplicate trigger sends only once after reservation',async()=>{const d=deps();const g={enabled:true,cutoff:cutoff()};assertEquals((await processKit('newGhlOrder',g,d)).status,'sent');assertEquals((await processKit('newGhlOrder',g,d)).status,'reserved_no_retry');assertEquals(d.count().sends,1);});
Deno.test('uncertain response never automatically retries',async()=>{const d=deps();d.send=async()=>{throw Error('timeout');};const g={enabled:true,cutoff:cutoff()};assertEquals((await processKit('newGhlOrder',g,d)).status,'uncertain');assertEquals((await processKit('newGhlOrder',g,d)).status,'reserved_no_retry');});
Deno.test('inactive gate makes no row or send',async()=>{const d=deps();assertEquals((await processKit('newGhlOrder',null,d)).status,'inactive');assertEquals(d.count(),{sends:0,rows:0});});
Deno.test('unavailable fresh GHL read makes no row or send',async()=>{const d=deps();d.readFresh=async()=>{throw Error('unsupported');};assertEquals((await processKit('newGhlOrder',{enabled:true,cutoff:cutoff()},d)).reason,'fresh_ghl_reads_unavailable');assertEquals(d.count(),{sends:0,rows:0});});
Deno.test('supplier visibility must precede reservation and email',async()=>{const d=deps();d.confirmVisible=async()=>false;assertEquals((await processKit('newGhlOrder',{enabled:true,cutoff:cutoff()},d)).reason,'supplier_page_visibility_unverified');assertEquals(d.count().sends,0);});

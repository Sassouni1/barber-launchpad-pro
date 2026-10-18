import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Internal TEST MODE page (admin route, not linked). Redirects only to a
// Stripe-hosted TEST checkout URL; payments never touch the live account.
const isStripeCheckoutUrl = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === "https:" && x.hostname === "checkout.stripe.com"; } catch { return false; } };
const SHIPPING = ["Shipping · $10", "Rush Ship (3 Days) · $50"];
const cents = (n: number) => `$${(n / 100).toFixed(2)}`;

function estimate(length: string, other: string, curl: string, shipping: string) {
  let t = length === "Other" && other === '14" hair' ? 26250 : length === "Other" && other === '16" hair' ? 31500 : 20000;
  if (curl === "Wave unit") t += 5000; else if (curl && curl !== "Standard") t += 3000;
  return t + (shipping.startsWith("Rush") ? 5000 : 1000);
}

export default function HairSystemTestCheckout() {
  const [config, setConfig] = useState<any>(null);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({ barberFirstName: "Chris", barberLastName: "Sassouni", barberPhone: "", address1: "", address2: "", city: "", state: "", zip: "", notes: "TEST MODE — do not manufacture",
    clientName: "", color: "1B", base: "Lace", length: 'Standard 5" hair', lengthOther: "", density: "100% Standard", curl: "Standard", shippingSpeed: SHIPPING[0] });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const total = useMemo(() => estimate(f.length, f.lengthOther, f.curl, f.shippingSpeed), [f]);

  const call = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("hair-system-test-checkout", { body: payload });
    if (error) throw new Error((await (error as any).context?.json?.().catch(() => null))?.error ?? error.message);
    return data;
  };
  const loadResults = () => call({ action: "results" }).then(setResults).catch((e) => setError(e.message));

  useEffect(() => {
    call({ action: "config" }).then(setConfig).catch((e) => setError(e.message));
    const sid = new URLSearchParams(location.search).get("session_id");
    (sid ? call({ action: "verify", sessionId: sid }).catch((e) => setError(e.message)) : Promise.resolve()).then(loadResults);
  }, []);

  const start = async () => {
    setError(null); setStarting(true);
    try {
      const { clientName, color, base, length, lengthOther, density, curl, ...rest } = f;
      const r = await call({ ...rest, systems: [{ clientName, color, base, length, lengthOther, density, curl }] });
      if (!isStripeCheckoutUrl(r?.url)) throw new Error("Unexpected checkout URL.");
      window.location.assign(r.url);
    } catch (e: any) { setError(e.message); setStarting(false); }
  };

  const field = (k: string, label: string) => (<div className="space-y-1"><Label>{label}</Label><Input value={f[k]} onChange={set(k)} /></div>);

  return (
    <DashboardLayout isAdminView>
      <div className="max-w-3xl mx-auto space-y-6 p-4">
        <div className="rounded-lg border-4 border-destructive bg-destructive/15 p-4 text-center">
          <p className="text-2xl font-bold text-destructive">TEST MODE — NO REAL MONEY</p>
          <p className="text-sm text-foreground">Stripe test card only (4242 4242 4242 4242). No supplier, buyer, GHL or SMS message is sent; everything is captured below.</p>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        {config && !config.configured && (
          <p className="text-sm text-muted-foreground">Test mode is not configured: no verified Stripe test key for the hair-system account.</p>
        )}
        {config && !config.webhookConfigured && (
          <p className="rounded-md border border-border p-3 text-sm">Webhook NOT tested: HAIR_SYSTEM_STRIPE_TEST_WEBHOOK_SECRET is not configured, so this test verifies only the paid-return fallback (results are recorded when you come back to this page), not automatic webhook delivery.</p>
        )}
        {(
          <div className="grid gap-3 sm:grid-cols-2">
            {field("barberFirstName", "First name")}{field("barberLastName", "Last name")}{field("barberPhone", "Phone")}
            {field("clientName", "Client name (internal)")}{field("color", "Color")}{field("base", "Lace or Skin")}
            <div className="space-y-1"><Label>Length</Label><select className="w-full h-10 rounded-md border border-input bg-background px-3" value={f.length} onChange={set("length")}><option>Standard 5" hair</option><option>Other</option></select></div>
            {f.length === "Other" && <div className="space-y-1"><Label>Other length</Label><select className="w-full h-10 rounded-md border border-input bg-background px-3" value={f.lengthOther} onChange={set("lengthOther")}><option value="">Choose</option><option>14" hair</option><option>16" hair</option></select></div>}
            {field("density", "Density")}{field("curl", "Curl pattern")}
            {field("address1", "Address")}{field("address2", "Address 2")}{field("city", "City")}{field("state", "State (2 letters)")}{field("zip", "ZIP")}
            <div className="space-y-1"><Label>Shipping</Label><select className="w-full h-10 rounded-md border border-input bg-background px-3" value={f.shippingSpeed} onChange={set("shippingSpeed")}>{SHIPPING.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="sm:col-span-2 flex items-center justify-between">
              <span className="font-semibold">Test total: {cents(total)}</span>
              <Button onClick={start} disabled={!config?.configured || starting}>{starting ? "Opening Stripe test checkout…" : "Start TEST payment"}</Button>
            </div>
          </div>
        )}
        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Test results</h2><Button variant="outline" size="sm" onClick={loadResults}>Refresh</Button></div>
          <p className="text-sm">Outbound messages sent: <strong>{results?.outbound_messages_sent ?? 0}</strong></p>
          {(results?.drafts ?? []).map((d: any) => {
            const orders = (results.orders ?? []).filter((o: any) => o.stripe_checkout_session_id === d.stripe_checkout_session_id);
            const notes = (results.notifications ?? []).filter((n: any) => n.stripe_checkout_session_id === d.stripe_checkout_session_id);
            const r = orders[0]?.receipt;
            return (
              <div key={d.id} className="rounded-lg border border-border p-3 space-y-2 text-sm">
                <p><strong>{d.status}</strong> · {d.stripe_checkout_session_id ?? "no session"} · {new Date(d.created_at).toLocaleString()}</p>
                {r && (<div><p className="font-semibold">Paid: {cents(r.total_minor)} {String(r.currency).toUpperCase()}</p>
                  <ul>{r.items.map((i: any, k: number) => <li key={k}>{i.title} × {i.quantity} — {cents(i.total_minor)}</li>)}</ul></div>)}
                {notes.map((n: any) => (
                  <details key={n.id} className="rounded border border-border p-2">
                    <summary>{n.channel} → {n.intended_recipient} · {n.status} · outbound calls {n.outbound_calls}</summary>
                    {n.subject && <p className="font-semibold mt-2">{n.subject}</p>}
                    {n.channel === "customer_sms" ? <pre className="whitespace-pre-wrap">{n.body}</pre>
                      : <iframe title={n.channel} sandbox="" srcDoc={n.body} className="w-full h-96 bg-background mt-2" />}
                  </details>
                ))}
              </div>
            );
          })}
        </section>
      </div>
    </DashboardLayout>
  );
}

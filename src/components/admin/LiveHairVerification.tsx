import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function LiveHairVerification() {
  const { user, isAdmin } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{ clientSecret: string; sessionId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);
  // Loading Stripe occurs only after an explicit successful Start response.
  const stripe = useMemo(() => {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    return checkout && key?.startsWith("pk_live_") ? loadStripe(key) : null;
  }, [checkout]);
  if (!isAdmin || user?.email !== "chris@invasiondigitalmedia.com") return null;
  const start = async () => {
    if (!confirmed || busy || checkout) return;
    setBusy(true); setError(null);
    try {
      if (!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_")) throw new Error("Live Stripe checkout is unavailable.");
      const { data, error } = await supabase.functions.invoke("hair-system-checkout", { body: { action: "create_live_verification_checkout", confirm: "LIVE_ONE_DOLLAR_TEST" } });
      if (error) throw new Error((await (error as any).context?.json?.().catch(() => null))?.error ?? error.message);
      if (!data?.clientSecret || !data?.sessionId?.startsWith("cs_live_") || data.total_minor !== 100 || data.currency !== "usd" || data.live !== true) throw new Error("Unexpected live verification response. Do not retry payment.");
      setCheckout({ clientSecret: data.clientSecret, sessionId: data.sessionId });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to start live verification."); }
    setBusy(false);
  };
  const cancel = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("hair-system-checkout", { body: { action: "cancel_live_verification_checkout", confirm: "CANCEL_UNPAID_LIVE_TEST" } });
      if (error) throw new Error((await (error as any).context?.json?.().catch(() => null))?.error ?? error.message);
      if (data?.canceled !== true) throw new Error("Cancellation was not confirmed.");
      setCanceled(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to cancel."); }
    setBusy(false);
  };
  return (
    <section aria-label="Live $1 verification" className="border-y-2 border-destructive py-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-destructive">Live $1 verification</h2>
        <p className="font-semibold">REAL PAYMENT · $1.00 USD · ONE TIME ONLY</p>
      </div>
      <p className="text-sm">Start creates a LIVE $1 Stripe checkout. Completing payment sends one clearly marked test supplier email to New Times Hair at <strong>sales30@newtimeshair.com</strong>, plus a receipt and SMS to Chris. TEST ONLY — DO NOT PRODUCE OR SHIP.</p>
      <div className="text-sm space-y-1">
        <p><strong>Chris Sassouni</strong> · chris@invasiondigitalmedia.com</p>
        <p>Phone: 7276374672</p>
        <p>2259 St. Charles Dr., Clearwater, FL 33764</p>
        <p>Lace · Color 1B · Standard 5-inch · Standard curl · 100% density</p>
        <p>No shipping charge. No product made or shipped. Card will not be saved for future orders.</p>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="live-one-dollar-confirm" checked={confirmed} disabled={busy || !!checkout} onCheckedChange={(v) => setConfirmed(v === true)} />
        <Label htmlFor="live-one-dollar-confirm" className="leading-5">I confirm this one-time LIVE $1 payment and the real test email/receipt/SMS to the fixed destinations above.</Label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {canceled ? <p className="text-sm">Unpaid live verification session canceled. No new verification session will be created.</p> : <>
        <div className="flex flex-wrap gap-2">
          <Button variant="destructive" onClick={start} disabled={!confirmed || busy || !!checkout}>{busy ? "Please wait…" : checkout ? "Live session created" : "Start LIVE $1 verification"}</Button>
          <Button variant="outline" onClick={cancel} disabled={busy}>Cancel only my unpaid live verification</Button>
        </div>
        {checkout && <p className="text-xs break-all">LIVE session: {checkout.sessionId} · Unpaid until Stripe confirms payment.</p>}
        {checkout && stripe && <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret: checkout.clientSecret }}><EmbeddedCheckout className="min-h-[640px]" /></EmbeddedCheckoutProvider>}
      </>}
    </section>
  );
}
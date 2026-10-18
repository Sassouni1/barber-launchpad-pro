import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { reconciliationRequest } from "@/lib/hairSystemReconciliation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";

type Result = Record<string, any>;

async function call(body: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.functions.invoke("hair-system-reconcile", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.text();
      let message = details;
      try { message = JSON.parse(details).error ?? details; } catch { /* retain provider response */ }
      throw new Error(message || error.message);
    }
    throw new Error(error.message);
  }
  if ((data as Result)?.error) throw new Error((data as Result).error);
  return data as Result;
}

export function HairSystemReconciliation() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [orderId, setOrderId] = useState("");

  const run = async (action: "diagnostics" | "dry_run") => {
    setBusy(action);
    setErr(null);
    try {
      setResult(await call(reconciliationRequest(action, orderId)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const d = result?.diagnostics;
  const rows: Result[] = result?.notifications ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Hair-system order reconciliation</h3>
        <p className="text-sm text-muted-foreground">
          Read-only payment and delivery checks. No messages are sent.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!!busy} onClick={() => run("diagnostics")}>
          {busy === "diagnostics" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check setup
        </Button>
        <Input aria-label="Order ID" className="w-full sm:max-w-[360px]" placeholder="Order ID" value={orderId} disabled={!!busy} onChange={(e) => { setOrderId(e.target.value); setResult(null); }} />
        <Button variant="outline" disabled={!!busy || !orderId.trim()} onClick={() => run("dry_run")}>
          {busy === "dry_run" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Dry run (read-only)
        </Button>
      </div>

      {err && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>
      )}

      {d && (
        <div className="grid gap-1 text-sm text-foreground">
          <div>Stripe account: {d.stripeAccount ?? d.stripeAccountError} {d.stripeAccountMatches ? "✓" : "✗ (expected " + d.expectedSeller + ")"}</div>
          <div>Webhook endpoint: {d.webhook?.configured ? "configured ✓" : `not ready — ${d.webhook?.reason}`}{d.webhook?.missingEvents?.length ? ` (missing: ${d.webhook.missingEvents.join(", ")})` : ""}</div>
          <div>Webhook events received: {d.webhookEventsReceived ?? "unavailable"}{d.webhookEventsError ? ` — ${d.webhookEventsError}` : ""}</div>
          <div>Vlix delivery relay: {d.ghlAccess?.ready === true ? `ready (${d.ghlAccess.locationId}) ✓` : `not ready — ${d.ghlAccess?.reason ?? "probe unavailable"}`}</div>
          <div>Local GHL OAuth (not the delivery relay): {d.ghlOauth?.connected === true ? `connected (${d.ghlOauth.locationId})` : d.ghlOauth?.connected === false ? "not connected" : `unavailable — ${d.ghlOauth?.reason ?? "unknown"}`}</div>
          <div>Fulfillment hold: {d.fulfillment?.hold === true ? "ON — deliveries paused" : d.fulfillment?.hold === false ? "OFF" : "unavailable"}{d.fulfillment?.holdError ? ` — ${d.fulfillment.holdError}` : ""}</div>
          <div>Recent webhook attempts: {d.fulfillment?.attemptsError ? `unavailable — ${d.fulfillment.attemptsError}` : d.fulfillment?.attempts?.length === 0 ? "none recorded" : d.fulfillment?.attempts ? `${d.fulfillment.attempts.length} most recent` : "unavailable"}</div>
          {d.fulfillment?.attempts?.map((a: Result, i: number) => (
            <div key={i} className="break-words text-xs text-muted-foreground">{a.received_at} · {a.signature_valid ? "signature verified" : "signature not verified"} · {a.outcome}</div>
          ))}
        </div>
      )}

      {result?.verified && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-foreground">
            <thead className="text-muted-foreground"><tr><th className="text-left p-1">Order</th><th className="text-left p-1">Stripe check</th><th className="text-left p-1">Paid</th></tr></thead>
            <tbody>
              {result.verified.map((v: Result) => (
                <tr key={v.orderId} className="border-t border-border">
                  <td className="p-1 font-mono">{String(v.orderId).slice(0, 8)}</td>
                  <td className="p-1">{v.ok ? "verified ✓" : v.reason}</td>
                   <td className="p-1">{typeof v.amountPaid === "number" && v.currency ? new Intl.NumberFormat("en-US", { style: "currency", currency: v.currency }).format(v.amountPaid / 100) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result?.plan && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-foreground">
            <thead className="text-muted-foreground"><tr><th className="text-left p-1">Order</th><th className="text-left p-1">Channel</th><th className="text-left p-1">Now</th><th className="text-left p-1">Plan</th><th className="text-left p-1">Last reason</th></tr></thead>
            <tbody>
              {result.plan.map((p: Result) => {
                const row = rows.find((r) => r.order_id === p.orderId && r.channel === p.channel);
                return (
                  <tr key={p.orderId + p.channel} className="border-t border-border">
                    <td className="p-1 font-mono">{String(p.orderId).slice(0, 8)}</td>
                    <td className="p-1">{p.channel}</td>
                    <td className="p-1">{p.current}</td>
                    <td className="p-1">{p.action}</td>
                    <td className="p-1 text-muted-foreground">{row?.reason ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

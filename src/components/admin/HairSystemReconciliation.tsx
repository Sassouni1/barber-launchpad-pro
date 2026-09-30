import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

type Result = Record<string, any>;

async function call(body: Record<string, unknown>): Promise<Result> {
  const { data, error } = await supabase.functions.invoke("hair-system-reconcile", { body });
  if ((data as Result)?.error) throw new Error((data as Result).error);
  if (error) throw new Error(error.message);
  return data as Result;
}

export function HairSystemReconciliation() {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");

  const run = async (action: "diagnostics" | "dry_run" | "execute") => {
    setBusy(action);
    setErr(null);
    try {
      setResult(await call(action === "execute" ? { action, confirm } : { action }));
      if (action === "execute") setConfirm("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const d = result?.diagnostics;
  const dryRunDone = result?.mode === "dry_run";
  const canExecute = dryRunDone && d?.ghlOauth?.connected && d?.stripeAccountMatches && confirm === "EXECUTE";
  const rows: Result[] = result?.notifications ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Hair-system order reconciliation</h3>
        <p className="text-sm text-muted-foreground">
          Rechecks paid orders with Stripe and resends only the messages that never went out. Dry run changes nothing.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={!!busy} onClick={() => run("diagnostics")}>
          {busy === "diagnostics" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check setup
        </Button>
        <Button variant="outline" disabled={!!busy} onClick={() => run("dry_run")}>
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
          <div>Webhook events received: {d.webhookEventsReceived}</div>
          <div>GoHighLevel: {d.ghlOauth?.connected ? `connected (${d.ghlOauth.locationId}) ✓` : "not connected ✗"}</div>
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
                  <td className="p-1">{typeof v.amountPaid === "number" ? `$${(v.amountPaid / 100).toFixed(2)}` : "—"}</td>
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

      {result?.mode === "execute" && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-foreground">
            <thead className="text-muted-foreground"><tr><th className="text-left p-1">Order</th><th className="text-left p-1">Channel</th><th className="text-left p-1">Status</th><th className="text-left p-1">Message ID</th><th className="text-left p-1">Reason</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order_id + r.channel} className="border-t border-border">
                  <td className="p-1 font-mono">{String(r.order_id).slice(0, 8)}</td>
                  <td className="p-1">{r.channel}</td>
                  <td className="p-1">{r.status}</td>
                  <td className="p-1 font-mono">{r.provider_message_id ?? "—"}</td>
                  <td className="p-1 text-muted-foreground">{r.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dryRunDone && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Input className="max-w-[180px]" placeholder="Type EXECUTE" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button disabled={!canExecute || !!busy} onClick={() => run("execute")}>
            {busy === "execute" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Send missing messages
          </Button>
          {!d?.ghlOauth?.connected && <span className="text-xs text-muted-foreground">Connect GoHighLevel first.</span>}
        </div>
      )}
    </div>
  );
}

export function reconciliationRequest(action: "diagnostics" | "dry_run", orderId: string) {
  if (action === "diagnostics") return { action };
  const id = orderId.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw new Error("Provide exactly one valid order ID.");
  }
  return { action, order_id: id };
}
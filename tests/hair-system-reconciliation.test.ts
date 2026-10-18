import { describe, expect, test } from "bun:test";
import { reconciliationRequest } from "../src/lib/hairSystemReconciliation";

describe("read-only hair-system reconciliation", () => {
  test("dry run sends exactly the specified order ID", () => {
    expect(reconciliationRequest("dry_run", " 11111111-2222-4333-8444-555555555555 ")).toEqual({
      action: "dry_run", order_id: "11111111-2222-4333-8444-555555555555",
    });
  });
  test("empty or multiple IDs are refused before any invocation", () => {
    expect(() => reconciliationRequest("dry_run", "")).toThrow();
    expect(() => reconciliationRequest("dry_run", "11111111-2222-4333-8444-555555555555,11111111-2222-4333-8444-555555555556")).toThrow();
  });
  test("setup diagnostics need no order and never request execute", () => {
    expect(reconciliationRequest("diagnostics", "")).toEqual({ action: "diagnostics" });
  });
});
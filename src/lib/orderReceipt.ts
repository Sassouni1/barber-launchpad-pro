import { jsPDF } from "jspdf";
import type { Tables } from "@/integrations/supabase/types";
import { isReceiptEligible } from "./receiptEligibility";
import { currencyMinorDivisor, type NativeReceipt } from "./nativeOrderReceipt";

type Order = Tables<"orders">;

interface ReceiptLineItem {
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface ReceiptData {
  receiptNumber: string;
  date: Date;
  customerName: string;
  customerEmail: string;
  items: ReceiptLineItem[];
  total: number | null;
  currencySymbol: string;
  currencyCode: string;
  specs: { label: string; value: string }[];
}

function cleanTitle(title: string): string {
  return String(title || "")
    .replace(/\s*@\s*\d+(\.\d+)?/g, "")
    .replace(/\s*-\s*Hair System$/i, "")
    .trim();
}

export function extractReceiptData(order: Order): ReceiptData {
  const details = (order.order_details || {}) as Record<string, any>;
  const inner = details.order || details;

  if (order.stripe_checkout_session_id) {
    const snapshot = details.stripe_receipt as NativeReceipt | undefined;
    const available = snapshot?.session_id === order.stripe_checkout_session_id;
    const currencyCode = available ? snapshot.currency : 'USD';
    const divisor = currencyMinorDivisor(currencyCode);
    const currencySymbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).formatToParts(0).find((part) => part.type === 'currency')?.value ?? currencyCode;
    const systemDetails = Array.isArray(details.checkout_system_details) ? details.checkout_system_details : [details];
    const specs = systemDetails.flatMap((system: Record<string, any>, index: number) => ['Lace or Skin', 'Choose Color', 'Hair Length', 'Choose Density', 'Curl Pattern'].filter((key) => system?.[key]).map((key) => ({ label: `${systemDetails.length > 1 ? `System ${index + 1} · ` : ''}${key}`, value: String(system[key]) })));
    return {
      receiptNumber: order.stripe_checkout_session_id, date: new Date(available ? snapshot.purchased_at : order.order_date),
      customerName: order.customer_name || 'Customer', customerEmail: order.customer_email || '',
      items: available ? snapshot.items.map((item) => ({ title: item.title, quantity: item.quantity, unitPrice: item.unit_minor / divisor, lineTotal: item.total_minor / divisor })) : [],
      total: available ? snapshot.total_minor / divisor : null, currencySymbol, currencyCode, specs,
    };
  }

  const rawItems = Array.isArray(inner.line_items) ? inner.line_items : [];
  const items: ReceiptLineItem[] = rawItems.map((item: any) => ({
    title: cleanTitle(item.title) || "Item",
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price) || 0,
    lineTotal: Number(item.line_price ?? item.price) || 0,
  }));

  const currencySymbol = typeof inner.currency_symbol === "string" && inner.currency_symbol
    ? inner.currency_symbol
    : "$";
  const currencyCode = typeof inner.currency_code === "string" && inner.currency_code
    ? inner.currency_code
    : "USD";

  const total = typeof inner.total_price === "number"
    ? inner.total_price
    : (items.length > 0 ? items.reduce((sum, i) => sum + i.lineTotal, 0) : null);

  const specs: { label: string; value: string }[] = [];
  if (details["Lace or Skin"]) specs.push({ label: "Type", value: String(details["Lace or Skin"]) });
  if (details["Choose Color"]) specs.push({ label: "Color", value: String(details["Choose Color"]) });
  const curl = details["Curl Pattern — only if needed"];
  if (curl && String(curl).toLowerCase() !== "none") specs.push({ label: "Curl", value: String(curl) });
  if (!items.length && details.product) specs.push({ label: "Product", value: String(details.product) });

  const rawName = (order.customer_name || inner?.customer?.name || "").trim();
  const customerName = rawName.length >= 2 ? rawName : "Customer";

  return {
    receiptNumber: order.external_order_id || order.id.slice(0, 8).toUpperCase(),
    date: new Date(order.order_date),
    customerName,
    customerEmail: order.customer_email || inner?.customer?.email || "",
    items,
    total,
    currencySymbol,
    currencyCode,
    specs,
  };
}

export function receiptMoney(amount: number, symbol: string, currency?: string): string {
  const digits = currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2 : 2;
  return `${symbol}${amount.toFixed(digits)}`;
}

export function buildReceiptPdf(order: Order): jsPDF {
  if (!isReceiptEligible(order)) throw new Error("This checkout was not paid, so there is no receipt.");
  const data = extractReceiptData(order);
  if (order.stripe_checkout_session_id && data.total === null) throw new Error("Paid amount unavailable. Retry Stripe receipt lookup before downloading.");
  const doc = new jsPDF({ unit: "pt", format: "letter" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 56;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  doc.text("Barber Launch", margin, y);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(order.stripe_checkout_session_id ? "Checkout Receipt · all systems and shipping" : "Purchase Receipt", margin, y + 18);

  doc.setFontSize(10);
  doc.text(`Receipt #${order.stripe_checkout_session_id ? order.id.slice(0, 8).toUpperCase() : data.receiptNumber}`, pageWidth - margin, y, { align: "right" });
  doc.text(
    data.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
    pageWidth - margin,
    y + 14,
    { align: "right" }
  );

  y += 48;
  doc.setDrawColor(210, 175, 55);
  doc.setLineWidth(1.5);
  doc.line(margin, y, pageWidth - margin, y);

  // Billed to
  y += 24;
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("BILLED TO", margin, y);
  y += 14;
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, margin, y);
  if (data.customerEmail) {
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(90, 90, 90);
    doc.text(data.customerEmail, margin, y);
  }

  // Specs (type/color/curl)
  if (data.specs.length > 0) {
    y += 22;
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text("DETAILS", margin, y);
    y += 14;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(data.specs.map((s) => `${s.label}: ${s.value}`).join("   •   "), pageWidth - margin * 2);
    if (order.stripe_checkout_session_id) {
      for (const line of lines) {
        if (y > doc.internal.pageSize.getHeight() - 110) { doc.addPage(); y = margin; }
        doc.text(line, margin, y);
        y += 12;
      }
      y -= 12;
    } else {
      doc.text(lines, margin, y);
      y += (lines.length - 1) * 12;
    }
  }

  // Line items table header
  y += 30;
  if (order.stripe_checkout_session_id && y > doc.internal.pageSize.getHeight() - 160) { doc.addPage(); y = margin; }
  const colQty = pageWidth - margin - 160;
  const colPrice = pageWidth - margin - 90;
  const colTotal = pageWidth - margin;

  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text("ITEM", margin, y);
  doc.text("QTY", colQty, y, { align: "right" });
  doc.text("PRICE", colPrice, y, { align: "right" });
  doc.text("AMOUNT", colTotal, y, { align: "right" });
  y += 6;
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.75);
  doc.line(margin, y, pageWidth - margin, y);

  // Line items
  y += 18;
  doc.setFontSize(10.5);
  if (data.items.length > 0) {
    for (const item of data.items) {
      const titleLines = doc.splitTextToSize(item.title, colQty - margin - 24);
      if (order.stripe_checkout_session_id && y + titleLines.length * 14 > doc.internal.pageSize.getHeight() - 100) { doc.addPage(); y = margin; }
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.text(titleLines, margin, y);
      doc.setTextColor(70, 70, 70);
      doc.text(String(item.quantity), colQty, y, { align: "right" });
      doc.text(receiptMoney(item.unitPrice, data.currencySymbol, order.stripe_checkout_session_id ? data.currencyCode : undefined), colPrice, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(receiptMoney(item.lineTotal, data.currencySymbol, order.stripe_checkout_session_id ? data.currencyCode : undefined), colTotal, y, { align: "right" });
      y += titleLines.length * 14 + 8;
    }
  } else {
    doc.setTextColor(70, 70, 70);
    doc.setFont("helvetica", "normal");
    doc.text("Hair System Order", margin, y);
    y += 22;
  }

  // Total
  if (data.total !== null) {
    if (order.stripe_checkout_session_id && y > doc.internal.pageSize.getHeight() - 110) { doc.addPage(); y = margin; }
    y += 10;
    doc.setDrawColor(210, 175, 55);
    doc.setLineWidth(1.5);
    doc.line(colQty - 40, y, pageWidth - margin, y);
    y += 22;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Total", colPrice, y, { align: "right" });
    doc.text(`${receiptMoney(data.total, data.currencySymbol, order.stripe_checkout_session_id ? data.currencyCode : undefined)} ${data.currencyCode}`, colTotal, y, { align: "right" });
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Thank you for your order. Keep this receipt for your records.",
    pageWidth / 2,
    pageHeight - 40,
    { align: "center" }
  );

  return doc;
}

export function receiptFileName(order: Order): string {
  const data = extractReceiptData(order);
  const dateStr = data.date.toISOString().slice(0, 10);
  const safeName =
    (order.customer_name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "customer";
  return `receipt-${dateStr}-${safeName}-${data.receiptNumber}.pdf`;
}

export function downloadReceipt(order: Order): void {
  const doc = buildReceiptPdf(order);
  doc.save(receiptFileName(order));
}

import { jsPDF } from "jspdf";
import type { Tables } from "@/integrations/supabase/types";

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

  return {
    receiptNumber: order.external_order_id || order.id.slice(0, 8).toUpperCase(),
    date: new Date(order.order_date),
    customerName: order.customer_name || inner?.customer?.name || "Customer",
    customerEmail: order.customer_email || inner?.customer?.email || "",
    items,
    total,
    currencySymbol,
    currencyCode,
    specs,
  };
}

function money(amount: number, symbol: string): string {
  return `${symbol}${amount.toFixed(2)}`;
}

export function buildReceiptPdf(order: Order): jsPDF {
  const data = extractReceiptData(order);
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
  doc.text("Purchase Receipt", margin, y + 18);

  doc.setFontSize(10);
  doc.text(`Receipt #${data.receiptNumber}`, pageWidth - margin, y, { align: "right" });
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
    doc.text(data.specs.map((s) => `${s.label}: ${s.value}`).join("   •   "), margin, y, {
      maxWidth: pageWidth - margin * 2,
    });
  }

  // Line items table header
  y += 30;
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
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.text(titleLines, margin, y);
      doc.setTextColor(70, 70, 70);
      doc.text(String(item.quantity), colQty, y, { align: "right" });
      doc.text(money(item.unitPrice, data.currencySymbol), colPrice, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(money(item.lineTotal, data.currencySymbol), colTotal, y, { align: "right" });
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
    y += 10;
    doc.setDrawColor(210, 175, 55);
    doc.setLineWidth(1.5);
    doc.line(colQty - 40, y, pageWidth - margin, y);
    y += 22;
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Total", colPrice, y, { align: "right" });
    doc.text(`${money(data.total, data.currencySymbol)} ${data.currencyCode}`, colTotal, y, { align: "right" });
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
  const safeName = (order.customer_name || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `receipt-${dateStr}-${safeName}-${data.receiptNumber}.pdf`;
}

export function downloadReceipt(order: Order): void {
  const doc = buildReceiptPdf(order);
  doc.save(receiptFileName(order));
}

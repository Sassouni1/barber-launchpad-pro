

# Improve Order Details Display

## Problem
The GHL webhook sends a rich payload with product line items, curl patterns, client names, and more -- but the current extraction logic only pulls "Hair Color" and "Lace or Skin". Both the customer-facing Orders page and the Manufacturer Orders page are missing most of the useful information.

## What the payload actually contains (from your test order)

| Field | Value |
|-------|-------|
| Line Items | Hair System ($200), Curly Wave Unit ($80), Rush Shipping ($30) |
| Client Name | John |
| Hair Color | 1 |
| Choose Color | #540 |
| Lace or Skin | Lace |
| Curl Pattern | 2.8 curl |
| Notes | no |

## Plan

### 1. Update `ManufacturerOrders.tsx` -- Better spec extraction
- Add more keys to `ORDER_SPEC_KEYS`: `Client Name`, `Choose Color`, `Curl Pattern -- only if needed`
- Extract `order.line_items` from the nested `order` object to show what products were ordered and their prices
- Display line items as a small list above the spec badges

### 2. Update `Orders.tsx` -- Richer customer-facing summary
- Update `getOrderSummary` to also extract `Client Name`, `Curl Pattern`, and `Choose Color`
- Parse nested `order.line_items` to show what was ordered (product names)
- Show a concise product list so the customer knows what their order contains

### 3. Both pages -- Extract from nested `order` object
The GHL payload nests the actual order data under a `details.order` key which contains `line_items`, `total_amount`, `currency_symbol`, etc. The extraction logic needs to look inside this nested object, not just at the top level.

## Technical Details

### Nested order structure to parse:
```
details.order.line_items = [
  { title: "Hair System - Hair System @ 220", price: 200, quantity: 1 },
  { title: "Curly Wave Unit", price: 80, quantity: 1 },
  { title: "Rush Shipping", price: 30, quantity: 1 }
]
details.order.total_amount = 310
details.order.currency_symbol = "$"
```

### Updated ORDER_SPEC_KEYS for ManufacturerOrders:
```typescript
const ORDER_SPEC_KEYS = [
  'Hair Color',
  'Choose Color',
  'Lace or Skin',
  'Curl Pattern — only if needed',
  'Client Name',
  'Hair Salon Service Requested',
  'Any Notes you may want to add',
];
```

### Updated getOrderSummary for Orders.tsx:
- Show line item product names (e.g., "Hair System, Curly Wave Unit")
- Show Type (Lace/Skin), Hair Color, Curl Pattern
- Show total amount if available

### No database or backend changes needed
All changes are frontend display logic only.

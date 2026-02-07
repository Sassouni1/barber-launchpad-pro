

## Split Orders into "New Orders" and "Previous Orders"

Orders with tracking/shipping will move to a collapsible "Previous Orders" section below the main list.

## How It Works

- Orders are split into two groups:
  - **New Orders** (no tracking number) -- shown at the top, always visible
  - **Previous Orders** (have a tracking number / shipped / completed) -- shown in a collapsible section below, collapsed by default
- The collapsible section uses the existing Collapsible component with a chevron toggle
- Previous orders still show the "Edit Tracking" button so tracking can be updated if needed

## Technical Details

**File: `src/pages/ManufacturerOrders.tsx`**

1. Import `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible` and `ChevronDown` from lucide
2. Split the `orders` array into `newOrders` (no `tracking_number`) and `previousOrders` (has `tracking_number`)
3. Render `newOrders` in the existing "New Orders" section
4. Below it, render a `Collapsible` (defaultOpen={false}) with:
   - A trigger showing "Previous Orders (X)" with a rotating chevron
   - The content containing the same order card layout for `previousOrders`
5. Extract the order card rendering into a reusable helper to avoid duplicating JSX
6. Update the empty state to only show when both lists are empty

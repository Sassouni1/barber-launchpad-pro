

## Add "Choose Density" to Supplier Order Cards

### What's happening now
The order form captures a density field called `"Choose Density if Needed (75%-110%) - 100% is regular"`, but the supplier orders page doesn't display it because it's not listed in the spec keys configuration.

The "Max density" text you saw was typed into the notes field separately, which is why there's a contradiction -- the actual density dropdown was set to 75%.

### What will change
Add the density field to the order card on the supplier page, displayed as **"Choose Density"**. It will only show when the field has a meaningful value (not empty, "none", or "no"), consistent with how all other specs are handled.

### Technical details
**File: `src/pages/ManufacturerOrders.tsx`**

Add a new entry to the `ORDER_SPEC_KEYS` array:

```typescript
{ display: 'Choose Density', keys: ['Choose Density if Needed (75%-110%) - 100% is regular'] },
```

This uses the existing alias pattern (display name + actual key lookup), so no other code changes are needed -- the `extractOrderDetails` function already handles this format. The density will appear alongside color, lace/skin, curl pattern, etc., with its own copy button.


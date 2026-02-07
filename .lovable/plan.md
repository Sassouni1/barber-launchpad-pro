

# Simplify Color Display to "Choose Color" Only

## Change
Remove "Hair Color" from both order pages and keep only "Choose Color" as the single color field.

## Technical Details

### ManufacturerOrders.tsx
- Remove `'Hair Color'` from `ORDER_SPEC_KEYS` array (keep `'Choose Color'`)

### Orders.tsx
- Remove the `hairColor` extraction from `getOrderSummary`
- Keep only the `chooseColor` field, displayed as "Color"




## Update Manufacturer Orders Display

Currently, the manufacturer orders page shows:
- **Michael** (the client name from `customer_name`)
- **chris@barberlaunchhq.com** (the `customer_email`)

You want it to show:
- **Chris Sassouni** (the barber/contact) with their personal email
- **Client: Michael** (the actual client)

### Changes

**File: `src/pages/ManufacturerOrders.tsx`**

1. Update the order card to extract the barber (GHL contact) info from `order_details`:
   - Barber name: `order_details.full_name` (e.g. "Chris Sassouni")
   - Barber email: pull from known fields like `order_details.contact.email` or secondary email fields in the payload (e.g. `csassoni94@gmail.com` found at a nested path)
   - Fallback to `customer_email` if no separate barber email is found

2. Display the **barber name and email** as the primary line (e.g. "Chris Sassouni - csassoni94@gmail.com")

3. Show the **client name** on a separate line prefixed with "Client:" (e.g. "Client: Michael") -- only when the client name differs from the barber name

4. Keep existing status badge, date, tracking, and order specs as-is

### Technical Details

- Extract barber name from `details.full_name || details.name || details.contact?.name`
- Extract barber personal email: search through `details` JSON for secondary emails that differ from `customer_email` (checking paths like nested contact fields, form submission email fields)
- The `customer_name` field in the DB holds the client name (from "Client Name" GHL field), so that stays as the "Client" label
- No database changes needed -- all data is already in `order_details` JSON

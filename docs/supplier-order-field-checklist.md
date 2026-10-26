# Supplier order field checklist (local preparation)

Source inspected at `fa919666`: membership form `src/pages/OrderHairSystem.tsx`, paid draft mapping `supabase/functions/hair-system-checkout/index.ts`, and supplier page `src/pages/ManufacturerOrders.tsx`.

| Checkout field | Paid `orders` storage | `/newtimes` rendering | Limit |
| --- | --- | --- | --- |
| Barber first and last name | `order_details.full_name`, `customer_name` | Name | None for new paid drafts. |
| Barber phone | `order_details.phone` | Phone | Missing legacy values remain absent. |
| Barber email field | Server stores authenticated `user.email` in `customer_email` and `order_details.email` | Email from `customer_email` | The typed form email is not the authoritative saved value. |
| Total orders | One paid row per system; `order_number`, `total_orders` | System number of total | Shown only when both stored numbers are valid. |
| Client name (optional) | `Client Name` | Excluded | Internal reference; existing supplier production email also excludes it. |
| Hair color | `Choose Color` | Hair color | Legacy `Hair Color` alias accepted; missing shown as Not provided. |
| Base | `Lace or Skin` | Base (lace or skin) | Missing shown as Not provided. |
| Hair length | `Hair Length`, custom selection resolved | Hair length | Stored Standard is labeled 5 inches per checkout; absent legacy value is not guessed. |
| Density | `Choose Density`, custom selection resolved | Density | Legacy density key accepted; missing shown as Not provided. |
| Curl pattern | `Curl Pattern` | Curl pattern | Legacy curl key accepted; Standard/Extra straight labels retain checkout measurements. |
| Shipping speed | `shipping.method` | Shipping method | Price is removed from supplier view; legacy shipping line item is accepted. |
| Address line 1, line 2, city, state, ZIP | `shipping.address_1`, `address_2`, `city`, `state`, `zip` | Shipping address | Missing data is marked Not provided; country is not collected on the individual form. |
| Order notes | `notes` | Order notes | Shown only if provided. |
| Save card / payment and price data | Checkout and private paid receipt data | Excluded | Not needed for manufacturing. |
| Older salon service request | Legacy `Hair Salon Service Requested` when present | Salon service requested | Omitted when never collected. |

Prepared kit rows use the confirmed manifest: one #2 skin system, one #2 lace system, color wheel, adhesive, tape, and C22 spray. Once a verified row is inserted, the supplier page reads those stored line items and the explicit GHL shipping address. It does not infer color, density, length, curl, brands, or sizes for the kit.

The notification email contains only the order reference and a protected-page link. The page and order row must exist and show complete shipping before delivery is activated. Customer ownership remains unassigned until a separately verified claim flow exists; the current item-only kit row is not suitable for a member receipt because its amount would display as $0.

# Multi-copy purchase

**Status:** Approved 2026-05-18
**Author:** Jango (via brainstorming)

## Problem

Today the site only sells one copy of *Los Nombres del Bosque* per checkout. Customers who want to buy several copies (gifts, family, workshops) have to either run checkout multiple times or ask over WhatsApp. Add a quantity selector so a single order can include 1–10 copies of the book.

The catalog stays a single SKU. No cart, no other titles.

## Scope

In scope:

- Quantity selector on `index.html` and `productos.html`, beside the price.
- Quantity selector inside the checkout modal (editable), pre-filled from the product page.
- Live price + total update on the product page when qty changes or a discount code validates.
- Server-side qty validation and price calculation in `/api/checkout`.
- `quantity` field in the Formspree submission and the confirmation email.

Out of scope:

- A real cart with line items or multiple SKUs.
- Persisting qty across page reloads or between pages.
- Allowing the discount code to be edited inside the modal (still locked when modal opens, same as today).
- Inventory tracking.

## Behavior

### Quantity rules

- Integer, range `[1, 10]`.
- Default 1.
- The UI stepper enforces the range. The server also clamps to `[1, 10]`: anything outside that range or non-integer becomes 1 silently (no error to the client).

### Pricing

For a given unit price `U` (full $80.000, discounted, or TEST $2.000):

- `bookSubtotal = U × quantity`
- `shipping` = $18.000 flat (qty ≥ 1) — does not scale.
- TEST mode: `shipping = 0` (unchanged).
- `total = bookSubtotal + shipping`

The discount code applies to **every** copy at the discounted unit price. The TEST code likewise applies its unit price to every copy.

### Wompi integrity signature

Recomputed server-side from the new `amountInCents`. No client-side total is ever trusted.

## UI

### Product page (`index.html`, `productos.html`)

A horizontal stepper sits beside the price block:

```
$80.000  [ −  1  + ]  + envío $18.000   Total: $98.000
[Tengo un código]
```

- The minus button is disabled at qty 1; the plus button is disabled at qty 10.
- The displayed price keeps the existing `$80.000` style; a new "× N" suffix appears only when N > 1.
- "Total: $X" is a new element, always visible, that recomputes on:
  - qty change,
  - discount code validation success/failure.

When a discount code validates, the unit price flips to the discounted value (same hook as today) and the total recomputes.

### Checkout modal

A compact stepper appears at the top of Step 1 (above name/email), pre-filled with the qty chosen on the product page. Editing it here updates the running total shown at the bottom of Step 2 ("Total: $X" — same label).

Step 2 also shows a small read-only line:

```
N libros + envío — Total: $X
```

This line replaces nothing; it's added so the customer sees what Wompi will charge before pressing "Pagar".

## Data flow

### Client → `/api/checkout`

```jsonc
{
  "quantity": 3,                     // NEW
  "discountCode": "...",
  "shippingAddress": { ... }
}
```

### `/api/checkout` server logic

1. Parse and clamp `quantity` to integer in `[1, 10]`; fall back to 1 on any other input.
2. Resolve unit price (full / discount / TEST) using existing logic.
3. `amountInCents = unitPrice × quantity + shipping`.
4. Generate reference + signature as today.
5. Respond with the existing payload plus the echoed `quantity` (so the client can render it on success if useful later — not used in v1).

### Formspree submission

The fire-and-forget POST gains `quantity: 3`. No other change.

### Confirmation email

`buildConfirmationEmail({ ..., quantity })` adds one row above "Total":

```
Cantidad     3 libros
Total        $258.000
Método...
```

Singular "1 libro" when qty = 1.

Wompi doesn't echo `quantity` on the transaction, so the reference becomes the source of truth: the format changes from `LNDB-<timestamp>-<rand>` to `LNDB-Q<n>-<timestamp>-<rand>` where `<n>` is the qty. The webhook handler parses the `Q<n>` segment and passes it into `buildConfirmationEmail`. References that don't match the new format (e.g. legacy in-flight orders during deploy) fall back to qty = 1, which simply omits the "Cantidad" row.

## Edge cases

- **Qty 1**: behavior is identical to today (no "× 1" suffix, no plural in email).
- **Discount code invalid + qty > 1**: unit price stays at $80.000, total reflects $80.000 × qty + $18.000.
- **TEST + qty > 1**: $2.000 × qty, no shipping. Still over Wompi's minimum threshold.
- **Stale cached client posts no `quantity` field**: server treats as 1.
- **Out-of-range qty (0, -3, 999, "abc", 3.5)**: server clamps to 1 silently. The UI prevents this anyway; the clamp is defense in depth, not user-facing.

## Files touched

- `index.html` — stepper markup in the `.book-section` price block; small JS hook for live total.
- `productos.html` — same stepper markup in `.product-detail`.
- `js/checkout.js` — qty state per `[data-checkout]` button, modal stepper, live total renderer, send `quantity` to `/api/checkout`, include in Formspree payload.
- `css/styles.css` — stepper styles (button, number, disabled state) and the total-line style.
- `server.js` — `/api/checkout` accepts and clamps `quantity`; reference format changes to include `Q{n}`; webhook parses qty from reference; email template adds qty row and pluralizes.

## Testing

Manual:

- Buy 1, buy 3, buy 10 — confirm Wompi total matches displayed total each time.
- Apply discount code with qty 3 — every copy discounted; total matches `discountPrice × 3 + 18.000`.
- TEST code with qty 2 — `$4.000 COP`, no shipping.
- Try clicking minus below 1 / plus above 10 — buttons are disabled.
- Open modal, change qty, complete checkout — modal qty wins.
- Confirmation email shows "Cantidad: N libros" matching the order.

No automated tests in this repo today; not introducing a framework as part of this change.

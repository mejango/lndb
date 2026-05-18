# Multi-Copy Purchase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers buy 1–10 copies of *Los Nombres del Bosque* in a single Wompi checkout.

**Architecture:** Add a `−/+` quantity stepper on the product pages and inside the existing two-step checkout modal. Client sends `quantity` to `/api/checkout`; the server clamps it to `[1, 10]`, computes `unitPrice × quantity + flat shipping`, and encodes the qty into the Wompi reference (`LNDB-Q<n>-<ts>-<rand>`) so the post-payment webhook can include "Cantidad: N libros" in the confirmation email.

**Tech Stack:** Static HTML/CSS + vanilla JS (`js/checkout.js`), Express server (`server.js`), Wompi Widget Checkout, Formspree, Resend.

**Testing note:** This repo has no automated test framework; the spec explicitly defers introducing one. Verification is by `curl` against `/api/checkout` and manual browser smoke tests after each task. Every task ends with a commit so reverts are clean.

---

## File Structure

- `server.js` — extend `/api/checkout` to accept `quantity`; change reference format; teach the webhook to parse qty and pass it to the email builder; add a `Cantidad` row in the email template.
- `css/styles.css` — append stepper + total-line styles after the existing `.product-actions` block (around line 3507).
- `index.html` — extend the `.book-section` price block with a stepper and total line.
- `productos.html` — extend the `.product-detail` price block with the same stepper and total line.
- `js/checkout.js` — track qty per product-page button; render the live total; build a stepper inside the modal Step 1; show a total summary on Step 2; send `quantity` to `/api/checkout` and Formspree.

All five files change together because they form one user-visible feature. No new modules — the existing single-file `checkout.js` is the right home for the client logic (it already owns modal state, discount-code wiring, and the API call).

---

## Task 1: Server accepts and clamps `quantity`

**Files:**
- Modify: `server.js:66-112` (the `/api/checkout` handler)

Add a `quantity` field that defaults to 1, is clamped to integer `[1, 10]`, multiplies the unit price, and is encoded into the reference.

- [ ] **Step 1: Edit `/api/checkout` to parse and clamp quantity**

Replace the body of the `/api/checkout` handler. The current handler lives at `server.js:66-112` and starts with `app.post('/api/checkout', express.json(), (req, res) => {`.

Replace lines 66–112 with:

```js
// Checkout endpoint
app.post('/api/checkout', express.json(), (req, res) => {
  // Discount code validation
  const discountCode = ((req.body && req.body.discountCode) || '').trim().toUpperCase();
  const isTestMode = discountCode === 'TEST';
  const validCodes = (process.env.DISCOUNT_CODES || '').toUpperCase().split(',').map(c => c.trim()).filter(Boolean);
  const hasDiscount = !!(discountCode && !isTestMode && validCodes.includes(discountCode));

  // Quantity: integer clamped to [1, 10]; anything else falls back to 1
  const rawQty = req.body && req.body.quantity;
  const parsedQty = Number.isFinite(rawQty) ? Math.floor(rawQty) : parseInt(rawQty, 10);
  const quantity = Number.isFinite(parsedQty) && parsedQty >= 1 && parsedQty <= 10 ? parsedQty : 1;

  // Use test credentials when TEST promo code is entered
  const secret = isTestMode ? process.env.WOMPI_TEST_INTEGRITY_SECRET : process.env.WOMPI_INTEGRITY_SECRET;
  const publicKey = isTestMode ? process.env.WOMPI_TEST_PUBLIC_KEY : process.env.WOMPI_PUBLIC_KEY;
  if (!secret || !publicKey) {
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  const unitPrice = isTestMode
    ? 200000
    : hasDiscount
      ? parseInt(process.env.DISCOUNT_PRICE_CENTS || '6800000', 10)
      : parseInt(process.env.BOOK_PRICE_CENTS || '8000000', 10);
  const shipping = isTestMode ? 0 : parseInt(process.env.SHIPPING_COST_CENTS || '1800000', 10);
  const amountInCents = unitPrice * quantity + shipping;
  const currency = 'COP';
  const reference = `LNDB-Q${quantity}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Wompi integrity signature: SHA256(reference + amountInCents + currency + integrity_secret)
  const signature = crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');

  // Require shipping address — old cached clients skip the address form
  const shippingAddress = (req.body && req.body.shippingAddress) || null;
  if (!shippingAddress || !shippingAddress.addressLine1 || !shippingAddress.city || !shippingAddress.phoneNumber) {
    return res.status(400).json({ error: 'Dirección de envío requerida. Por favor recarga la página e intenta de nuevo.' });
  }

  res.json({
    reference,
    amountInCents,
    currency,
    signature,
    publicKey,
    redirectUrl: `${process.env.DOMAIN || ''}/exito.html`,
    discountApplied: hasDiscount,
    quantity,
    shippingAddress
  });
});
```

Key changes vs current:
- Added `rawQty` parse and `quantity` clamp.
- Renamed `bookPrice` → `unitPrice` for clarity.
- `amountInCents = unitPrice * quantity + shipping`.
- Reference format gains `-Q<n>-` segment.
- Response payload echoes `quantity`.

- [ ] **Step 2: Start the server and verify with curl**

Run in one terminal:

```bash
node server.js
```

In another terminal, send a qty-3 request (use a real shipping address shape so the handler doesn't 400):

```bash
curl -s -X POST http://localhost:8080/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"quantity":3,"discountCode":"","shippingAddress":{"addressLine1":"Cra 1 #2-3","city":"Bogotá","phoneNumber":"3001234567"}}' | python3 -m json.tool
```

Expected: JSON response with `"quantity": 3`, `"amountInCents": 25800000` (3 × 8 000 000 + 1 800 000), and a reference starting with `LNDB-Q3-`.

Try qty 1 (omit field):

```bash
curl -s -X POST http://localhost:8080/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"discountCode":"","shippingAddress":{"addressLine1":"x","city":"y","phoneNumber":"1"}}' | python3 -m json.tool
```

Expected: `"quantity": 1`, `"amountInCents": 9800000`, reference starts with `LNDB-Q1-`.

Try out-of-range:

```bash
curl -s -X POST http://localhost:8080/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"quantity":999,"discountCode":"","shippingAddress":{"addressLine1":"x","city":"y","phoneNumber":"1"}}' | python3 -m json.tool
```

Expected: clamped to `"quantity": 1`.

Try TEST mode with qty 2:

```bash
curl -s -X POST http://localhost:8080/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{"quantity":2,"discountCode":"TEST","shippingAddress":{"addressLine1":"x","city":"y","phoneNumber":"1"}}' | python3 -m json.tool
```

Expected (assuming `WOMPI_TEST_*` env vars are set): `"amountInCents": 400000` (2 × $2.000, no shipping), reference starts with `LNDB-Q2-`.

Stop the server (Ctrl-C).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(server): accept quantity 1-10 in /api/checkout, encode in reference"
```

---

## Task 2: Webhook parses qty from reference; email shows "Cantidad"

**Files:**
- Modify: `server.js:126-212` (`buildConfirmationEmail`)
- Modify: `server.js:214-291` (the webhook handler — pass qty into the email builder)

The webhook currently calls `buildConfirmationEmail({ reference, amount, paymentMethod, shippingAddress })`. We'll add `quantity` derived from the `LNDB-Q<n>-...` reference and render it as a new row above "Total".

- [ ] **Step 1: Add a `Cantidad` row to the email template**

Edit `buildConfirmationEmail` (currently at `server.js:126`). Change the function signature and add the row.

Replace the signature line:

```js
function buildConfirmationEmail({ reference, amount, paymentMethod, shippingAddress }) {
```

with:

```js
function buildConfirmationEmail({ reference, amount, paymentMethod, shippingAddress, quantity }) {
```

Then add this row to the order-details table. Find the `<tr>` that contains `"Referencia"` (around line 175–179) and insert a new row immediately after the closing `</tr>` of the Referencia row, before the `"Total"` row:

```js
            ${quantity && quantity > 0 ? `<tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Cantidad</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${quantity} ${quantity === 1 ? 'libro' : 'libros'}</td>
            </tr>` : ''}
```

Concretely, the relevant block becomes:

```js
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Referencia</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${reference}</td>
            </tr>
            ${quantity && quantity > 0 ? `<tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Cantidad</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${quantity} ${quantity === 1 ? 'libro' : 'libros'}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Total</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;font-weight:bold;">${formatted}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Método de pago</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${method}</td>
            </tr>
          </table>
```

- [ ] **Step 2: Parse qty from the reference in the webhook**

In `app.post('/api/wompi-webhook', ...)` (currently `server.js:214`), find the call to `buildConfirmationEmail` (around line 275 inside the `await resendClient.emails.send` call).

Just above that block — after `processedReferences.add(transaction.reference);` (around line 257) — add:

```js
    // Parse quantity from reference (format: LNDB-Q<n>-<ts>-<rand>; legacy: LNDB-<ts>-<rand>)
    const qtyMatch = /^LNDB-Q(\d+)-/.exec(transaction.reference || '');
    const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
```

Then update the `buildConfirmationEmail` call to pass `quantity`:

```js
      html: buildConfirmationEmail({
        reference: transaction.reference,
        amount: transaction.amount_in_cents,
        paymentMethod: transaction.payment_method_type,
        shippingAddress: transaction.shipping_address,
        quantity,
      }),
```

Note: legacy references (without `Q<n>`) resolve to `quantity = 1`. With `quantity === 1` the email still renders the "Cantidad: 1 libro" row, which is fine — it's accurate.

- [ ] **Step 3: Smoke-test the email template by calling the builder directly**

Add a tiny ad-hoc script — do NOT commit this script. Create `tmp_email_check.js`:

```js
const fs = require('fs');
// Load server.js's buildConfirmationEmail by requiring server.js would start the listener.
// Instead, just sanity-check our changes by reading the file.
const src = fs.readFileSync('server.js', 'utf8');
['Cantidad', 'libro', 'libros', '/^LNDB-Q(\\d+)-/', 'quantity,'].forEach(needle => {
  console.log(needle, '→', src.includes(needle.replace(/\\\\/g, '\\')) ? 'OK' : 'MISSING');
});
```

Run:

```bash
node tmp_email_check.js
```

Expected: every line ends with `OK`. Then delete the file:

```bash
rm tmp_email_check.js
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat(email): show 'Cantidad: N libros' in order confirmation"
```

---

## Task 3: Stepper and total-line CSS

**Files:**
- Modify: `css/styles.css` (append after line 3507, the end of the existing `.product-actions` block)

Add styles for the `−/+` stepper, the running total, and a smaller variant for the modal.

- [ ] **Step 1: Append stepper styles**

Open `css/styles.css` and add at the end of file (or after `.product-actions { ... }` around line 3507):

```css
/* ===== QUANTITY STEPPER ===== */
.qty-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
  vertical-align: middle;
}

.qty-stepper-btn {
  width: 32px;
  height: 32px;
  border: 1.5px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.03);
  color: var(--color-forest);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, background 0.2s;
  padding: 0;
}

.qty-stepper-btn:hover:not(:disabled) {
  border-color: var(--color-sage);
}

.qty-stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.qty-stepper-value {
  min-width: 28px;
  text-align: center;
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-forest);
  user-select: none;
}

.product-total {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-forest);
  margin-top: 0.5rem;
  margin-bottom: 0;
}

.product-total-label {
  font-weight: 400;
  color: var(--color-text-muted);
  margin-right: 0.25rem;
}

/* Modal variant: full-width row inside the modal step */
.checkout-modal .qty-stepper-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.checkout-modal .qty-stepper-row-label {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-forest);
  font-weight: 500;
}

.checkout-modal .checkout-total-line {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-forest);
  font-weight: 600;
  margin: 0.5rem 0 1rem;
  text-align: right;
}

.checkout-modal .checkout-total-line .checkout-total-label {
  font-weight: 400;
  color: var(--color-text-muted);
  margin-right: 0.25rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/styles.css
git commit -m "style: add quantity stepper and product-total styles"
```

---

## Task 4: Stepper markup in `index.html` and `productos.html`

**Files:**
- Modify: `index.html:108-112` (book-section price block)
- Modify: `productos.html:33-37` (product-detail price block)

Add the stepper next to the price and a total line below the discount toggle. The page is intentionally still readable with JS off (stepper just shows "1" and doesn't react — total line is rendered by JS).

- [ ] **Step 1: Update `index.html`**

Find this block (around line 108):

```html
        <p class="product-price">$80.000 <span class="product-price-detail">+ envío $18.000</span> <a href="#" class="discount-toggle" onclick="this.style.display='none';this.nextElementSibling.style.display='';this.nextElementSibling.querySelector('input').focus();return false">Tengo un código</a><span class="discount-field" style="display:none"><input type="text" data-discount-code placeholder="Código de descuento" class="discount-input" aria-label="Código de descuento"></span></p>
        <div class="product-actions">
          <button class="btn btn-primary" data-checkout id="book-cta">Comprar libro</button>
          <a href="productos.html" class="btn btn-outline">Más información</a>
        </div>
```

Replace with:

```html
        <p class="product-price">$80.000 <span class="product-price-detail">+ envío $18.000</span>
          <span class="qty-stepper" data-qty-stepper>
            <button type="button" class="qty-stepper-btn" data-qty-minus aria-label="Disminuir cantidad">−</button>
            <span class="qty-stepper-value" data-qty-value>1</span>
            <button type="button" class="qty-stepper-btn" data-qty-plus aria-label="Aumentar cantidad">+</button>
          </span>
          <a href="#" class="discount-toggle" onclick="this.style.display='none';this.nextElementSibling.style.display='';this.nextElementSibling.querySelector('input').focus();return false">Tengo un código</a><span class="discount-field" style="display:none"><input type="text" data-discount-code placeholder="Código de descuento" class="discount-input" aria-label="Código de descuento"></span>
        </p>
        <p class="product-total" data-product-total><span class="product-total-label">Total:</span>$98.000</p>
        <div class="product-actions">
          <button class="btn btn-primary" data-checkout id="book-cta">Comprar libro</button>
          <a href="productos.html" class="btn btn-outline">Más información</a>
        </div>
```

- [ ] **Step 2: Update `productos.html`**

Find this block (around line 33):

```html
        <p class="product-price">$80.000 <span class="product-price-detail">+ envío $18.000</span> <a href="#" class="discount-toggle" onclick="this.style.display='none';this.nextElementSibling.style.display='';this.nextElementSibling.querySelector('input').focus();return false">Tengo un código</a><span class="discount-field" style="display:none"><input type="text" data-discount-code placeholder="Código de descuento" class="discount-input" aria-label="Código de descuento"></span></p>
        <div class="product-actions">
          <button class="btn btn-primary" data-checkout>Comprar libro</button>
          <a href="https://wa.me/573013784227?text=Hola%2C%20quiero%20conocer%20el%20libro%20Los%20Nombres%20del%20Bosque" target="_blank" rel="noopener" class="btn btn-outline" data-whatsapp="libro">Escríbenos por WhatsApp</a>
        </div>
```

Replace with:

```html
        <p class="product-price">$80.000 <span class="product-price-detail">+ envío $18.000</span>
          <span class="qty-stepper" data-qty-stepper>
            <button type="button" class="qty-stepper-btn" data-qty-minus aria-label="Disminuir cantidad">−</button>
            <span class="qty-stepper-value" data-qty-value>1</span>
            <button type="button" class="qty-stepper-btn" data-qty-plus aria-label="Aumentar cantidad">+</button>
          </span>
          <a href="#" class="discount-toggle" onclick="this.style.display='none';this.nextElementSibling.style.display='';this.nextElementSibling.querySelector('input').focus();return false">Tengo un código</a><span class="discount-field" style="display:none"><input type="text" data-discount-code placeholder="Código de descuento" class="discount-input" aria-label="Código de descuento"></span>
        </p>
        <p class="product-total" data-product-total><span class="product-total-label">Total:</span>$98.000</p>
        <div class="product-actions">
          <button class="btn btn-primary" data-checkout>Comprar libro</button>
          <a href="https://wa.me/573013784227?text=Hola%2C%20quiero%20conocer%20el%20libro%20Los%20Nombres%20del%20Bosque" target="_blank" rel="noopener" class="btn btn-outline" data-whatsapp="libro">Escríbenos por WhatsApp</a>
        </div>
```

- [ ] **Step 3: Smoke-test rendering**

Run the server:

```bash
node server.js
```

Open `http://localhost:8080/` and `http://localhost:8080/productos.html` in a browser. Confirm visually:

- A `− 1 +` stepper appears beside the price.
- "Total: $98.000" appears below the price line.
- The minus and plus buttons are styled but do nothing yet (JS not wired).
- The "Comprar libro" button still opens the modal as today.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add index.html productos.html
git commit -m "feat(ui): add qty stepper and total line to product pages"
```

---

## Task 5: Wire stepper + live total in `js/checkout.js`

**Files:**
- Modify: `js/checkout.js:306-353` (the binding loop at the bottom)

Track qty per `[data-checkout]` button. On +/− clicks, update the stepper, the buttons' disabled state, and the running total. Re-compute when the discount-code validator returns a new unit price.

- [ ] **Step 1: Add quantity helpers above the binding loop**

In `js/checkout.js`, find the comment line `// ---- Bind buttons ----` (around line 306) and insert this block immediately above it (so the helpers are in scope for the bindings below):

```js
  // ---- Quantity helpers ----
  var MIN_QTY = 1;
  var MAX_QTY = 10;
  var SHIPPING_CENTS = 1800000; // $18.000 — must match SHIPPING_COST_CENTS on server
  var DEFAULT_UNIT_CENTS = 8000000; // $80.000 — full price

  function formatCop(cents) {
    return '$' + (cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function parseCop(str) {
    // "$80.000" or "$80.000 " → 8000000 (cents)
    var digits = (str || '').replace(/[^0-9]/g, '');
    var cents = digits ? parseInt(digits, 10) * 100 : DEFAULT_UNIT_CENTS;
    return cents;
  }

  function getUnitCents(section) {
    var priceEl = section ? section.querySelector('.product-price') : null;
    if (!priceEl) return DEFAULT_UNIT_CENTS;
    return parseCop(priceEl.childNodes[0].textContent);
  }

  function getQty(section) {
    var valueEl = section ? section.querySelector('[data-qty-value]') : null;
    if (!valueEl) return 1;
    var n = parseInt(valueEl.textContent, 10);
    return n >= MIN_QTY && n <= MAX_QTY ? n : 1;
  }

  function renderTotal(section) {
    if (!section) return;
    var totalEl = section.querySelector('[data-product-total]');
    if (!totalEl) return;
    var qty = getQty(section);
    var unit = getUnitCents(section);
    var total = unit * qty + SHIPPING_CENTS;
    totalEl.innerHTML = '<span class="product-total-label">Total:</span>' + formatCop(total);
  }

  function updateStepperButtons(section) {
    if (!section) return;
    var qty = getQty(section);
    var minus = section.querySelector('[data-qty-minus]');
    var plus = section.querySelector('[data-qty-plus]');
    if (minus) minus.disabled = qty <= MIN_QTY;
    if (plus) plus.disabled = qty >= MAX_QTY;
  }

  function setQty(section, qty) {
    if (!section) return;
    var clamped = Math.max(MIN_QTY, Math.min(MAX_QTY, qty | 0));
    var valueEl = section.querySelector('[data-qty-value]');
    if (valueEl) valueEl.textContent = String(clamped);
    updateStepperButtons(section);
    renderTotal(section);
  }
```

- [ ] **Step 2: Wire stepper buttons inside the binding loop**

Find the existing `document.querySelectorAll('[data-checkout]').forEach(function (btn) {` loop (around line 307) and add this block at the top of the loop body (right after `var section = btn.closest(...)`):

```js
    // Stepper wiring (no-op if the markup is absent)
    var minusBtn = section ? section.querySelector('[data-qty-minus]') : null;
    var plusBtn = section ? section.querySelector('[data-qty-plus]') : null;
    if (minusBtn) {
      minusBtn.addEventListener('click', function () {
        setQty(section, getQty(section) - 1);
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('click', function () {
        setQty(section, getQty(section) + 1);
      });
    }
    updateStepperButtons(section);
    renderTotal(section);
```

- [ ] **Step 3: Recompute total when discount code validates**

Inside the same loop, find the `.then(function (data) {` block that handles `/api/validate-code` results (around lines 331–341). Inside both the `if (data.valid)` and `else` branches, after the existing `priceEl.childNodes[0].textContent = ...` line, add a call to `renderTotal(section)`.

Concretely, change:

```js
              if (data.valid) {
                track('Discount Code Applied', { props: { code: code } });
                priceEl.childNodes[0].textContent = data.priceFormatted + ' ';
                codeInput.classList.add('discount-valid');
                codeInput.classList.remove('discount-invalid');
              } else {
                priceEl.childNodes[0].textContent = originalPrice + ' ';
                codeInput.classList.add('discount-invalid');
                codeInput.classList.remove('discount-valid');
              }
```

to:

```js
              if (data.valid) {
                track('Discount Code Applied', { props: { code: code } });
                priceEl.childNodes[0].textContent = data.priceFormatted + ' ';
                codeInput.classList.add('discount-valid');
                codeInput.classList.remove('discount-invalid');
              } else {
                priceEl.childNodes[0].textContent = originalPrice + ' ';
                codeInput.classList.add('discount-invalid');
                codeInput.classList.remove('discount-valid');
              }
              renderTotal(section);
```

Also add a `renderTotal(section)` call inside the empty-code branch (`if (!code) { ... }`):

```js
        if (!code) {
          if (priceEl) priceEl.childNodes[0].textContent = originalPrice + ' ';
          codeInput.classList.remove('discount-valid', 'discount-invalid');
          renderTotal(section);
          return;
        }
```

- [ ] **Step 4: Smoke-test in the browser**

```bash
node server.js
```

Open `http://localhost:8080/`:

- Click `+` three times — value goes 1 → 2 → 3 → 4. Total updates: $98.000 → $178.000 → $258.000 → $338.000 ($80.000 × N + $18.000).
- Hold `+` at 10 — button disables. Confirm clicking once more does nothing.
- Click `−` back down to 1 — minus disables at 1.
- Click "Tengo un código", type a valid discount code (or `TEST`) — the displayed unit price changes and the total recomputes correctly.
- Type an invalid code — total returns to using the original unit price.

Repeat on `http://localhost:8080/productos.html`.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add js/checkout.js
git commit -m "feat(checkout): wire qty stepper and live total on product pages"
```

---

## Task 6: Modal stepper, modal total line, and `quantity` in API/Formspree payloads

**Files:**
- Modify: `js/checkout.js:26-84` (modal HTML builder)
- Modify: `js/checkout.js:91-271` (`openModal` — sync qty, render totals, send qty)

- [ ] **Step 1: Add stepper + total markup to the modal HTML**

In `buildModal` (around line 26), modify the Step 1 and Step 2 inner HTML.

For Step 1, find:

```js
          // Step 1
          '<div class="checkout-step active" id="checkout-step-1">' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-name">Nombre completo</label>' +
              '<input type="text" id="checkout-name" required placeholder="Tu nombre">' +
            '</div>' +
```

Insert a stepper row directly after the `<div class="checkout-step active" id="checkout-step-1">` opener:

```js
          // Step 1
          '<div class="checkout-step active" id="checkout-step-1">' +
            '<div class="qty-stepper-row">' +
              '<span class="qty-stepper-row-label">Cantidad</span>' +
              '<span class="qty-stepper" data-modal-qty-stepper>' +
                '<button type="button" class="qty-stepper-btn" data-modal-qty-minus aria-label="Disminuir cantidad">−</button>' +
                '<span class="qty-stepper-value" data-modal-qty-value>1</span>' +
                '<button type="button" class="qty-stepper-btn" data-modal-qty-plus aria-label="Aumentar cantidad">+</button>' +
              '</span>' +
            '</div>' +
            '<div class="checkout-modal-field">' +
              '<label for="checkout-name">Nombre completo</label>' +
              '<input type="text" id="checkout-name" required placeholder="Tu nombre">' +
            '</div>' +
```

For Step 2, find the "Pagar" button:

```js
            '<button class="btn btn-primary" id="checkout-pay">Pagar</button>' +
            '<button class="checkout-modal-back" id="checkout-back">&larr; Volver</button>' +
          '</div>' +
```

Insert a total summary line directly above the Pagar button:

```js
            '<p class="checkout-total-line" id="checkout-total-line"><span class="checkout-total-label">Total:</span>$98.000</p>' +
            '<button class="btn btn-primary" id="checkout-pay">Pagar</button>' +
            '<button class="checkout-modal-back" id="checkout-back">&larr; Volver</button>' +
          '</div>' +
```

- [ ] **Step 2: Sync modal qty with the product page when opening, and render modal total**

In `openModal(btn)` (around line 91), after the existing element lookups (the `var closeBtn = ...` line, around line 106), add:

```js
    // Modal qty stepper
    var modalQtyValue = overlay.querySelector('[data-modal-qty-value]');
    var modalQtyMinus = overlay.querySelector('[data-modal-qty-minus]');
    var modalQtyPlus = overlay.querySelector('[data-modal-qty-plus]');
    var modalTotalLine = overlay.querySelector('#checkout-total-line');

    // Pre-fill from the product page section the button belongs to
    var section = btn.closest('.product-text, .book-section, section');
    var initialQty = getQty(section);
    var modalQty = initialQty;

    function renderModalTotal() {
      var unit = getUnitCents(section);
      var total = unit * modalQty + SHIPPING_CENTS;
      if (modalTotalLine) {
        modalTotalLine.innerHTML = '<span class="checkout-total-label">Total:</span>' + formatCop(total);
      }
      if (modalQtyValue) modalQtyValue.textContent = String(modalQty);
      if (modalQtyMinus) modalQtyMinus.disabled = modalQty <= MIN_QTY;
      if (modalQtyPlus) modalQtyPlus.disabled = modalQty >= MAX_QTY;
    }

    if (modalQtyMinus) {
      modalQtyMinus.addEventListener('click', function () {
        if (modalQty > MIN_QTY) { modalQty--; renderModalTotal(); }
      });
    }
    if (modalQtyPlus) {
      modalQtyPlus.addEventListener('click', function () {
        if (modalQty < MAX_QTY) { modalQty++; renderModalTotal(); }
      });
    }
    renderModalTotal();
```

Note: there's an existing `var section = currentBtn.closest(...)` further down in the `payBtn` click handler (around line 179). We've now declared `section` earlier in the same function — change that later occurrence to reuse the outer `section` variable. Find:

```js
      // Read discount code from the page (outside modal)
      var section = currentBtn.closest('.product-text, .book-section, section');
      var codeInput = section ? section.querySelector('[data-discount-code]') : null;
      var discountCode = codeInput ? codeInput.value.trim() : '';
```

Change to:

```js
      // Read discount code from the page (outside modal)
      var codeInput = section ? section.querySelector('[data-discount-code]') : null;
      var discountCode = codeInput ? codeInput.value.trim() : '';
```

(Just delete the now-redundant `var section = currentBtn.closest(...)` line.)

- [ ] **Step 3: Send `quantity` to the API and Formspree**

Still inside the `payBtn` click handler. Find the Formspree `formData` object (around line 166):

```js
      var formData = {
        name: collected.name,
        email: collected.email,
        address: collected.address,
        city: collected.city,
        department: collected.department,
        phone: collected.phone,
        notes: collected.notes || '',
        _subject: 'Nueva orden',
        source: 'checkout'
      };
```

Change to:

```js
      var formData = {
        name: collected.name,
        email: collected.email,
        address: collected.address,
        city: collected.city,
        department: collected.department,
        phone: collected.phone,
        notes: collected.notes || '',
        quantity: modalQty,
        _subject: 'Nueva orden',
        source: 'checkout'
      };
```

Find the `/api/checkout` POST body (around line 204):

```js
      // Call /api/checkout, then open Wompi
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountCode: discountCode,
          shippingAddress: shippingAddress
        })
      })
```

Change to:

```js
      // Call /api/checkout, then open Wompi
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: modalQty,
          discountCode: discountCode,
          shippingAddress: shippingAddress
        })
      })
```

- [ ] **Step 4: Smoke-test the full flow without paying**

```bash
node server.js
```

Open browser → `http://localhost:8080/`:

- Set product-page qty to 3. Click "Comprar libro".
- Modal opens with "Cantidad" showing 3, and Step 1's button is "Siguiente".
- Click `+` once in the modal — value becomes 4.
- Click `−` twice — value becomes 2.
- Fill name/email → Siguiente. On Step 2, see "Total: $178.000" above the Pagar button ($80.000 × 2 + $18.000).
- Open DevTools → Network. Fill the address fields and click "Pagar". Inspect the request to `/api/checkout` — body should include `"quantity":2`. The response should include `"quantity":2`, `"amountInCents":17800000`, and a reference starting with `LNDB-Q2-`.
- The Wompi widget opens. Don't pay — close it.

Repeat on `productos.html` to confirm symmetry.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add js/checkout.js
git commit -m "feat(checkout): modal qty stepper, total summary, send quantity to API"
```

---

## Task 7: End-to-end manual verification

**Files:** none (manual verification + final commit if anything needed fixing)

- [ ] **Step 1: Run the full happy path with TEST mode**

Requires `WOMPI_TEST_PUBLIC_KEY` and `WOMPI_TEST_INTEGRITY_SECRET` in `.env`.

```bash
node server.js
```

In the browser:

1. Open `http://localhost:8080/`, set qty to 3, click "Comprar libro".
2. Inside the modal, click "Tengo un código" is on the product page — close the modal, enter `TEST` on the product page, reopen the modal. (TEST applies because the modal reads the discount code from the page.)
3. Confirm modal "Total" shows `$6.000` (3 × $2.000, no shipping).
4. Walk through Step 1 → Step 2, click "Pagar".
5. Verify the network request body has `"quantity":3,"discountCode":"TEST"` and the response shows `amountInCents: 600000` and reference `LNDB-Q3-...`.
6. Pay via test card (see `docs/` or `.env` comments for Wompi test card details), or close the widget if you only want to verify the request shape.

If a successful APPROVED transaction triggers the webhook, the confirmation email should include a "Cantidad: 3 libros" row.

- [ ] **Step 2: Edge-case sweep**

- Qty 1 path: page total `$98.000`, modal total `$98.000`, request body `"quantity":1`, response reference `LNDB-Q1-`.
- Qty 10 cap: `+` disables on the page and in the modal at 10.
- Qty 1 floor: `−` disables on the page and in the modal at 1.
- Reload the page after setting qty — qty resets to 1 (spec: no persistence).
- Discount code applied then qty changed → total recomputes against discounted unit price.
- Open modal with qty 3 on the page; change discount code in the modal — note: discount code is *not* editable in the modal (existing behavior, unchanged). Confirm.

- [ ] **Step 3: Final review of the change set**

```bash
git log --oneline main..HEAD
```

Expected six new commits from this plan: server qty, email cantidad, css, html, page JS, modal JS.

```bash
git diff main..HEAD --stat
```

Should touch only: `server.js`, `css/styles.css`, `index.html`, `productos.html`, `js/checkout.js`, plus the spec/plan docs.

- [ ] **Step 4: Bump the cache-buster on `checkout.js` includes**

In `index.html:138` and `productos.html:87`, the script tag is `<script src="js/checkout.js?v=8aaa91e"></script>`. Pick a new short hash (use `git rev-parse --short HEAD` after the previous commit, or just increment to a memorable token) and update both files.

```bash
NEW_V=$(git rev-parse --short HEAD)
```

Then in `index.html` and `productos.html`, change `?v=8aaa91e` to `?v=$NEW_V` (use the literal value, not the variable — Edit doesn't interpolate).

Commit:

```bash
git add index.html productos.html
git commit -m "chore: bump checkout.js cache-buster"
```

- [ ] **Step 5: Done**

The branch is ready to merge or push to staging. No code remains to write.

---

## Self-Review Notes

- **Spec coverage:** Quantity 1–10 (Task 1), flat shipping (Task 1), per-copy discount (Task 1 via unit-price × qty), product-page stepper (Tasks 3–5), modal stepper (Tasks 3, 6), live total (Tasks 5, 6), qty in Formspree (Task 6), qty in email (Task 2), reference format (Tasks 1, 2). All covered.
- **Type/name consistency:** `MIN_QTY`/`MAX_QTY`/`SHIPPING_CENTS`/`DEFAULT_UNIT_CENTS` constants reused across helpers and modal. Data attributes (`data-qty-*` on page, `data-modal-qty-*` in modal) deliberately separated to avoid query-selector collisions. Function names (`getQty`, `setQty`, `renderTotal`, `updateStepperButtons`, `getUnitCents`, `formatCop`, `parseCop`) are used consistently in Tasks 5 and 6.
- **Placeholders:** none. Every step has the actual code/markup or the exact verification command.
- **Test framework:** intentionally absent — verification is manual `curl` and browser smoke tests, as the spec dictates.

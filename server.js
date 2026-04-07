const express = require('express');
const crypto = require('crypto');
const fs = require('fs');

// Load .env file if present (no extra dependency)
try {
  const env = fs.readFileSync('.env', 'utf8');
  env.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !process.env[key.trim()]) process.env[key.trim()] = val.join('=').trim();
  });
} catch (_) { /* no .env file — use system env vars */ }

const app = express();
const PORT = process.env.PORT || 8080;

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Static files with caching
app.use(express.static('.', {
  maxAge: '7d',
  setHeaders(res, filePath) {
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp3)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// Checkout endpoint
app.post('/api/checkout', express.json(), (req, res) => {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  // Discount code validation
  const discountCode = ((req.body && req.body.discountCode) || '').trim().toUpperCase();
  const validCodes = (process.env.DISCOUNT_CODES || '').toUpperCase().split(',').map(c => c.trim()).filter(Boolean);
  const hasDiscount = !!(discountCode && validCodes.includes(discountCode));

  const bookPrice = hasDiscount
    ? parseInt(process.env.DISCOUNT_PRICE_CENTS || '6800000', 10)
    : parseInt(process.env.BOOK_PRICE_CENTS || '8000000', 10);
  const shipping = parseInt(process.env.SHIPPING_COST_CENTS || '1500000', 10);
  const amountInCents = bookPrice + shipping;
  const currency = 'COP';
  const reference = `LNDB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Wompi integrity signature: SHA256(reference + amountInCents + currency + integrity_secret)
  const signature = crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');

  res.json({
    reference,
    amountInCents,
    currency,
    signature,
    publicKey: process.env.WOMPI_PUBLIC_KEY,
    redirectUrl: `${process.env.DOMAIN || ''}/exito.html`,
    discountApplied: hasDiscount
  });
});

// Wompi webhook — forward buyer email to Formspree on approved transactions
app.post('/api/wompi-webhook', express.json(), (req, res) => {
  res.sendStatus(200); // respond immediately so Wompi doesn't retry

  const event = req.body;
  if (!event || event.event !== 'transaction.updated') return;

  const tx = event.data && event.data.transaction;
  if (!tx || tx.status !== 'APPROVED' || !tx.customer_email) return;

  const formspreeId = process.env.FORMSPREE_ID;
  if (!formspreeId) {
    console.log('Webhook: FORMSPREE_ID not set, skipping email forward');
    return;
  }

  fetch(`https://formspree.io/f/${formspreeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tx.customer_email,
      _subject: 'Nueva compra — Los Nombres del Bosque',
      reference: tx.reference,
      amount: tx.amount_in_cents / 100
    })
  }).catch(err => console.error('Formspree error:', err.message));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

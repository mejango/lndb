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
const HTML_CACHE_SECONDS = parseInt(process.env.HTML_CACHE_SECONDS || '0', 10);
const CODE_ASSET_CACHE_SECONDS = parseInt(process.env.CODE_ASSET_CACHE_SECONDS || '300', 10);
const STATIC_ASSET_CACHE_SECONDS = parseInt(process.env.STATIC_ASSET_CACHE_SECONDS || '604800', 10);

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Static files with caching
app.use(express.static('.', {
  setHeaders(res, filePath) {
    if (/\.html$/.test(filePath)) {
      res.setHeader('Cache-Control', HTML_CACHE_SECONDS > 0
        ? `public, max-age=${HTML_CACHE_SECONDS}, must-revalidate`
        : 'no-cache, must-revalidate');
      return;
    }

    if (/\.(css|js)$/.test(filePath)) {
      res.setHeader('Cache-Control', `public, max-age=${CODE_ASSET_CACHE_SECONDS}, must-revalidate`);
      return;
    }

    if (/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp3)$/.test(filePath)) {
      res.setHeader('Cache-Control', `public, max-age=${STATIC_ASSET_CACHE_SECONDS}, must-revalidate`);
    }
  }
}));

// Validate discount code
app.post('/api/validate-code', express.json(), (req, res) => {
  const discountCode = ((req.body && req.body.code) || '').trim().toUpperCase();
  const validCodes = (process.env.DISCOUNT_CODES || '').toUpperCase().split(',').map(c => c.trim()).filter(Boolean);
  const valid = !!(discountCode && validCodes.includes(discountCode));
  const bookPrice = valid
    ? parseInt(process.env.DISCOUNT_PRICE_CENTS || '6800000', 10)
    : parseInt(process.env.BOOK_PRICE_CENTS || '8000000', 10);
  var price = (bookPrice / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  res.json({ valid, priceFormatted: '$' + price });
});

// Checkout endpoint
app.post('/api/checkout', express.json(), (req, res) => {
  const secret = process.env.WOMPI_INTEGRITY_SECRET;
  const publicKey = process.env.WOMPI_PUBLIC_KEY;
  if (!secret || !publicKey) {
    return res.status(500).json({ error: 'Checkout not configured' });
  }

  // Discount code validation
  const discountCode = ((req.body && req.body.discountCode) || '').trim().toUpperCase();
  const validCodes = (process.env.DISCOUNT_CODES || '').toUpperCase().split(',').map(c => c.trim()).filter(Boolean);
  const hasDiscount = !!(discountCode && validCodes.includes(discountCode));

  const bookPrice = hasDiscount
    ? parseInt(process.env.DISCOUNT_PRICE_CENTS || '6800000', 10)
    : parseInt(process.env.BOOK_PRICE_CENTS || '8000000', 10);
  const shipping = parseInt(process.env.SHIPPING_COST_CENTS || '1800000', 10);
  const amountInCents = bookPrice + shipping;
  const currency = 'COP';
  const reference = `LNDB-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  // Wompi integrity signature: SHA256(reference + amountInCents + currency + integrity_secret)
  const signature = crypto
    .createHash('sha256')
    .update(`${reference}${amountInCents}${currency}${secret}`)
    .digest('hex');

  // Pass through shipping address for Wompi widget
  const shippingAddress = (req.body && req.body.shippingAddress) || null;

  res.json({
    reference,
    amountInCents,
    currency,
    signature,
    publicKey,
    redirectUrl: `${process.env.DOMAIN || ''}/exito.html`,
    discountApplied: hasDiscount,
    shippingAddress
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

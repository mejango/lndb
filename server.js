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

const { Resend } = require('resend');

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
    shippingAddress
  });
});

// --- Wompi webhook: post-purchase confirmation email ---

const processedReferences = new Set();

const PAYMENT_METHOD_LABELS = {
  CARD: 'Tarjeta',
  NEQUI: 'Nequi',
  PSE: 'PSE',
  BANCOLOMBIA_TRANSFER: 'Bancolombia',
  BANCOLOMBIA_COLLECT: 'Bancolombia',
};

function buildConfirmationEmail({ reference, amount, paymentMethod, shippingAddress }) {
  const domain = process.env.DOMAIN || '';
  const formatted = '$' + (amount / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const method = PAYMENT_METHOD_LABELS[paymentMethod] || paymentMethod || '—';
  const addressBlock = shippingAddress
    ? `<tr>
        <td style="padding:24px 32px 0;">
          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Dirección de envío</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;line-height:1.5;">
            ${shippingAddress.address_line_1 || ''}${shippingAddress.address_line_2 ? ', ' + shippingAddress.address_line_2 : ''}<br>
            ${shippingAddress.city || ''}${shippingAddress.region ? ', ' + shippingAddress.region : ''}<br>
            ${shippingAddress.phone_number ? 'Tel: ' + shippingAddress.phone_number : ''}
          </p>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F5EDE0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5EDE0;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
      <!-- Logo -->
      <tr>
        <td align="center" style="padding:40px 32px 24px;background-color:#3B4A3A;">
          <img src="${domain}/assets/logos/Logo_Ppal_LNDB.png" alt="Los Nombres del Bosque" width="180" style="display:block;max-width:180px;height:auto;">
        </td>
      </tr>
      <!-- Heading -->
      <tr>
        <td style="padding:32px 32px 8px;">
          <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;color:#3B4A3A;text-align:center;">Tu bosque está en camino</h1>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:8px 32px 24px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;line-height:1.6;text-align:center;">
            Gracias por darle nombre a un árbol. Tu libro ya comenzó su viaje hacia ti — pronto tendrás en tus manos un pedacito del bosque.
          </p>
        </td>
      </tr>
      <!-- Divider -->
      <tr><td style="padding:0 32px;"><hr style="border:none;border-top:1px solid #E8DFD0;margin:0;"></td></tr>
      <!-- Order details -->
      <tr>
        <td style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Referencia</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${reference}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Total</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;font-weight:bold;">${formatted}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#7E8E6D;">Método de pago</td>
              <td align="right" style="padding:6px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#3B4A3A;">${method}</td>
            </tr>
          </table>
        </td>
      </tr>
      ${addressBlock}
      <!-- Divider -->
      <tr><td style="padding:24px 32px 0;"><hr style="border:none;border-top:1px solid #E8DFD0;margin:0;"></td></tr>
      <!-- WhatsApp CTA -->
      <tr>
        <td align="center" style="padding:24px 32px;">
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#7E8E6D;">¿Preguntas sobre tu pedido?</p>
          <a href="https://wa.me/573013784227" style="display:inline-block;padding:12px 28px;background-color:#D4856E;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:14px;text-decoration:none;border-radius:6px;">Escríbenos por WhatsApp</a>
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td align="center" style="padding:24px 32px 32px;background-color:#F9F5EF;">
          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#7E8E6D;font-style:italic;">Cada árbol tiene un nombre. Cada nombre, una historia.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

app.post('/api/wompi-webhook', express.json(), async (req, res) => {
  // Respond 200 immediately — Wompi retries on non-200
  res.status(200).json({ ok: true });

  try {
    const event = req.body;
    if (event.event !== 'transaction.updated') return;

    const transaction = event.data && event.data.transaction;
    if (!transaction || transaction.status !== 'APPROVED') return;

    // Verify checksum
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET;
    if (!eventsSecret) {
      console.error('[webhook] WOMPI_EVENTS_SECRET not configured');
      return;
    }

    const sig = event.signature || {};
    if (!sig.properties || !sig.checksum || sig.timestamp == null) return;

    const values = sig.properties.map(prop => {
      const keys = prop.split('.');
      let val = event.data;
      for (const key of keys) val = val && val[key];
      return val;
    });
    const concat = values.join('') + sig.timestamp + eventsSecret;
    const computed = crypto.createHash('sha256').update(concat).digest('hex');

    if (computed.toUpperCase() !== sig.checksum.toUpperCase()) {
      console.error('[webhook] Invalid checksum for ref:', transaction.reference);
      return;
    }

    // Duplicate guard
    if (processedReferences.has(transaction.reference)) {
      console.log('[webhook] Duplicate, skipping:', transaction.reference);
      return;
    }
    processedReferences.add(transaction.reference);

    // Send confirmation email
    const email = transaction.customer_email;
    if (!email) {
      console.error('[webhook] No customer email for ref:', transaction.reference);
      return;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error('[webhook] RESEND_API_KEY not configured');
      return;
    }
    const resendClient = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resendClient.emails.send({
      from: process.env.RESEND_FROM || 'Los Nombres del Bosque <onboarding@resend.dev>',
      to: [email],
      subject: 'Tu bosque está en camino 🌿',
      html: buildConfirmationEmail({
        reference: transaction.reference,
        amount: transaction.amount_in_cents,
        paymentMethod: transaction.payment_method_type,
        shippingAddress: transaction.shipping_address,
      }),
    });

    if (error) {
      console.error('[webhook] Resend error for', transaction.reference, error);
    } else {
      console.log('[webhook] Email sent:', transaction.reference, '→', email, data.id);
    }
  } catch (err) {
    console.error('[webhook] Error:', err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

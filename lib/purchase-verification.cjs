const crypto = require('node:crypto');

const sign = (value, secret) => crypto.createHmac('sha256', secret).update(value).digest('base64url');

function createReceipt(order, secret) {
  const payload = Buffer.from(JSON.stringify({
    reference: order.reference, amount: order.amountInCents, quantity: order.quantity,
    currency: order.currency, expires: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64url');
  return payload + '.' + sign(payload, secret);
}

function readReceipt(receipt, secret) {
  if (!secret || typeof receipt !== 'string' || receipt.length > 2048) return null;
  const [payload, signature, extra] = receipt.split('.');
  if (!payload || !signature || extra) return null;
  const expected = Buffer.from(sign(payload, secret));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.expires > Date.now() ? data : null;
  } catch (_) { return null; }
}

function purchaseHandler({ env = process.env, fetchImpl = fetch } = {}) {
  const verified = new Map();
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const { transactionId, receipt } = req.body || {};
    const order = readReceipt(receipt, env.WOMPI_INTEGRITY_SECRET);
    if (!order || typeof transactionId !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(transactionId)) {
      return res.status(400).json({ error: 'Invalid purchase verification request' });
    }
    if (!env.WOMPI_PRIVATE_KEY || !env.WOMPI_PRIVATE_KEY.startsWith('prv_prod_')) {
      return res.status(503).json({ error: 'Purchase verification not configured' });
    }
    const cacheKey = transactionId + ':' + receipt;
    if (verified.has(cacheKey)) return res.json(verified.get(cacheKey));
    try {
      const response = await fetchImpl('https://production.wompi.co/v1/transactions/' + encodeURIComponent(transactionId), {
        headers: { Authorization: 'Bearer ' + env.WOMPI_PRIVATE_KEY },
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) return res.status(response.status === 404 ? 404 : 502).json({ error: 'Unable to verify payment' });
      const { data: tx } = await response.json();
      if (!tx || tx.id !== transactionId || tx.reference !== order.reference || tx.amount_in_cents !== order.amount || tx.currency !== order.currency) {
        return res.status(400).json({ error: 'Payment does not match checkout' });
      }
      if (tx.status !== 'APPROVED') return res.json({ verified: false, pending: tx.status === 'PENDING' });
      const result = {
        verified: true,
        eventId: 'purchase-' + crypto.createHash('sha256').update(transactionId).digest('hex'),
        value: tx.amount_in_cents / 100, currency: tx.currency, quantity: order.quantity
      };
      if (verified.size >= 1000) verified.delete(verified.keys().next().value);
      verified.set(cacheKey, result);
      return res.json(result);
    } catch (_) { return res.status(502).json({ error: 'Unable to verify payment' }); }
  };
}

module.exports = { createReceipt, readReceipt, purchaseHandler };

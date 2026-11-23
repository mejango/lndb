/**
 * Product catalog — the single source of prices. Edit data/products.json to manage it:
 *   product:  { id, name, tagline, description, includes, image, hidden?, shippingCents?, variants: [...] }
 *             hidden: true keeps it purchasable but out of the product grid (the book has its own section).
 *   image:    path without size or extension ("assets/navidad/fruto"); the three sizes behind it are
 *             made by scripts/optimize-photo.sh. Leave "" for no photo.
 *   variant:  { sku (unique), label?, priceCents, shippingCents? }
 * Prices are COP cents ($80.000 → 8000000). shippingCents is optional on a product or a
 * variant; anything without one uses SHIPPING_COST_CENTS.
 */
const assert = require('node:assert/strict');
const products = require('../data/products.json');

const MAX_QTY = 10;
const TEST_UNIT_CENTS = 200000;

// Fail at startup, not at checkout, if the list is edited badly.
const skus = new Map();
for (const product of products) {
  assert(product.id && product.name && Array.isArray(product.variants) && product.variants.length, `bad product ${product.id}`);
  for (const variant of product.variants) {
    assert(/^[a-z0-9-]+$/.test(variant.sku) && !skus.has(variant.sku), `bad or duplicate sku ${variant.sku}`);
    assert(Number.isInteger(variant.priceCents) && variant.priceCents > 0, `bad price for ${variant.sku}`);
    const shippingCents = variant.shippingCents ?? product.shippingCents;
    assert(shippingCents === undefined || (Number.isInteger(shippingCents) && shippingCents >= 0), `bad shipping for ${variant.sku}`);
    skus.set(variant.sku, {
      name: variant.label ? `${product.name} — ${variant.label}` : product.name,
      image: product.image || '',
      priceCents: variant.priceCents,
      shippingCents
    });
  }
}

/**
 * Price a cart. items: [{ sku, qty }]. Returns null if the cart is empty or has an unknown sku.
 * Discount codes only change the book's unit price, as before. TEST mode keeps its
 * $2.000-per-unit, free-shipping behaviour for Wompi sandbox payments.
 */
function priceOrder(items, { hasDiscount = false, isTestMode = false, env = process.env } = {}) {
  if (!Array.isArray(items) || !items.length || items.length > skus.size) return null;
  const defaultShipping = parseInt(env.SHIPPING_COST_CENTS || '1800000', 10);
  const merged = new Map();
  for (const item of items) {
    const qty = Number(item && item.qty);
    if (!item || !skus.has(item.sku) || !Number.isInteger(qty) || qty < 1) return null;
    merged.set(item.sku, Math.min(MAX_QTY, (merged.get(item.sku) || 0) + qty));
  }
  const lines = [];
  let subtotal = 0, shipping = 0, quantity = 0;
  for (const [sku, qty] of merged) {
    const entry = skus.get(sku);
    let unitCents = entry.priceCents;
    if (sku === 'libro') {
      unitCents = parseInt(env.BOOK_PRICE_CENTS || entry.priceCents, 10);
      if (hasDiscount) unitCents = parseInt(env.DISCOUNT_PRICE_CENTS || '6800000', 10);
    }
    if (isTestMode) unitCents = TEST_UNIT_CENTS;
    lines.push({ sku, name: entry.name, image: entry.image, qty, unitCents, lineCents: unitCents * qty });
    subtotal += unitCents * qty;
    quantity += qty;
    // ponytail: one parcel per order, charged at the most expensive item's shipping rate.
    // Real per-product costs are still to be defined; switch to a sum or weight table here.
    shipping = Math.max(shipping, entry.shippingCents ?? defaultShipping);
  }
  if (isTestMode) shipping = 0;
  return { lines, quantity, subtotalCents: subtotal, shippingCents: shipping, totalCents: subtotal + shipping };
}

module.exports = { products, priceOrder, MAX_QTY };

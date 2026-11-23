const test = require('node:test');
const assert = require('node:assert/strict');
const { priceOrder } = require('../lib/catalog.cjs');

const env = { SHIPPING_COST_CENTS: '1800000', BOOK_PRICE_CENTS: '8000000', DISCOUNT_PRICE_CENTS: '6800000' };

test('prices a mixed cart with one flat shipping charge', () => {
  const order = priceOrder([{ sku: 'libro', qty: 2 }, { sku: 'fruto-caja', qty: 1 }], { env });
  assert.equal(order.subtotalCents, 2 * 8000000 + 10000000);
  assert.equal(order.shippingCents, 1800000);
  assert.equal(order.totalCents, 27800000);
  assert.equal(order.quantity, 3);
});

test('a single book costs what it did before the cart existed', () => {
  assert.equal(priceOrder([{ sku: 'libro', qty: 1 }], { env }).totalCents, 9800000);
  assert.equal(priceOrder([{ sku: 'libro', qty: 1 }], { env, hasDiscount: true }).totalCents, 8600000);
  assert.equal(priceOrder([{ sku: 'libro', qty: 3 }], { env, isTestMode: true }).totalCents, 600000);
});

test('discount only touches the book', () => {
  assert.equal(priceOrder([{ sku: 'brote', qty: 1 }], { env, hasDiscount: true }).subtotalCents, 13000000);
});

test('the gift bag only travels with individual jars, one per jar', () => {
  assert.equal(priceOrder([{ sku: 'bolsa-regalo', qty: 1 }], { env }), null);
  const boxed = priceOrder([{ sku: 'fruto', qty: 1 }, { sku: 'bolsa-regalo', qty: 2 }], { env });
  assert.deepEqual(boxed.lines.map(line => line.sku), ['fruto']);
  const jars = priceOrder([{ sku: 'chutney-mango', qty: 1 }, { sku: 'spread-cacao', qty: 1 }, { sku: 'bolsa-regalo', qty: 5 }], { env });
  assert.equal(jars.lines.find(line => line.sku === 'bolsa-regalo').qty, 2);
  assert.equal(jars.subtotalCents, 1650000 + 4650000 + 2 * 350000);
});

test('rejects unknown products, bad quantities and empty carts; clamps to 10', () => {
  assert.equal(priceOrder([{ sku: 'nope', qty: 1 }], { env }), null);
  assert.equal(priceOrder([{ sku: 'libro', qty: -1 }], { env }), null);
  assert.equal(priceOrder([{ sku: 'libro', qty: 1.5 }], { env }), null);
  assert.equal(priceOrder([], { env }), null);
  assert.equal(priceOrder([{ sku: 'libro', qty: 99 }], { env }).quantity, 10);
});

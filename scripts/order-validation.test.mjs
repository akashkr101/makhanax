import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const projectRoot = join(process.cwd());
const targetFile = join(projectRoot, 'src/app/core/services/order-validation.ts');

if (!existsSync(targetFile)) {
  console.error('Missing order-validation.ts');
  process.exit(1);
}

execSync(
  'npx tsc --ignoreConfig --target ES2022 --module ES2022 --moduleResolution bundler --sourceMap --inlineSources --outDir .tmp-coverage/order-validation src/app/core/services/order-validation.ts',
  { stdio: 'inherit' }
);

const { validateOrderItems } = await import(new URL('../.tmp-coverage/order-validation/order-validation.js', import.meta.url).href);

const catalog = [
  { id: 'p1', name: 'Roasted Makhana', size: '250g', price: 200, stock: 10 },
  { id: 'p2', name: 'Peri Peri Makhana', size: '250g', price: 250, stock: 5 }
];

const validResult = validateOrderItems(
  [
    { productId: 'p1', name: 'Roasted Makhana', size: '250g', quantity: 2 },
    { productId: 'p2', name: 'Peri Peri Makhana', size: '250g', quantity: 1 }
  ],
  catalog
);

if (!validResult.valid) {
  console.error('Expected valid order to pass validation');
  process.exit(1);
}

if (Math.round(validResult.subtotal * 100) !== 65000) {
  console.error(`Unexpected subtotal ${validResult.subtotal}`);
  process.exit(1);
}

const invalidResult = validateOrderItems(
  [
    { productId: 'p1', name: 'Roasted Makhana', size: '250g', quantity: 99 }
  ],
  catalog
);

if (invalidResult.valid) {
  console.error('Expected out-of-stock item to fail validation');
  process.exit(1);
}

console.log('order validation checks passed');

execSync('npx tsc --ignoreConfig --target ES2022 --module ES2022 --moduleResolution bundler --sourceMap --inlineSources --outDir .tmp-coverage/server-order-validation functions/src/order-validation.ts', { stdio: 'inherit' });
const { validateCheckoutRequest, priceCheckout } = await import(new URL('../.tmp-coverage/server-order-validation/order-validation.js', import.meta.url).href);
const checkout = {
  requestId: 'test-request', customerName: 'Customer', customerEmail: 'customer@example.com',
  phoneNumber: '9876543210', deliveryAddress: 'Test address', paymentMethod: 'cod',
  expectedTotal: 400, items: [{ productId: 'p1', quantity: 2 }]
};
assert.equal(priceCheckout(validateCheckoutRequest(checkout), catalog).total, 400);
assert.throws(() => validateCheckoutRequest({ ...checkout, paymentMethod: 'card' }));
assert.throws(() => validateCheckoutRequest({ ...checkout, items: [{ productId: '../p1', quantity: 1 }] }));
for (const quantity of [0, -1, 1.5, NaN, Infinity, 1001]) {
  assert.throws(() => validateCheckoutRequest({ ...checkout, items: [{ productId: 'p1', quantity }] }));
}
assert.throws(() => validateCheckoutRequest({ ...checkout, items: [] }));
assert.throws(() => validateCheckoutRequest({ ...checkout, items: Array(51).fill({ productId: 'p1', quantity: 1 }) }));
assert.throws(() => validateCheckoutRequest({ ...checkout, customerEmail: 'invalid' }));
assert.throws(() => validateCheckoutRequest({ ...checkout, deliveryAddress: '' }));
assert.throws(() => priceCheckout({ ...checkout, expectedTotal: 1 }, catalog));
assert.throws(() => priceCheckout(checkout, []));
assert.throws(() => priceCheckout(checkout, [{ ...catalog[0], price: NaN }]));
assert.throws(() => priceCheckout({ ...checkout, items: [{ productId: 'p1', quantity: 6 }, { productId: 'p1', quantity: 6 }] }, catalog));
const duplicateItems = priceCheckout({ ...checkout, items: [{ productId: 'p1', quantity: 1 }, { productId: 'p1', quantity: 1 }] }, catalog);
assert.equal(duplicateItems.items.length, 1);
assert.equal(duplicateItems.items[0].quantity, 2);
console.log('server order validation checks passed');

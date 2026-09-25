import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = join(process.cwd());
const targetFile = join(projectRoot, 'src/app/core/services/order-validation.ts');

if (!existsSync(targetFile)) {
  console.error('Missing order-validation.ts');
  process.exit(1);
}

execSync(
  'npx tsc --ignoreConfig --target ES2022 --module ES2022 --moduleResolution bundler --outDir .tmp-order-validation src/app/core/services/order-validation.ts',
  { stdio: 'inherit' }
);

const { validateOrderItems } = await import(new URL('../.tmp-order-validation/order-validation.js', import.meta.url).href);

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

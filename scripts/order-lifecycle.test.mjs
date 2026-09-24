import { execSync } from 'node:child_process';

execSync(
  'npx tsc --ignoreConfig --target ES2022 --module ES2022 --moduleResolution bundler --outDir .tmp-order-lifecycle src/app/core/services/order-lifecycle.ts',
  { stdio: 'inherit' }
);

const { canAdvanceOrderStatus, ORDER_STATUS_SEQUENCE } = await import(new URL('../.tmp-order-lifecycle/order-lifecycle.js', import.meta.url).href);

if (!ORDER_STATUS_SEQUENCE.includes('Confirmed') || !ORDER_STATUS_SEQUENCE.includes('Shipped') || !ORDER_STATUS_SEQUENCE.includes('Delivered')) {
  throw new Error('Order lifecycle sequence is incomplete');
}

if (!canAdvanceOrderStatus('New', 'Confirmed')) {
  throw new Error('New orders should advance to Confirmed');
}

if (!canAdvanceOrderStatus('Confirmed', 'Shipped')) {
  throw new Error('Confirmed orders should advance to Shipped');
}

if (!canAdvanceOrderStatus('Shipped', 'Delivered')) {
  throw new Error('Shipped orders should advance to Delivered');
}

if (canAdvanceOrderStatus('Delivered', 'Shipped')) {
  throw new Error('Delivered orders should not move backwards');
}

if (!canAdvanceOrderStatus('Confirmed', 'Cancelled')) {
  throw new Error('Confirmed orders should be cancellable');
}

console.log('order lifecycle checks passed');

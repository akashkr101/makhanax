import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import '@angular/compiler';
import { PaymentService } from '../src/app/core/services/payment.service.ts';
import { PaymentGateway } from '../src/app/core/services/payment-gateway.ts';
import { verifyPaymentWebhook } from '../src/app/core/services/payment-verification.ts';
import { OrderHistoryService } from '../src/app/core/services/order-history.service.ts';

await test('Backend and frontend enforce authentication, trusted pricing, and retry-safe orders', async () => {
  const projectId = 'demo-makhanax';
  const testEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8081, rules: readFileSync('firestore.rules', 'utf8') },
  });
  const app = initializeApp({
    projectId,
    apiKey: 'demo-key',
    authDomain: `${projectId}.firebaseapp.com`,
  });
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'asia-south1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const createOrder = httpsCallable(functions, 'createOrder');
  const checkout = {
    requestId: 'security-test',
    customerName: 'Test Customer',
    customerEmail: 'customer@example.com',
    phoneNumber: '9876543210',
    deliveryAddress: 'Test address',
    paymentMethod: 'cod',
    expectedTotal: 400,
    items: [{ productId: 'p1', quantity: 2 }],
  };

  try {
    await testEnvironment.clearFirestore();
    await testEnvironment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'products', 'p1'), {
        name: 'Makhana',
        size: '250g',
        price: 200,
        stock: 10,
      });
    });
    await assert.rejects(
      () => createOrder(checkout),
      (error) => error.code === 'functions/unauthenticated',
    );
    const credential = await signInAnonymously(auth);
    const uid = credential.user.uid;
    assert.ok(
      process.env.FIRESTORE_EMULATOR_HOST,
      'Backend coverage must use the Firestore emulator.',
    );
    process.env.GCLOUD_PROJECT = projectId;
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });
    const { createOrder: orderHandler } = await import('../functions/src/index.ts');
    await assert.rejects(
      () => orderHandler.run({ data: checkout }),
      (error) => error.code === 'unauthenticated',
    );
    const handlerRequest = {
      data: { ...checkout, requestId: 'handler-test' },
      auth: { uid, token: {} },
    };
    await assert.rejects(
      () =>
        orderHandler.run({ ...handlerRequest, data: { ...handlerRequest.data, expectedTotal: 1 } }),
      (error) => error.code === 'failed-precondition',
    );
    await assert.rejects(
      () => orderHandler.run({ ...handlerRequest, data: null }),
      (error) => error.code === 'invalid-argument',
    );
    const handlerOrder = await orderHandler.run(handlerRequest);
    assert.equal(handlerOrder.total, 400);
    assert.equal((await orderHandler.run(handlerRequest)).id, handlerOrder.id);
    const customerDb = testEnvironment.authenticatedContext(uid).firestore();
    await assertFails(
      setDoc(doc(customerDb, 'orders', 'forged'), { userId: uid, total: 1, status: 'New' }),
    );
    await assert.rejects(
      () => createOrder({ ...checkout, expectedTotal: 1 }),
      (error) => error.code === 'functions/failed-precondition',
    );
    await assert.rejects(
      () => createOrder({ ...checkout, paymentMethod: 'card' }),
      (error) => error.code === 'functions/invalid-argument',
    );
    await assert.rejects(
      () =>
        createOrder({
          ...checkout,
          items: [
            { productId: 'p1', quantity: 6 },
            { productId: 'p1', quantity: 6 },
          ],
        }),
      (error) => error.code === 'functions/failed-precondition',
    );

    const result = await createOrder({
      ...checkout,
      status: 'Confirmed',
      confirmationEmailSent: true,
    });
    assert.equal(result.data.userId, uid);
    assert.equal(result.data.total, 400);
    assert.equal(result.data.items[0].price, 200);
    assert.equal(result.data.status, 'New');
    assert.equal(result.data.confirmationEmailSent, false);
    const retried = await createOrder(checkout);
    assert.equal(retried.data.id, result.data.id);
    await assertSucceeds(getDoc(doc(customerDb, 'orders', result.data.id)));
    const otherDb = testEnvironment.authenticatedContext('other-user').firestore();
    await assertFails(getDoc(doc(otherDb, 'orders', result.data.id)));
    await assertFails(
      setDoc(doc(customerDb, 'orders', result.data.id), { total: 1 }, { merge: true }),
    );
    await assertFails(
      setDoc(doc(customerDb, 'customers', uid), {
        displayName: 'Test',
        email: 'customer@example.com',
        phoneNumber: '9876543210',
        role: 'ADMIN',
        updatedAt: new Date().toISOString(),
      }),
    );
    const payment = new PaymentService();
    assert.equal(
      (
        await PaymentGateway.createOrder({
          amount: 400,
          currency: 'INR',
          orderId: 'test',
          customerName: 'Test',
          customerEmail: 'test@example.com',
        })
      ).success,
      false,
    );
    assert.equal(
      PaymentGateway.verifyPayment({
        razorpay_order_id: 'fake',
        razorpay_payment_id: 'fake',
        razorpay_signature: 'fake',
      }),
      false,
    );
    assert.equal(verifyPaymentWebhook({ event: 'payment.captured' }, 'demo-webhook-secret'), false);
    const cod = await payment.processPayment(400, { method: 'cod' }, 'test-order');
    assert.equal(cod.success, true);
    assert.equal(cod.transactionId, '');
    for (const method of ['upi', 'card', 'netbanking']) {
      assert.equal((await payment.processPayment(400, { method }, 'test-order')).success, false);
    }
    assert.equal(
      (await payment.processPayment(NaN, { method: 'cod' }, 'test-order')).success,
      false,
    );
    const orders = new OrderHistoryService();
    assert.equal(orders.firebaseApp.options.projectId, projectId);
    const orderInput = {
      total: 1,
      paymentMethod: 'cod',
      phoneNumber: checkout.phoneNumber,
      deliveryAddress: checkout.deliveryAddress,
      items: [{ productId: 'p1', name: 'Fake name', size: '250g', quantity: 2, price: 0.5 }],
    };
    await assert.rejects(() =>
      orders.record(uid, checkout.customerName, checkout.customerEmail, orderInput, 'service-test'),
    );
    assert.equal(orders.orders().length, 0);
    assert.ok(orders.error());
    const saved = new Map();
    globalThis.localStorage = {
      setItem: (key, value) => saved.set(key, value),
      getItem: (key) => saved.get(key) ?? null,
    };
    const confirmed = await orders.record(
      uid,
      checkout.customerName,
      checkout.customerEmail,
      { ...orderInput, total: 400 },
      'service-test',
    );
    assert.equal(confirmed.total, 400);
    assert.equal(confirmed.items[0].name, 'Makhana');
    assert.equal(orders.orders().length, 1);
    await orders.record(
      uid,
      checkout.customerName,
      checkout.customerEmail,
      { ...orderInput, total: 400 },
      'service-test',
    );
    assert.equal(orders.orders().length, 1);
    console.log('Backend authentication, pricing, idempotency, and Firestore rules checks passed.');
  } finally {
    await testEnvironment.cleanup();
    await deleteApp(app);
  }
});

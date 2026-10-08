export interface CheckoutRequest {
  requestId: string;
  customerName: string;
  customerEmail: string;
  phoneNumber: string;
  deliveryAddress: string;
  paymentMethod: 'cod';
  expectedTotal: number;
  items: Array<{ productId: string; quantity: number }>;
}

export interface CatalogProduct {
  id: string;
  name: string;
  size: string;
  price: number;
  stock: number;
}

export function validateCheckoutRequest(data: unknown): CheckoutRequest {
  if (!data || typeof data !== 'object') throw new Error('Invalid order.');
  const input = data as Record<string, unknown>;
  const text = (field: string, maximum: number): string => {
    const value = input[field];
    if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
      throw new Error(`Invalid ${field}.`);
    }
    return value.trim();
  };
  const requestId = text('requestId', 80);
  if (!/^[a-zA-Z0-9-]+$/.test(requestId)) throw new Error('Invalid request ID.');
  const customerName = text('customerName', 120);
  const customerEmail = text('customerEmail', 320).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error('Invalid email.');
  const phoneNumber = text('phoneNumber', 30);
  const deliveryAddress = text('deliveryAddress', 1000);
  if (input['paymentMethod'] !== 'cod') throw new Error('Only cash on delivery is available.');
  const expectedTotal = input['expectedTotal'];
  if (typeof expectedTotal !== 'number' || !Number.isFinite(expectedTotal) || expectedTotal <= 0) {
    throw new Error('Invalid order total.');
  }
  if (!Array.isArray(input['items']) || !input['items'].length || input['items'].length > 50) {
    throw new Error('Orders must contain between 1 and 50 items.');
  }
  const items = input['items'].map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid item.');
    const item = value as Record<string, unknown>;
    const productId = item['productId'];
    const quantity = item['quantity'];
    if (typeof productId !== 'string' || !productId || productId.length > 200 || productId.includes('/')) {
      throw new Error('Invalid product ID.');
    }
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
      throw new Error('Invalid item quantity.');
    }
    return { productId, quantity };
  });
  return { requestId, customerName, customerEmail, phoneNumber, deliveryAddress, paymentMethod: 'cod', expectedTotal, items };
}

export function priceCheckout(request: CheckoutRequest, catalog: CatalogProduct[]) {
  const quantities = new Map<string, number>();
  for (const item of request.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  let totalCents = 0;
  const items = [...quantities].map(([productId, quantity]) => {
    const product = catalog.find((candidate) => candidate.id === productId);
    if (!product || typeof product.name !== 'string' || typeof product.size !== 'string' ||
        !Number.isFinite(product.price) || product.price <= 0 || !Number.isSafeInteger(product.stock)) {
      throw new Error('A product is unavailable. Refresh your cart.');
    }
    if (quantity > product.stock) throw new Error(`Insufficient stock for ${product.name}.`);
    const priceCents = Math.round(product.price * 100);
    totalCents += priceCents * quantity;
    if (!Number.isSafeInteger(totalCents)) throw new Error('Order total is too large.');
    return { productId, name: product.name, size: product.size, quantity, price: priceCents / 100 };
  });
  if (Math.round(request.expectedTotal * 100) !== totalCents) {
    throw new Error('Prices have changed. Refresh your cart before placing the order.');
  }
  return { items, total: totalCents / 100 };
}
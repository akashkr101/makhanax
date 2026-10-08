import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { collection, doc, getFirestore, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { environment } from '../../../environments/environment';

export type OrderStatus = 'New' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface OrderLineItem {
  productId?: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
}

export interface OrderRecord {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  placedAt: string;
  total: number;
  paymentMethod: string;
  phoneNumber?: string;
  deliveryAddress?: string;
  status: OrderStatus;
  stockAdjusted?: boolean;
  confirmationEmailSent?: boolean;
  confirmationEmailSentAt?: string;
  items: OrderLineItem[];
}

@Injectable({ providedIn: 'root' })
export class OrderHistoryService {
  readonly orders = signal<OrderRecord[]>([]);
  readonly allOrders = signal<OrderRecord[]>([]);
  readonly error = signal('');

  private readonly firebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly firestore = getFirestore(this.firebaseApp);
  private unsubscribeAllOrders?: () => void;
  private unsubscribeUserOrders?: () => void;
  private watchedUserId = '';

  async load(userId: string): Promise<void> {
    if (this.watchedUserId === userId && this.unsubscribeUserOrders) return;

    this.unsubscribeUserOrders?.();
    this.watchedUserId = userId;
    this.unsubscribeUserOrders = onSnapshot(query(collection(this.firestore, 'orders'), where('userId', '==', userId)), (snapshot) => {
      const orders = snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() } as OrderRecord));
      orders.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
      this.orders.set(orders.length > 0 ? orders : this.readLocalOrders(userId));
      this.error.set('');
    }, (error: unknown) => {
      this.orders.set(this.readLocalOrders(userId));
      this.error.set('Cloud sync is unavailable. Showing orders saved on this device.');
      console.error('Loading order history failed:', error);
    });
  }

  async loadAll(): Promise<void> {
    if (this.unsubscribeAllOrders) return;

    this.unsubscribeAllOrders = onSnapshot(collection(this.firestore, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() } as OrderRecord));
      orders.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
      this.allOrders.set(orders);
      this.error.set('');
    }, (error: unknown) => {
      this.error.set('Could not load orders. Check Firestore setup and rules.');
      console.error('Loading all orders failed:', error);
    });
  }

  async updateStatus(orderId: string, status: OrderStatus): Promise<void> {
    const changes: Partial<OrderRecord> = { status };
    await updateDoc(doc(this.firestore, 'orders', orderId), changes);
    this.allOrders.update((orders) => orders.map((order) => order.id === orderId ? { ...order, ...changes } : order));
    this.orders.update((orders) => orders.map((order) => order.id === orderId ? { ...order, ...changes } : order));
  }

  async markStockAdjusted(orderId: string): Promise<void> {
    const changes: Partial<OrderRecord> = { stockAdjusted: true };
    await updateDoc(doc(this.firestore, 'orders', orderId), changes);
    this.allOrders.update((orders) => orders.map((order) => order.id === orderId ? { ...order, ...changes } : order));
  }

  async markConfirmationEmailSent(orderId: string): Promise<void> {
    const changes: Partial<OrderRecord> = {
      confirmationEmailSent: true,
      confirmationEmailSentAt: new Date().toISOString()
    };
    await updateDoc(doc(this.firestore, 'orders', orderId), changes);
    this.allOrders.update((orders) => orders.map((order) => order.id === orderId ? { ...order, ...changes } : order));
  }

  async record(userId: string, customerName: string, customerEmail: string, order: Omit<OrderRecord, 'id' | 'userId' | 'customerName' | 'customerEmail' | 'placedAt' | 'status'>, requestId: string): Promise<OrderRecord> {
    try {
      const createOrder = httpsCallable<unknown, OrderRecord>(getFunctions(this.firebaseApp, 'asia-south1'), 'createOrder', { timeout: 20000 });
      const result = await createOrder({
        requestId,
        customerName,
        customerEmail,
        phoneNumber: order.phoneNumber,
        deliveryAddress: order.deliveryAddress,
        paymentMethod: order.paymentMethod,
        expectedTotal: order.total,
        items: order.items.map((item) => ({ productId: item.productId, quantity: item.quantity }))
      });
      const created = result.data;
      if (!created.id || created.userId !== userId) throw new Error('Invalid order response.');
      this.orders.update((orders) => [created, ...orders.filter((existing) => existing.id !== created.id)].slice(0, 25));
      this.writeLocalOrders(userId, this.orders());
      this.error.set('');
      return created;
    } catch (error: unknown) {
      this.error.set('Could not confirm your order. Retry to check or save the same order.');
      throw error;
    }
  }

  clear(): void {
    this.orders.set([]);
    this.error.set('');
  }

  private localStorageKey(userId: string): string {
    return `makhanax-orders-${userId}`;
  }

  private readLocalOrders(userId: string): OrderRecord[] {
    try {
      const raw = localStorage.getItem(this.localStorageKey(userId));
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private writeLocalOrders(userId: string, orders: OrderRecord[]): void {
    try {
      localStorage.setItem(this.localStorageKey(userId), JSON.stringify(orders));
    } catch (error: unknown) {
      console.error('Saving orders to local storage failed:', error);
    }
  }

}

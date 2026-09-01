import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { addDoc, collection, doc, getDocs, getFirestore, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
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

  async load(userId: string): Promise<void> {
    try {
      const snapshot = await getDocs(query(collection(this.firestore, 'orders'), where('userId', '==', userId)));
      const orders = snapshot.docs.map((orderDoc) => ({ id: orderDoc.id, ...orderDoc.data() } as OrderRecord));
      orders.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
      this.orders.set(orders.length > 0 ? orders : this.readLocalOrders(userId));
      this.error.set('');
    } catch (error: unknown) {
      this.orders.set(this.readLocalOrders(userId));
      this.error.set('Cloud sync is unavailable. Showing orders saved on this device.');
      console.error('Loading order history failed:', error);
    }
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

  async record(userId: string, customerName: string, customerEmail: string, order: Omit<OrderRecord, 'id' | 'userId' | 'customerName' | 'customerEmail' | 'placedAt' | 'status'>): Promise<void> {
    const placedAt = new Date().toISOString();
    const payload = { ...order, userId, customerName, customerEmail, placedAt, status: 'New' as OrderStatus };
    const localOrder: OrderRecord = { ...payload, id: `order-${Date.now()}` };
    this.orders.update((orders) => [localOrder, ...orders].slice(0, 25));
    this.writeLocalOrders(userId, this.orders());
    try {
      const created = await Promise.race([
        addDoc(collection(this.firestore, 'orders'), payload),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('order-save-timeout')), 10000);
        })
      ]);
      this.orders.update((orders) => orders.map((existing) => existing.id === localOrder.id ? { ...existing, id: created.id } : existing));
      this.error.set('');
    } catch (error: unknown) {
      this.error.set('Cloud sync is unavailable. Order saved on this device for now.');
      console.error('Saving order to cloud failed, saved locally instead:', error);
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

import { Injectable, signal, computed } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { doc, getFirestore, setDoc, updateDoc, increment, onSnapshot } from 'firebase/firestore';

export interface StockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  isLowStock: boolean;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly productStocks = signal<Map<string, number>>(new Map());
  private readonly stockAlerts = signal<StockAlert[]>([]);
  private readonly firebaseApp = getApps().length ? getApp() : undefined;
  private readonly firestore = this.firebaseApp ? getFirestore(this.firebaseApp) : null;
  private unsubscribers: Array<() => void> = [];

  readonly totalLowStockItems = computed(() => 
    this.stockAlerts().filter((alert) => alert.isLowStock).length
  );

  getStock(productId: string): number {
    return this.productStocks().get(productId) ?? 0;
  }

  isInStock(productId: string, quantity: number = 1): boolean {
    return this.getStock(productId) >= quantity;
  }

  isLowStock(productId: string, threshold: number = 5): boolean {
    return this.getStock(productId) <= threshold;
  }

  async reserveStock(productId: string, quantity: number, orderId: string): Promise<boolean> {
    try {
      if (!this.firestore) return false;

      const currentStock = this.getStock(productId);
      if (currentStock < quantity) {
        console.warn(`Insufficient stock for product ${productId}`);
        return false;
      }

      const productRef = doc(this.firestore, 'products', productId);
      await updateDoc(productRef, {
        stock: increment(-quantity),
        [`reservations.${orderId}`]: quantity,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Reserving stock failed:', error);
      return false;
    }
  }

  async releaseReservation(productId: string, quantity: number, orderId: string): Promise<boolean> {
    try {
      if (!this.firestore) return false;

      const productRef = doc(this.firestore, 'products', productId);
      await updateDoc(productRef, {
        stock: increment(quantity),
        [`reservations.${orderId}`]: null,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Releasing reservation failed:', error);
      return false;
    }
  }

  async updateStock(productId: string, quantity: number): Promise<boolean> {
    try {
      if (!this.firestore) return false;

      const productRef = doc(this.firestore, 'products', productId);
      await setDoc(productRef, {
        stock: quantity,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return true;
    } catch (error) {
      console.error('Updating stock failed:', error);
      return false;
    }
  }

  watchProductStocks(productIds: string[]): void {
    if (!this.firestore) return;

    // Unsubscribe from previous listeners
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    // Watch each product
    productIds.forEach((productId) => {
      const productRef = doc(this.firestore!, 'products', productId);
      const unsubscribe = onSnapshot(productRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const stock = data['stock'] ?? 0;
          const name = data['name'] ?? productId;

          this.productStocks.update((stocks) => {
            const newStocks = new Map(stocks);
            newStocks.set(productId, stock);
            return newStocks;
          });

          // Update alerts
          this.updateStockAlerts(productId, name, stock);
        }
      });

      this.unsubscribers.push(unsubscribe);
    });
  }

  private updateStockAlerts(productId: string, productName: string, currentStock: number): void {
    const threshold = 5;
    const isLowStock = currentStock <= threshold;

    this.stockAlerts.update((alerts) => {
      const existing = alerts.findIndex((a) => a.productId === productId);
      if (existing >= 0) {
        const updated = [...alerts];
        updated[existing] = {
          productId,
          productName,
          currentStock,
          threshold,
          isLowStock
        };
        return updated;
      } else {
        return [
          ...alerts,
          {
            productId,
            productName,
            currentStock,
            threshold,
            isLowStock
          }
        ];
      }
    });
  }

  getAlerts(): StockAlert[] {
    return this.stockAlerts();
  }

  clearWatchers(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }

  async getStockHistory(productId: string, days: number = 30): Promise<Array<{ date: string; stock: number }>> {
    try {
      if (!this.firestore) return [];

      // In production, query from a stock history collection
      // This is a placeholder implementation
      console.log(`Fetching stock history for ${productId} from last ${days} days`);
      return [];
    } catch (error) {
      console.error('Fetching stock history failed:', error);
      return [];
    }
  }
}

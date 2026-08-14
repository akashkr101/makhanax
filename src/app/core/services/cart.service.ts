import { computed, Injectable, signal } from '@angular/core';
import { CartItem, Product } from '../../models/product';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<CartItem[]>([]);
  readonly items = this.state.asReadonly();
  readonly itemCount = computed(() => this.state().reduce((count, item) => count + item.quantity, 0));
  readonly subtotal = computed(() => this.state().reduce((total, item) => total + item.product.price * item.quantity, 0));

  add(product: Product): void {
    this.state.update((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      return existing
        ? items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { product, quantity: 1 }];
    });
  }

  setQuantity(id: string, quantity: number): void {
    if (quantity < 1) {
      this.remove(id);
      return;
    }
    this.state.update((items) => items.map((item) => item.product.id === id ? { ...item, quantity } : item));
  }

  remove(id: string): void {
    this.state.update((items) => items.filter((item) => item.product.id !== id));
  }

  clear(): void {
    this.state.set([]);
  }
}

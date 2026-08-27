import { computed, Injectable, signal } from '@angular/core';
import { CartItem, Product } from '../../models/product';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<CartItem[]>([]);
  private readonly discountCode = signal('');
  private readonly discountPercentage = signal(0);
  
  readonly items = this.state.asReadonly();
  readonly itemCount = computed(() => this.state().reduce((count, item) => count + item.quantity, 0));
  readonly subtotal = computed(() => this.state().reduce((total, item) => total + item.product.price * item.quantity, 0));
  readonly discount = computed(() => (this.subtotal() * this.discountPercentage()) / 100);
  readonly taxRate = 0.18; // 18% GST (configurable)
  readonly tax = computed(() => {
    const afterDiscount = this.subtotal() - this.discount();
    return Math.round(afterDiscount * this.taxRate * 100) / 100;
  });
  readonly total = computed(() => this.subtotal() - this.discount() + this.tax());

  add(product: Product): boolean {
    if ((product.stock ?? 0) <= 0) return false;
    this.state.update((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing && existing.quantity >= (product.stock ?? 0)) return items;
      return existing
        ? items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...items, { product, quantity: 1 }];
    });
    return true;
  }

  setQuantity(id: string, quantity: number): void {
    if (quantity < 1) {
      this.remove(id);
      return;
    }
    this.state.update((items) => items.map((item) => {
      if (item.product.id !== id) return item;
      const stock = item.product.stock ?? 0;
      return { ...item, quantity: Math.min(quantity, stock) };
    }).filter((item) => item.quantity > 0));
  }

  remove(id: string): void {
    this.state.update((items) => items.filter((item) => item.product.id !== id));
  }

  clear(): void {
    this.state.set([]);
    this.discountCode.set('');
    this.discountPercentage.set(0);
  }

  applyCoupon(code: string, discountPercent: number): boolean {
    // Validate coupon (you can add backend validation later)
    if (discountPercent > 0 && discountPercent <= 100) {
      this.discountCode.set(code);
      this.discountPercentage.set(discountPercent);
      return true;
    }
    return false;
  }

  removeCoupon(): void {
    this.discountCode.set('');
    this.discountPercentage.set(0);
  }

  getCurrentCoupon(): string {
    return this.discountCode();
  }

  isEmpty(): boolean {
    return this.state().length === 0;
  }

  getCartSummary() {
    return {
      items: this.items(),
      itemCount: this.itemCount(),
      subtotal: this.subtotal(),
      discount: this.discount(),
      tax: this.tax(),
      total: this.total(),
      coupon: this.discountCode()
    };
  }
}

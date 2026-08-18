import { Component, input, output, signal } from '@angular/core';
import { CartItem } from '../../models/product';

interface Coupon {
  code: string;
  label: string;
  percentOff?: number;
  amountOff?: number;
}

const COUPONS: Coupon[] = [
  { code: 'MAKHANA10', label: '10% off your order', percentOff: 10 },
  { code: 'WELCOME50', label: '₹50 off your order', amountOff: 50 }
];

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  templateUrl: './cart-drawer.component.html',
  styleUrls: ['./cart-drawer.component.scss', './cart-drawer-overrides.scss']
})
export class CartDrawerComponent {
  readonly items = input<CartItem[]>([]);
  readonly close = output<void>();
  readonly checkout = output<void>();
  readonly remove = output<string>();
  readonly changeQuantity = output<{ id: string; quantity: number }>();
  protected readonly couponInput = signal('');
  protected readonly appliedCoupon = signal<Coupon | null>(null);
  protected readonly couponError = signal('');

  protected subtotal(): number {
    return this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  protected discount(): number {
    const coupon = this.appliedCoupon();
    if (!coupon) return 0;
    const subtotal = this.subtotal();
    const amount = coupon.percentOff ? subtotal * (coupon.percentOff / 100) : coupon.amountOff ?? 0;
    return Math.min(amount, subtotal);
  }

  protected total(): number {
    return this.subtotal() - this.discount();
  }

  protected applyCoupon(event: Event): void {
    event.preventDefault();
    const code = this.couponInput().trim().toUpperCase();
    if (!code) return;
    const coupon = COUPONS.find((candidate) => candidate.code === code);
    if (!coupon) {
      this.couponError.set('That code is not valid. Try MAKHANA10 or WELCOME50.');
      return;
    }
    this.appliedCoupon.set(coupon);
    this.couponError.set('');
    this.couponInput.set('');
  }

  protected removeCoupon(): void {
    this.appliedCoupon.set(null);
    this.couponError.set('');
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }
}

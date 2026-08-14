import { Component, input, output } from '@angular/core';
import { CartItem } from '../../models/product';

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

  protected total(): number {
    return this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }
}

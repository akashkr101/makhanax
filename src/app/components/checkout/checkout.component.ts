import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CartItem } from '../../models/product';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss'
})
export class CheckoutComponent {
  readonly items = input<CartItem[]>([]);
  readonly back = output<void>();
  readonly orderPlaced = output<void>();
  protected paymentMethod = 'upi';

  protected total(): number {
    return this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected placeOrder(event: Event): void {
    event.preventDefault();
    this.orderPlaced.emit();
  }
}

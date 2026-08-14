import { Component, effect, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddressBookService, AddressCategory } from '../../core/services/address-book.service';
import { AuthService } from '../../core/services/auth.service';
import { CartItem } from '../../models/product';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss', './checkout-overrides.scss']
})
export class CheckoutComponent {
  private readonly authService = inject(AuthService);
  private readonly addressBookService = inject(AddressBookService);
  readonly items = input<CartItem[]>([]);
  readonly back = output<void>();
  readonly orderPlaced = output<void>();
  protected paymentMethod = 'upi';
  protected addressCategory: AddressCategory = 'home';
  protected fullName = '';
  protected phoneNumber = '';
  protected deliveryAddress = '';
  protected readonly savedAddresses = this.addressBookService.addresses;
  protected readonly addressBookError = this.addressBookService.error;

  constructor() {
    effect(() => {
      const userId = this.authService.userId();
      if (userId) {
        void this.addressBookService.load(userId);
      } else {
        this.addressBookService.clear();
      }
    });
  }

  protected total(): number {
    return this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected selectAddressCategory(category: AddressCategory): void {
    this.addressCategory = category;
    const savedAddress = this.savedAddresses()[category];
    if (!savedAddress) return;
    this.fullName = savedAddress.name;
    this.phoneNumber = savedAddress.phone;
    this.deliveryAddress = savedAddress.address;
  }

  protected async placeOrder(event: Event): Promise<void> {
    event.preventDefault();
    const userId = this.authService.userId();
    if (userId) {
      try {
        await this.addressBookService.save(userId, this.addressCategory, {
          name: this.fullName,
          phone: this.phoneNumber,
          address: this.deliveryAddress
        });
      } catch (error: unknown) {
        console.error('Saving delivery address failed:', error);
      }
    }
    this.orderPlaced.emit();
  }
}

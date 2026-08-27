import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddressBookService, AddressCategory } from '../../core/services/address-book.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
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
  private readonly orderHistoryService = inject(OrderHistoryService);
  readonly items = input<CartItem[]>([]);
  readonly back = output<void>();
  readonly orderPlaced = output<void>();
  protected paymentMethod = 'upi';
  protected addressCategory: AddressCategory = 'home';
  protected fullName = '';
  protected emailAddress = '';
  protected phoneNumber = '';
  protected deliveryAddress = '';
  protected readonly savingAddress = signal(false);
  protected readonly addressSaved = signal(false);
  protected readonly addressSaveStatus = signal('');
  protected readonly savedAddresses = this.addressBookService.addresses;
  protected readonly addressBookError = this.addressBookService.error;

  constructor() {
    effect(() => {
      const userId = this.authService.userId();
      const profile = this.authService.customerProfile();
      if (profile?.email && !this.emailAddress) this.emailAddress = profile.email;
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
    this.addressSaveStatus.set('');
    this.addressSaved.set(false);
    const savedAddress = this.savedAddresses()[category];
    if (!savedAddress) {
      this.fullName = '';
      this.phoneNumber = '';
      this.deliveryAddress = '';
      return;
    }
    this.fullName = savedAddress.name;
    this.phoneNumber = savedAddress.phone;
    this.deliveryAddress = savedAddress.address;
  }

  protected async saveAddress(): Promise<void> {
    if (!this.fullName.trim() || !this.phoneNumber.trim() || !this.deliveryAddress.trim()) {
      this.addressSaveStatus.set('Complete your name, mobile number, and delivery address before saving.');
      return;
    }
    const userId = this.authService.userId();
    if (!userId) {
      this.addressSaveStatus.set('Please sign in again before saving an address.');
      return;
    }

    this.savingAddress.set(true);
    this.addressSaveStatus.set('');
    this.addressSaved.set(false);
    try {
      const saveMode = await this.addressBookService.save(userId, this.addressCategory, {
        name: this.fullName,
        phone: this.phoneNumber,
        address: this.deliveryAddress
      });
      const label = `${this.addressCategory[0].toUpperCase()}${this.addressCategory.slice(1)} address saved`;
      this.addressSaveStatus.set(saveMode === 'cloud' ? `${label}.` : `${label} on this device.`);
      this.addressSaved.set(true);
      window.setTimeout(() => this.addressSaved.set(false), 2200);
    } catch (error: unknown) {
      this.addressSaveStatus.set(error instanceof Error ? error.message : 'We could not save this address. Please try again.');
      console.error('Saving address failed:', error);
    } finally {
      this.savingAddress.set(false);
    }
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
      await this.orderHistoryService.record(userId, this.fullName || 'Customer', this.emailAddress.trim().toLowerCase(), {
        total: this.total(),
        paymentMethod: this.paymentMethod,
        items: this.items().map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          size: item.product.size,
          quantity: item.quantity,
          price: item.product.price
        }))
      });
    }
    this.orderPlaced.emit();
  }
}

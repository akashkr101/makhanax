import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddressBookService, AddressCategory } from '../../core/services/address-book.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
import { PaymentService, PaymentDetails } from '../../core/services/payment.service';
import { OrderEmailService } from '../../core/services/order-email.service';
import { NotificationService } from '../../core/services/notification.service';
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
  private readonly paymentService = inject(PaymentService);
  private readonly orderEmailService = inject(OrderEmailService);
  private readonly notificationService = inject(NotificationService);
  private loadedAddressUserId = '';
  private hasAppliedSavedAddress = false;
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
      if (userId && userId !== this.loadedAddressUserId) {
        this.loadedAddressUserId = userId;
        this.hasAppliedSavedAddress = false;
        void this.loadSavedAddresses(userId);
      } else if (!userId) {
        this.loadedAddressUserId = '';
        this.hasAppliedSavedAddress = false;
        this.addressBookService.clear();
      }
    });

    effect(() => {
      const addresses = this.savedAddresses();
      if (this.hasAppliedSavedAddress || this.fullName || this.phoneNumber || this.deliveryAddress) return;
      const category = this.addressCategoryWithSavedAddress(addresses);
      if (!category) return;
      this.addressCategory = category;
      this.applySavedAddress(category);
      this.addressSaveStatus.set(`${this.categoryLabel(category)} address loaded.`);
      this.hasAppliedSavedAddress = true;
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
    this.applySavedAddress(category);
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
      const label = `${this.categoryLabel(this.addressCategory)} address saved`;
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
    if (!userId) return;

    try {
      // Save delivery address
      await this.addressBookService.save(userId, this.addressCategory, {
        name: this.fullName,
        phone: this.phoneNumber,
        address: this.deliveryAddress
      });

      // Process payment
      const paymentDetails: PaymentDetails = {
        method: this.paymentMethod as 'upi' | 'card' | 'netbanking',
        upiId: this.paymentMethod === 'upi' ? (document.querySelector('#upi-id') as HTMLInputElement)?.value : undefined,
        cardNumber: this.paymentMethod === 'card' ? (document.querySelector('#card-number') as HTMLInputElement)?.value : undefined,
        cardholderName: this.paymentMethod === 'card' ? this.fullName : undefined,
        expiryMonth: this.paymentMethod === 'card' ? (document.querySelector('#expiry-month') as HTMLInputElement)?.value : undefined,
        expiryYear: this.paymentMethod === 'card' ? (document.querySelector('#expiry-year') as HTMLInputElement)?.value : undefined,
        cvv: this.paymentMethod === 'card' ? (document.querySelector('#cvv') as HTMLInputElement)?.value : undefined,
        bankName: this.paymentMethod === 'netbanking' ? (document.querySelector('#bank-select') as HTMLSelectElement)?.value : undefined
      };

      const paymentResponse = await this.paymentService.processPayment(
        this.total(),
        paymentDetails,
        `order-${Date.now()}`
      );

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message);
      }

      // Generate order ID
      const orderId = `ord-${Date.now()}`;

      // Record order after successful payment
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

      // Send order confirmation email
      if (this.emailAddress) {
        void this.orderEmailService.sendOrderConfirmation({
          id: orderId,
          userId,
          customerName: this.fullName,
          customerEmail: this.emailAddress,
          placedAt: new Date().toISOString(),
          total: this.total(),
          paymentMethod: this.paymentMethod,
          status: 'New',
          items: this.items().map((item) => ({
            productId: item.product.id,
            name: item.product.name,
            size: item.product.size,
            quantity: item.quantity,
            price: item.product.price
          }))
        });
      }

      // Send notification
      void this.notificationService.sendNotification(
        userId,
        'order_placed',
        'Order Placed Successfully',
        `Your order #${orderId.slice(-6)} has been placed. Transaction ID: ${paymentResponse.transactionId}`,
        'email',
        orderId
      );

      this.orderPlaced.emit();
    } catch (error: unknown) {
      console.error('Placing order failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to place order';
      alert(`Error: ${errorMsg}`);
    }
  }

  private async loadSavedAddresses(userId: string): Promise<void> {
    await this.addressBookService.load(userId);
  }

  private applySavedAddress(category: AddressCategory): void {
    const savedAddress = this.savedAddresses()[category];
    if (!savedAddress) return;
    this.fullName = savedAddress.name;
    this.phoneNumber = savedAddress.phone;
    this.deliveryAddress = savedAddress.address;
  }

  private addressCategoryWithSavedAddress(addresses: Partial<Record<AddressCategory, unknown>>): AddressCategory | null {
    return (['home', 'office', 'flat', 'other'] as AddressCategory[]).find((category) => addresses[category]) ?? null;
  }

  private categoryLabel(category: AddressCategory): string {
    return `${category[0].toUpperCase()}${category.slice(1)}`;
  }
}

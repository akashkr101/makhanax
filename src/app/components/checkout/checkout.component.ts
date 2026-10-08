import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AddressBookService, AddressCategory } from '../../core/services/address-book.service';
import { AuthService } from '../../core/services/auth.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
import { PaymentService, PaymentDetails } from '../../core/services/payment.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProductService } from '../../core/services/product.service';
import { validateOrderItems } from '../../core/services/order-validation';
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
  private readonly notificationService = inject(NotificationService);
  private readonly productService = inject(ProductService);
  private loadedAddressUserId = '';
  private hasAppliedSavedAddress = false;
  private readonly checkoutRequestId = crypto.randomUUID();
  protected readonly placingOrder = signal(false);
  protected readonly orderError = signal('');
  readonly items = input<CartItem[]>([]);
  readonly back = output<void>();
  readonly orderPlaced = output<void>();
  protected paymentMethod: PaymentDetails['method'] = 'cod';
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
    const validation = validateOrderItems(
      this.items().map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        size: item.product.size,
        quantity: item.quantity
      })),
      this.productService.products().map((product) => ({
        id: product.id,
        name: product.name,
        size: product.size,
        stock: product.stock ?? 0,
        price: product.price
      }))
    );
    return validation.valid ? validation.subtotal : this.items().reduce((sum, item) => sum + item.product.price * item.quantity, 0);
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
    if (this.placingOrder()) return;
    const userId = this.authService.userId();
    if (!userId) return;

    this.placingOrder.set(true);
    this.orderError.set('');
    try {
      // Save delivery address
      await this.addressBookService.save(userId, this.addressCategory, {
        name: this.fullName,
        phone: this.phoneNumber,
        address: this.deliveryAddress
      });

      const orderItems = this.items().map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        size: item.product.size,
        quantity: item.quantity
      }));

      const validation = validateOrderItems(
        orderItems,
        this.productService.products().map((product) => ({
          id: product.id,
          name: product.name,
          size: product.size,
          stock: product.stock ?? 0,
          price: product.price
        }))
      );

      if (!validation.valid) {
        throw new Error(validation.messages.join(' '));
      }

      // Process payment
      const paymentDetails: PaymentDetails = {
        method: this.paymentMethod
      };

      const paymentResponse = await this.paymentService.processPayment(
        validation.subtotal,
        paymentDetails,
        `order-${Date.now()}`
      );

      if (!paymentResponse.success) {
        throw new Error(paymentResponse.message);
      }

      // Record order after successful payment
      const createdOrder = await this.orderHistoryService.record(userId, this.fullName || 'Customer', this.emailAddress.trim().toLowerCase(), {
        total: validation.subtotal,
        paymentMethod: this.paymentMethod,
        phoneNumber: this.phoneNumber,
        deliveryAddress: this.deliveryAddress,
        items: validation.itemTotals.map((item) => ({
          productId: item.productId,
          name: item.name,
          size: item.size,
          quantity: item.quantity,
          price: item.unitPrice
        }))
      }, this.checkoutRequestId);

      // Send notification
      void this.notificationService.sendNotification(
        userId,
        'order_placed',
        'Order Placed Successfully',
        `Your order #${createdOrder.id.slice(-6)} has been placed. Payment is due on delivery.`,
        'email',
        createdOrder.id
      );

      this.orderPlaced.emit();
    } catch (error: unknown) {
      console.error('Placing order failed:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to place order';
      this.orderError.set(errorMsg);
    } finally {
      this.placingOrder.set(false);
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

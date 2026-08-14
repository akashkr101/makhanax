import { Component, computed, inject, signal } from '@angular/core';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { ProductCatalogComponent } from './components/product-catalog/product-catalog.component';
import { AuthService, EmailAuthMode } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { Product } from './models/product';

@Component({
  selector: 'app-root',
  imports: [ProductCatalogComponent, CartDrawerComponent, CheckoutComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  protected readonly loginOpen = this.authService.loginOpen;
  protected readonly phoneNumber = this.authService.phoneNumber;
  protected readonly localPhoneNumber = signal('');
  protected readonly countryCode = signal('+91');
  protected readonly countryCodes = [
    { code: '+91', name: 'India' },
    { code: '+1', name: 'United States' },
    { code: '+44', name: 'United Kingdom' },
    { code: '+61', name: 'Australia' },
    { code: '+971', name: 'UAE' }
  ];
  protected readonly otpSent = computed(() => this.authService.step() === 'verification');
  protected readonly otpVerified = computed(() => this.authService.step() === 'verified');
  protected readonly authError = this.authService.error;
  protected readonly authLoading = this.authService.loading;
  protected readonly emailAuthMode = this.authService.emailMode;
  protected readonly cartOpen = signal(false);
  protected readonly checkoutOpen = signal(false);
  protected readonly pendingCheckout = signal(false);
  protected readonly orderConfirmation = signal(false);
  protected readonly cartItems = this.cartService.items;
  protected readonly cartItemCount = this.cartService.itemCount;

  protected replaceImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Foxnut_Makhana_-_Nawada_District_-_Bihar_-_1.jpg/1920px-Foxnut_Makhana_-_Nawada_District_-_Bihar_-_1.jpg';
  }

  protected openLogin(): void {
    this.authService.openLogin();
  }

  protected closeLogin(): void {
    this.authService.closeLogin();
  }

  protected async requestOtp(event: Event): Promise<void> {
    event.preventDefault();
    await this.authService.requestOtp(this.countryCode(), this.localPhoneNumber());
  }

  protected async verifyOtp(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const code = new FormData(form).get('otp')?.toString() ?? '';
    const verified = await this.authService.verifyOtp(code);
    if (verified && this.pendingCheckout()) {
      this.pendingCheckout.set(false);
      this.authService.closeLogin();
      this.checkoutOpen.set(true);
    }
  }

  protected editPhone(): void {
    this.authService.resetFlow();
  }

  protected usePhoneLogin(): void {
    this.authService.usePhoneLogin();
  }

  protected useEmailLogin(mode: EmailAuthMode = 'signIn'): void {
    this.authService.useEmailLogin(mode);
  }

  protected async authenticateWithEmail(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const credentials = new FormData(form);
    const authenticated = await this.authService.authenticateWithEmail(
      credentials.get('email')?.toString() ?? '',
      credentials.get('password')?.toString() ?? ''
    );
    if (authenticated && this.pendingCheckout()) {
      this.pendingCheckout.set(false);
      this.authService.closeLogin();
      this.checkoutOpen.set(true);
    }
  }

  protected addToCart(product: Product): void {
    this.cartService.add(product);
    this.cartOpen.set(true);
  }

  protected changeQuantity(change: { id: string; quantity: number }): void {
    this.cartService.setQuantity(change.id, change.quantity);
  }

  protected removeFromCart(id: string): void {
    this.cartService.remove(id);
  }

  protected beginCheckout(): void {
    this.cartOpen.set(false);
    if (this.authService.isAuthenticated()) {
      this.checkoutOpen.set(true);
      return;
    }
    this.pendingCheckout.set(true);
    this.authService.openLogin();
  }

  protected finishOrder(): void {
    this.checkoutOpen.set(false);
    this.cartService.clear();
    this.orderConfirmation.set(true);
    window.setTimeout(() => this.orderConfirmation.set(false), 5000);
  }
}

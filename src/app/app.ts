import { Component, OnInit, computed, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CartDrawerComponent } from './components/cart-drawer/cart-drawer.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { CustomerCounterComponent } from './components/customer-counter/customer-counter.component';
import { ProductCatalogComponent } from './components/product-catalog/product-catalog.component';
import { AuthService, EmailAuthMode } from './core/services/auth.service';
import { CartService } from './core/services/cart.service';
import { CustomerDirectoryService } from './core/services/customer-directory.service';
import { OrderHistoryService } from './core/services/order-history.service';
import { Product } from './models/product';

@Component({
  selector: 'app-root',
  imports: [ProductCatalogComponent, CartDrawerComponent, CheckoutComponent, CustomerCounterComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './app-overrides.scss'],
})
export class App implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly cartService = inject(CartService);
  private readonly customerDirectoryService = inject(CustomerDirectoryService);
  private readonly orderHistoryService = inject(OrderHistoryService);
  private readonly router = inject(Router);
  protected readonly role = this.authService.role;
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
  protected readonly emailAuthOpen = computed(() => this.authService.step() === 'email');
  protected readonly authError = this.authService.error;
  protected readonly authSuccess = this.authService.success;
  protected readonly authLoading = this.authService.loading;
  protected readonly emailAuthMode = this.authService.emailMode;
  protected readonly isAuthenticated = this.authService.isAuthenticated;
  protected readonly customerProfile = this.authService.customerProfile;
  protected readonly cartOpen = signal(false);
  protected readonly checkoutOpen = signal(false);
  protected readonly profileOpen = signal(false);
  protected readonly profileEditing = signal(false);
  protected readonly profileTab = signal<'menu' | 'profile' | 'orders' | 'contact'>('menu');
  protected readonly orders = this.orderHistoryService.orders;
  protected readonly ordersError = this.orderHistoryService.error;
  protected readonly pendingCheckout = signal(false);
  protected readonly cartNotice = signal('');
  protected readonly loginNotice = signal(false);
  protected readonly orderConfirmation = signal(false);
  protected readonly cartItems = this.cartService.items;
  protected readonly cartItemCount = this.cartService.itemCount;
  protected readonly totalCustomers = this.customerDirectoryService.totalCustomers;
  protected readonly headerHidden = signal(false);
  private lastScrollPosition = 0;

  ngOnInit(): void {
    this.customerDirectoryService.watchTotalCustomers();
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    const currentScrollPosition = window.scrollY;
    const scrollDifference = currentScrollPosition - this.lastScrollPosition;
    if (currentScrollPosition < 24 || scrollDifference < -6) {
      this.headerHidden.set(false);
    } else if (scrollDifference > 6) {
      this.headerHidden.set(true);
    }
    this.lastScrollPosition = currentScrollPosition;
  }

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

  protected openProfile(): void {
    this.profileEditing.set(false);
    this.profileTab.set('menu');
    this.profileOpen.set(true);
    const userId = this.authService.userId();
    if (userId) void this.orderHistoryService.load(userId);
  }

  protected closeProfile(): void {
    this.profileEditing.set(false);
    this.profileOpen.set(false);
  }

  protected selectProfileTab(tab: 'profile' | 'orders' | 'contact'): void {
    this.profileTab.set(tab);
    this.profileEditing.set(false);
  }

  protected goToAdminDashboard(): void {
    this.closeProfile();
    void this.router.navigate(['/admin']);
  }

  protected backToProfileMenu(): void {
    this.profileTab.set('menu');
    this.profileEditing.set(false);
  }

  protected formatOrderDate(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected startProfileEdit(): void {
    this.profileEditing.set(true);
  }

  protected cancelProfileEdit(): void {
    this.profileEditing.set(false);
  }

  protected async saveProfile(event: Event): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const saved = await this.authService.updateCustomerProfile(
      new FormData(form).get('displayName')?.toString() ?? ''
    );
    if (saved) this.profileEditing.set(false);
  }

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    this.closeProfile();
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
    if (verified) this.completeLogin();
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
    if (authenticated) this.completeLogin();
  }

  private completeLogin(): void {
    const shouldOpenCheckout = this.pendingCheckout();
    this.pendingCheckout.set(false);
    this.authService.closeLogin();
    this.loginNotice.set(true);
    window.setTimeout(() => this.loginNotice.set(false), 3500);
    if (shouldOpenCheckout) this.checkoutOpen.set(true);
  }

  protected addToCart(product: Product): void {
    this.cartService.add(product);
    this.cartNotice.set(`${product.name} (${product.size}) added to cart.`);
    window.setTimeout(() => this.cartNotice.set(''), 3500);
  }

  protected openCartFromNotice(): void {
    this.cartNotice.set('');
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

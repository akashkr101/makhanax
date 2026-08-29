import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CustomerDirectoryService, CustomerRecord } from '../core/services/customer-directory.service';
import { OrderEmailService } from '../core/services/order-email.service';
import { OrderHistoryService, OrderRecord, OrderStatus } from '../core/services/order-history.service';
import { ProductService } from '../core/services/product.service';
import { AnalyticsService, CustomerSatisfaction, EngagementMetrics, WishlistAnalytics } from '../core/services/analytics.service';
import { MakhanaCategory, Product } from '../models/product';

type AdminSection = 'overview' | 'products' | 'orders' | 'customers' | 'reports';
type RevenueBar = { label: string; value: number; height: number; formattedValue: string };
type RevenuePoint = { label: string; value: number; formattedValue: string; x: number; y: number };
type StatusSummary = { status: OrderStatus; count: number; percentage: number };
type CategoryStockSummary = { category: MakhanaCategory; stock: number; productCount: number; percentage: number };
type TopProductSummary = { name: string; units: number; width: number };
type OrderStatusFilter = OrderStatus | 'All';
const orderStatusRank: Record<OrderStatus, number> = { New: 0, Confirmed: 1, Shipped: 2, Delivered: 3, Cancelled: 4 };

const adminSections: AdminSection[] = ['overview', 'products', 'orders', 'customers', 'reports'];
const adminSectionStorageKey = 'makhanax-admin-section';

const emptyProductForm = (): Omit<Product, 'id'> => ({
  name: '', category: 'normal', size: '250g', price: 0, image: '', tone: 'cream', description: '', stock: 0
});

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [FormsModule, UpperCasePipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly productService = inject(ProductService);
  private readonly orderEmailService = inject(OrderEmailService);
  protected readonly orderHistoryService = inject(OrderHistoryService);
  protected readonly customerDirectoryService = inject(CustomerDirectoryService);
  private readonly analyticsService = inject(AnalyticsService);

  protected readonly section = signal<AdminSection>('overview');
  protected readonly customerName = this.authService.customerProfile;
  protected readonly statuses: OrderStatus[] = ['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
  protected readonly statusFilters: OrderStatusFilter[] = ['All', ...this.statuses];
  protected readonly categories: MakhanaCategory[] = ['normal', 'ready-to-eat', 'salty', 'tikha'];
  protected readonly orderStatusFilter = signal<OrderStatusFilter>('All');
  protected readonly orderSearch = signal('');
  protected readonly orderFromDate = signal('');
  protected readonly orderToDate = signal('');

  protected readonly editingProductId = signal<string | null>(null);
  protected productForm: Omit<Product, 'id'> = emptyProductForm();
  protected readonly savingProduct = signal(false);
  protected readonly productFormError = signal('');
  protected readonly orderActionError = signal('');
  protected readonly orderActionNotice = signal('');
  protected readonly updatingOrderId = signal<string | null>(null);
  
  // Analytics signals
  protected readonly customerSatisfaction = signal<CustomerSatisfaction | null>(null);
  protected readonly engagementMetrics = signal<EngagementMetrics | null>(null);
  protected readonly wishlistAnalytics = signal<WishlistAnalytics | null>(null);

  protected readonly todaysRevenue = computed(() => {
    const today = new Date().toDateString();
    return this.orderHistoryService.allOrders()
      .filter((order) => new Date(order.placedAt).toDateString() === today)
      .reduce((sum, order) => sum + order.total, 0);
  });
  protected readonly todaysOrderCount = computed(() => {
    const today = new Date().toDateString();
    return this.orderHistoryService.allOrders().filter((order) => new Date(order.placedAt).toDateString() === today).length;
  });
  protected readonly pendingOrderCount = computed(() =>
    this.orderHistoryService.allOrders().filter((order) => order.status === 'New' || order.status === 'Confirmed').length
  );
  protected readonly lowStockCount = computed(() =>
    this.productService.products().filter((product) => (product.stock ?? 0) <= 5).length
  );
  protected readonly filteredOrders = computed(() => this.orderHistoryService.allOrders().filter((order) => this.matchesOrderFilters(order)));
  protected readonly recentOrders = computed(() => this.filteredOrders().slice(0, 8));
  protected readonly totalRevenue = computed(() =>
    this.filteredOrders().reduce((sum, order) => sum + order.total, 0)
  );
  protected readonly averageOrderValue = computed(() => {
    const orders = this.filteredOrders();
    return orders.length === 0 ? 0 : this.totalRevenue() / orders.length;
  });
  protected readonly topProducts = computed(() => {
    const unitsByName = new Map<string, number>();
    for (const order of this.filteredOrders()) {
      for (const item of order.items) {
        unitsByName.set(item.name, (unitsByName.get(item.name) ?? 0) + item.quantity);
      }
    }
    return [...unitsByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  });
  protected readonly revenueBars = computed<RevenueBar[]>(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const revenueByDay = new Map(days.map((date) => [date.toDateString(), 0]));
    for (const order of this.filteredOrders()) {
      const key = new Date(order.placedAt).toDateString();
      if (revenueByDay.has(key)) revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + order.total);
    }
    const maxRevenue = Math.max(...revenueByDay.values(), 1);
    return days.map((date) => {
      const value = revenueByDay.get(date.toDateString()) ?? 0;
      return {
        label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value,
        height: Math.max(6, Math.round((value / maxRevenue) * 100)),
        formattedValue: this.formatPrice(value)
      };
    });
  });
  protected readonly revenueTrend = computed(() => {
    const bars = this.revenueBars();
    const maxValue = Math.max(...bars.map((bar) => bar.value), 1);
    const width = 640;
    const top = 28;
    const bottom = 172;
    const left = 34;
    const right = width - 24;
    const step = (right - left) / Math.max(bars.length - 1, 1);
    const points: RevenuePoint[] = bars.map((bar, index) => ({
      label: bar.label,
      value: bar.value,
      formattedValue: bar.formattedValue,
      x: Math.round(left + index * step),
      y: Math.round(bottom - (bar.value / maxValue) * (bottom - top))
    }));
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPoints = `${left},${bottom} ${linePoints} ${right},${bottom}`;
    return { points, linePoints, areaPoints, bottom };
  });
  protected readonly orderStatusChart = computed<StatusSummary[]>(() => {
    const orders = this.filteredOrders();
    const totalOrders = Math.max(orders.length, 1);
    return this.statuses.map((status) => {
      const count = orders.filter((order) => order.status === status).length;
      return { status, count, percentage: Math.round((count / totalOrders) * 100) };
    });
  });
  protected readonly stockByCategory = computed<CategoryStockSummary[]>(() => {
    const totals = this.categories.map((category) => {
      const products = this.productService.products().filter((product) => product.category === category);
      return {
        category,
        productCount: products.length,
        stock: products.reduce((sum, product) => sum + (product.stock ?? 0), 0),
        percentage: 0
      };
    });
    const maxStock = Math.max(...totals.map((entry) => entry.stock), 1);
    return totals.map((entry) => ({ ...entry, percentage: Math.round((entry.stock / maxStock) * 100) }));
  });
  protected readonly topProductBars = computed<TopProductSummary[]>(() => {
    const topProducts = this.topProducts();
    const maxUnits = Math.max(...topProducts.map((entry) => entry[1]), 1);
    return topProducts.map(([name, units]) => ({ name, units, width: Math.round((units / maxUnits) * 100) }));
  });

  ngOnInit(): void {
    this.restoreSection();
    void this.productService.load();
    void this.orderHistoryService.loadAll();
    void this.customerDirectoryService.loadAll();
    void this.loadAnalytics();
  }

  private async loadAnalytics(): Promise<void> {
    try {
      const satisfaction = await this.analyticsService.getCustomerSatisfaction();
      this.customerSatisfaction.set(satisfaction);

      const engagement = await this.analyticsService.getEngagementMetrics(
        this.customerDirectoryService.customers().length,
        this.orderHistoryService.allOrders().length
      );
      this.engagementMetrics.set(engagement);

      const wishlist = await this.analyticsService.getWishlistAnalytics();
      this.wishlistAnalytics.set(wishlist);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  protected selectSection(section: AdminSection): void {
    this.section.set(section);
    try {
      localStorage.setItem(adminSectionStorageKey, section);
    } catch (error: unknown) {
      console.error('Saving admin section failed:', error);
    }
  }

  private restoreSection(): void {
    try {
      const savedSection = localStorage.getItem(adminSectionStorageKey);
      if (adminSections.includes(savedSection as AdminSection)) this.section.set(savedSection as AdminSection);
    } catch (error: unknown) {
      console.error('Restoring admin section failed:', error);
    }
  }

  protected backToStore(): void {
    void this.router.navigate(['']);
  }

  protected async signOut(): Promise<void> {
    await this.authService.signOut();
    void this.router.navigate(['']);
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  protected categoryLabel(category: MakhanaCategory): string {
    return { normal: 'Classic', 'ready-to-eat': 'Ready to eat', salty: 'Salty', tikha: 'Tikha' }[category];
  }

  protected resetOrderFilters(): void {
    this.orderStatusFilter.set('All');
    this.orderSearch.set('');
    this.orderFromDate.set('');
    this.orderToDate.set('');
  }

  protected downloadOrdersReport(): void {
    const headers = ['Order ID', 'Customer name', 'Email', 'Items', 'Total', 'Payment method', 'Placed', 'Status'];
    const rows = this.filteredOrders().map((order) => [
      order.id,
      this.customerNameForOrder(order),
      this.customerEmailForOrder(order),
      order.items.map((item) => `${item.quantity} x ${item.name} (${item.size})`).join('; '),
      order.total,
      order.paymentMethod.toUpperCase(),
      this.formatDate(order.placedAt),
      order.status
    ]);
    const csv = [headers, ...rows].map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `makhanax-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  protected customerNameForOrder(order: OrderRecord): string {
    return this.customerForOrder(order)?.displayName || order.customerName || 'Customer';
  }

  protected customerEmailForOrder(order: OrderRecord): string {
    return order.customerEmail || this.customerForOrder(order)?.email || '—';
  }

  protected canMoveOrderTo(currentStatus: OrderStatus, nextStatus: OrderStatus): boolean {
    if (currentStatus === nextStatus) return true;
    if (currentStatus === 'Delivered' || currentStatus === 'Cancelled') return false;
    if (nextStatus === 'Cancelled') return true;
    return orderStatusRank[nextStatus] > orderStatusRank[currentStatus] && nextStatus !== 'New';
  }

  protected async changeOrderStatus(orderId: string, status: string): Promise<void> {
    this.orderActionError.set('');
    this.orderActionNotice.set('');
    const order = this.orderHistoryService.allOrders().find((candidate) => candidate.id === orderId);
    if (!order) {
      this.orderActionError.set('Could not find this order. Refresh and try again.');
      return;
    }
    this.updatingOrderId.set(orderId);
    try {
      const nextStatus = status as OrderStatus;
      if (!this.canMoveOrderTo(order.status, nextStatus)) {
        this.orderActionError.set(`Cannot move an order from ${order.status} back to ${nextStatus}.`);
        return;
      }
      await this.orderHistoryService.updateStatus(orderId, nextStatus);
      await this.orderHistoryService.loadAll();
      const savedOrder = this.orderHistoryService.allOrders().find((candidate) => candidate.id === orderId);
      if (savedOrder?.status !== nextStatus) {
        throw new Error(`Firestore still has this order as ${savedOrder?.status ?? 'unknown'}. Check Firestore rules for admin order updates.`);
      }
      let stockAdjusted = order.stockAdjusted;
      if (nextStatus === 'Confirmed' && !order.stockAdjusted) {
        try {
          await this.productService.confirmOrderStock(order.items);
          stockAdjusted = true;
          await this.orderHistoryService.markStockAdjusted(orderId);
        } catch (stockError: unknown) {
          this.orderActionError.set(`Order confirmed, but stock could not be updated. ${this.formatError(stockError)}`);
          console.error('Updating confirmed order stock failed:', stockError);
        }
      }
      if (nextStatus === 'Confirmed' && !order.confirmationEmailSent) {
        try {
          await this.orderEmailService.sendOrderConfirmation({ ...order, status: nextStatus, stockAdjusted });
          await this.orderHistoryService.markConfirmationEmailSent(orderId);
          this.orderActionNotice.set(`Order confirmed and email has been sent to ${order.customerName || 'the customer'}.`);
        } catch (emailError: unknown) {
          this.orderActionError.set(`Order confirmed, but email could not be sent. ${this.formatError(emailError)}`);
          console.error('Sending order confirmation email failed:', emailError);
        }
      } else if (nextStatus === 'Confirmed') {
        this.orderActionNotice.set(`Order confirmed. Confirmation email was already sent to ${order.customerName || 'the customer'}.`);
      } else {
        this.orderActionNotice.set(`Order status updated to ${nextStatus}.`);
      }
    } catch (error: unknown) {
      this.orderActionError.set(`Could not update this order. ${this.formatError(error)}`);
      console.error('Updating order status failed:', error);
      await this.orderHistoryService.loadAll();
    } finally {
      this.updatingOrderId.set(null);
      if (this.orderActionNotice()) window.setTimeout(() => this.orderActionNotice.set(''), 5000);
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'text' in error && typeof error.text === 'string') return error.text;
    return 'Check EmailJS service, template, and public key settings.';
  }

  private matchesOrderFilters(order: OrderRecord): boolean {
    const statusFilter = this.orderStatusFilter();
    if (statusFilter !== 'All' && order.status !== statusFilter) return false;
    const placedAt = new Date(order.placedAt);
    const fromDate = this.orderFromDate();
    const toDate = this.orderToDate();
    if (fromDate && placedAt < new Date(`${fromDate}T00:00:00`)) return false;
    if (toDate && placedAt > new Date(`${toDate}T23:59:59`)) return false;
    const search = this.orderSearch().trim().toLowerCase();
    if (!search) return true;
    return [
      order.id,
      this.customerNameForOrder(order),
      this.customerEmailForOrder(order),
      order.paymentMethod,
      order.status,
      ...order.items.map((item) => `${item.name} ${item.size}`)
    ].some((value) => value.toLowerCase().includes(search));
  }

  private csvCell(value: string | number): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  private customerForOrder(order: OrderRecord): CustomerRecord | undefined {
    return this.customerDirectoryService.customers().find((customer) => customer.id === order.userId);
  }

  protected editProduct(product: Product): void {
    this.editingProductId.set(product.id);
    this.productForm = { ...product, stock: product.stock ?? 0 };
    this.productFormError.set('');
  }

  protected newProduct(): void {
    this.editingProductId.set(null);
    this.productForm = emptyProductForm();
    this.productFormError.set('');
  }

  protected async saveProduct(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.productForm.name.trim() || !this.productForm.size.trim() || this.productForm.price <= 0) {
      this.productFormError.set('Enter a product name, pack size, and a price greater than zero.');
      return;
    }
    this.savingProduct.set(true);
    this.productFormError.set('');
    try {
      const id = this.editingProductId();
      if (id) {
        await this.productService.updateProduct(id, this.productForm);
      } else {
        await this.productService.addProduct(this.productForm);
      }
      this.newProduct();
    } catch (error: unknown) {
      this.productFormError.set('Could not save this product. Check Firestore setup and rules.');
      console.error('Saving product failed:', error);
    } finally {
      this.savingProduct.set(false);
    }
  }

  protected async deleteProduct(id: string): Promise<void> {
    try {
      await this.productService.deleteProduct(id);
      if (this.editingProductId() === id) this.newProduct();
    } catch (error: unknown) {
      console.error('Deleting product failed:', error);
    }
  }

  protected async updateStock(product: Product, stockValue: string): Promise<void> {
    const stock = Number(stockValue);
    if (Number.isNaN(stock) || stock < 0) return;
    try {
      await this.productService.setStock(product.id, stock);
    } catch (error: unknown) {
      console.error('Updating stock failed:', error);
    }
  }
}

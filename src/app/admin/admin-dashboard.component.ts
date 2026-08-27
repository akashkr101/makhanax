import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CustomerDirectoryService } from '../core/services/customer-directory.service';
import { OrderHistoryService, OrderStatus } from '../core/services/order-history.service';
import { ProductService } from '../core/services/product.service';
import { MakhanaCategory, Product } from '../models/product';

type AdminSection = 'overview' | 'products' | 'orders' | 'customers' | 'reports';
type RevenueBar = { label: string; value: number; height: number; formattedValue: string };
type RevenuePoint = { label: string; value: number; formattedValue: string; x: number; y: number };
type StatusSummary = { status: OrderStatus; count: number; percentage: number };
type CategoryStockSummary = { category: MakhanaCategory; stock: number; productCount: number; percentage: number };
type TopProductSummary = { name: string; units: number; width: number };

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
  protected readonly orderHistoryService = inject(OrderHistoryService);
  protected readonly customerDirectoryService = inject(CustomerDirectoryService);

  protected readonly section = signal<AdminSection>('overview');
  protected readonly customerName = this.authService.customerProfile;
  protected readonly statuses: OrderStatus[] = ['New', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];
  protected readonly categories: MakhanaCategory[] = ['normal', 'ready-to-eat', 'salty', 'tikha'];

  protected readonly editingProductId = signal<string | null>(null);
  protected productForm: Omit<Product, 'id'> = emptyProductForm();
  protected readonly savingProduct = signal(false);
  protected readonly productFormError = signal('');

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
  protected readonly recentOrders = computed(() => this.orderHistoryService.allOrders().slice(0, 8));
  protected readonly totalRevenue = computed(() =>
    this.orderHistoryService.allOrders().reduce((sum, order) => sum + order.total, 0)
  );
  protected readonly averageOrderValue = computed(() => {
    const orders = this.orderHistoryService.allOrders();
    return orders.length === 0 ? 0 : this.totalRevenue() / orders.length;
  });
  protected readonly topProducts = computed(() => {
    const unitsByName = new Map<string, number>();
    for (const order of this.orderHistoryService.allOrders()) {
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
    for (const order of this.orderHistoryService.allOrders()) {
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
    const orders = this.orderHistoryService.allOrders();
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
    void this.productService.load();
    void this.orderHistoryService.loadAll();
    void this.customerDirectoryService.loadAll();
  }

  protected selectSection(section: AdminSection): void {
    this.section.set(section);
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

  protected async changeOrderStatus(orderId: string, status: string): Promise<void> {
    await this.orderHistoryService.updateStatus(orderId, status as OrderStatus);
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
    if (!this.productForm.name.trim() || this.productForm.price <= 0) {
      this.productFormError.set('Enter a product name and a price greater than zero.');
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

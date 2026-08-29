import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { PRODUCTS } from '../../data/product-data';
import { CartItem, MakhanaCategory, Product } from '../../models/product';

const defaultProductIds = new Set(PRODUCTS.map((product) => product.id));

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  readonly cartItems = input<CartItem[]>([]);
  protected readonly products = this.productService.products;
  protected readonly customProducts = computed(() => this.products().filter((product) => !defaultProductIds.has(product.id)));
  protected readonly featuredProducts = computed(() => this.categories.map((category) => this.selectedProduct(category)));
  protected readonly selectedSize = signal<Record<MakhanaCategory, string>>({ normal: '250g', 'ready-to-eat': '250g', salty: '250g', tikha: '250g' });
  protected readonly addProduct = output<Product>();
  protected readonly changeQuantity = output<{ id: string; quantity: number }>();
  protected readonly categories: MakhanaCategory[] = ['normal', 'ready-to-eat', 'salty', 'tikha'];
  protected readonly sizes = ['250g', '500g', '1 kg', '2 kg'];

  ngOnInit(): void {
    void this.productService.load();
  }

  protected selectedProduct(category: MakhanaCategory): Product {
    const productsInCategory = this.products().filter((product) => product.category === category);
    return productsInCategory.find((product) => product.size === this.selectedSize()[category])
      ?? PRODUCTS.find((product) => product.category === category && product.size === '250g')
      ?? productsInCategory[0]
      ?? PRODUCTS[0];
  }

  protected setSize(category: MakhanaCategory, size: string): void {
    this.selectedSize.update((selected) => ({ ...selected, [category]: size }));
  }

  protected scrollCarousel(track: HTMLElement, direction: -1 | 1): void {
    track.scrollBy({ left: direction * Math.max(track.clientWidth * 0.85, 280), behavior: 'smooth' });
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected quantityFor(productId: string): number {
    return this.cartItems().find((item) => item.product.id === productId)?.quantity ?? 0;
  }

  protected stockFor(product: Product): number {
    return product.stock ?? 0;
  }

  protected isOutOfStock(product: Product): boolean {
    return this.stockFor(product) <= 0;
  }

  protected hasMaxQuantity(product: Product): boolean {
    return this.quantityFor(product.id) >= this.stockFor(product);
  }

  protected categoryLabel(category: MakhanaCategory): string {
    return { normal: 'Classic', 'ready-to-eat': 'Roasted masala', salty: 'Lightly salted', tikha: 'Extra spicy' }[category];
  }

  protected replaceImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.products()[0]?.image ?? '';
  }
}

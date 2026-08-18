import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { ProductService } from '../../core/services/product.service';
import { CartItem, MakhanaCategory, Product } from '../../models/product';

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
  protected readonly selectedSize = signal<Record<MakhanaCategory, string>>({ normal: '250g', 'ready-to-eat': '250g', salty: '250g', tikha: '250g' });
  protected readonly addProduct = output<Product>();
  protected readonly changeQuantity = output<{ id: string; quantity: number }>();
  protected readonly categories: MakhanaCategory[] = ['normal', 'ready-to-eat', 'salty', 'tikha'];
  protected readonly sizes = ['250g', '500g', '1 kg', '2 kg'];

  ngOnInit(): void {
    void this.productService.load();
  }

  protected selectedProduct(category: MakhanaCategory): Product {
    return this.products().find((product) => product.category === category && product.size === this.selectedSize()[category]) ?? this.products()[0];
  }

  protected setSize(category: MakhanaCategory, size: string): void {
    this.selectedSize.update((selected) => ({ ...selected, [category]: size }));
  }

  protected formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }

  protected quantityFor(productId: string): number {
    return this.cartItems().find((item) => item.product.id === productId)?.quantity ?? 0;
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

import { Component, input, output, signal } from '@angular/core';
import { PRODUCTS } from '../../data/product-data';
import { CartItem, MakhanaCategory, Product } from '../../models/product';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent {
  readonly cartItems = input<CartItem[]>([]);
  protected readonly products = PRODUCTS;
  protected readonly selectedSize = signal<Record<MakhanaCategory, string>>({ normal: '250g', 'ready-to-eat': '250g' });
  protected readonly addProduct = output<Product>();
  protected readonly changeQuantity = output<{ id: string; quantity: number }>();
  protected readonly categories: MakhanaCategory[] = ['normal', 'ready-to-eat'];
  protected readonly sizes = ['250g', '500g', '1 kg', '2 kg'];

  protected selectedProduct(category: MakhanaCategory): Product {
    return this.products.find((product) => product.category === category && product.size === this.selectedSize()[category]) ?? this.products[0];
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

  protected replaceImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.products[0].image;
  }
}

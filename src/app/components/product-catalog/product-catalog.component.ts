import { Component, output, signal } from '@angular/core';
import { PRODUCTS } from '../../data/product-data';
import { MakhanaCategory, Product } from '../../models/product';

@Component({
  selector: 'app-product-catalog',
  standalone: true,
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent {
  protected readonly products = PRODUCTS;
  protected readonly selectedSize = signal<Record<MakhanaCategory, string>>({ normal: '250g', 'ready-to-eat': '250g' });
  protected readonly addProduct = output<Product>();
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

  protected replaceImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.onerror = null;
    image.src = this.products[0].image;
  }
}

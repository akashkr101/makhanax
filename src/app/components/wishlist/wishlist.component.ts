import { Component, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WishlistService } from '../../core/services/wishlist.service';
import { Product } from '../../models/product';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wishlist-sidebar" [class.open]="isOpen()">
      <div class="wishlist-header">
        <h3>Wishlist</h3>
        <button (click)="close.emit()" class="btn-close">✕</button>
      </div>

      <div class="wishlist-content">
        <div *ngIf="wishlistItems().length === 0" class="empty-state">
          <p>Your wishlist is empty</p>
          <small>Add products to save them for later</small>
        </div>

        <div *ngIf="wishlistItems().length > 0" class="wishlist-count">
          {{ wishlistItems().length }} item{{ wishlistItems().length !== 1 ? 's' : '' }}
        </div>

        <div class="wishlist-items">
          <div *ngFor="let item of wishlistItems()" class="wishlist-item">
            <img [src]="item.image" [alt]="item.name" class="product-image">
            <div class="product-info">
              <div class="product-name">{{ item.name }}</div>
              <div class="product-size">{{ item.size }}</div>
              <div class="product-price">₹{{ item.price }}</div>
              <div class="item-actions">
                <button (click)="addToCart.emit(item)" class="btn-cart" title="Add to cart">
                  🛒 Add to Cart
                </button>
                <button (click)="removeFromWishlist(item.id)" class="btn-remove" title="Remove from wishlist">
                  ❌
                </button>
              </div>
            </div>
          </div>
        </div>

        <div *ngIf="wishlistItems().length > 0" class="wishlist-footer">
          <button (click)="clearWishlist()" class="btn-clear">Clear Wishlist</button>
        </div>
      </div>
    </div>

    <div *ngIf="isOpen()" class="wishlist-overlay" (click)="close.emit()"></div>
  `,
  styles: [`
    .wishlist-sidebar {
      position: fixed;
      right: -400px;
      top: 0;
      width: 400px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
      transition: right 0.3s ease;
      z-index: 999;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .wishlist-sidebar.open {
      right: 0;
    }

    .wishlist-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 998;
    }

    .wishlist-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f9f9f9;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .wishlist-header h3 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .btn-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close:hover {
      color: #333;
    }

    .wishlist-content {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }

    .empty-state p {
      font-size: 16px;
      margin: 0 0 10px 0;
    }

    .empty-state small {
      display: block;
      font-size: 12px;
    }

    .wishlist-count {
      font-size: 12px;
      color: #666;
      margin-bottom: 15px;
      padding: 8px 12px;
      background: #f0f0f0;
      border-radius: 4px;
      font-weight: 500;
    }

    .wishlist-items {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .wishlist-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: #f9f9f9;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      transition: all 0.2s;
    }

    .wishlist-item:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .product-image {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
      flex-shrink: 0;
    }

    .product-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .product-name {
      font-weight: 500;
      color: #333;
      font-size: 14px;
    }

    .product-size {
      font-size: 12px;
      color: #999;
    }

    .product-price {
      font-weight: bold;
      color: #2c3e50;
      font-size: 14px;
      margin: 4px 0;
    }

    .item-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .btn-cart {
      flex: 1;
      padding: 6px 8px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-cart:hover {
      background: #0056b3;
    }

    .btn-remove {
      padding: 6px 10px;
      background: #ffebee;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }

    .btn-remove:hover {
      background: #ffcdd2;
    }

    .wishlist-footer {
      padding: 15px 20px;
      border-top: 1px solid #e0e0e0;
      background: #f9f9f9;
      position: sticky;
      bottom: 0;
    }

    .btn-clear {
      width: 100%;
      padding: 12px;
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }

    .btn-clear:hover {
      background: #e0e0e0;
    }

    @media (max-width: 768px) {
      .wishlist-sidebar {
        width: 100%;
        right: -100%;
      }
    }
  `]
})
export class WishlistComponent {
  private readonly wishlistService = inject(WishlistService);

  readonly isOpen = input<boolean>(false);
  readonly close = output<void>();
  readonly addToCart = output<Product>();

  protected readonly wishlistItems = signal<Product[]>([]);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        // Wishlist items would be loaded from a product service combined with wishlist items
      }
    });
  }

  setProducts(products: Product[]): void {
    this.wishlistItems.set(products);
  }

  protected async removeFromWishlist(productId: string): Promise<void> {
    await this.wishlistService.remove(productId);
    this.wishlistItems.update((items) => items.filter((p) => p.id !== productId));
  }

  protected async clearWishlist(): Promise<void> {
    if (confirm('Clear your entire wishlist?')) {
      for (const item of this.wishlistItems()) {
        await this.wishlistService.remove(item.id);
      }
      this.wishlistItems.set([]);
    }
  }
}

import { computed, Injectable, signal } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { Product } from '../../models/product';

interface WishlistItem {
  productId: string;
  addedAt: number;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  private readonly state = signal<WishlistItem[]>([]);
  private readonly firebaseApp = getApps().length ? getApp() : undefined;
  private readonly firestore = this.firebaseApp ? getFirestore(this.firebaseApp) : null;
  private currentUserId = '';

  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().length);
  readonly lastUpdated = signal<number>(Date.now());
  readonly error = signal('');

  setUserId(userId: string): void {
    this.currentUserId = userId;
    if (userId) {
      void this.load(userId);
    } else {
      this.state.set([]);
    }
  }

  private async load(userId: string): Promise<void> {
    try {
      if (!this.firestore) return;
      const userWishlistRef = collection(this.firestore, `users/${userId}/wishlist`);
      const snapshot = await getDocs(userWishlistRef);
      const wishlistItems = snapshot.docs.map((doc) => ({
        productId: doc.id,
        addedAt: doc.data()['addedAt'] as number || Date.now()
      }));
      this.state.set(wishlistItems);
      this.error.set('');
    } catch (error) {
      this.error.set('Failed to load wishlist');
      console.error('Loading wishlist failed:', error);
    }
  }

  async add(product: Product): Promise<boolean> {
    if (!this.currentUserId || !this.firestore) return false;
    
    try {
      const existing = this.state().find((item) => item.productId === product.id);
      if (existing) return true;
      
      const wishlistRef = doc(this.firestore, `users/${this.currentUserId}/wishlist/${product.id}`);
      await setDoc(wishlistRef, { addedAt: Date.now() });
      
      this.state.update((items) => [...items, { productId: product.id, addedAt: Date.now() }]);
      this.lastUpdated.set(Date.now());
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set('Failed to add to wishlist');
      console.error('Adding to wishlist failed:', error);
      return false;
    }
  }

  async remove(productId: string): Promise<boolean> {
    if (!this.currentUserId || !this.firestore) return false;
    
    try {
      const wishlistRef = doc(this.firestore, `users/${this.currentUserId}/wishlist/${productId}`);
      await deleteDoc(wishlistRef);
      
      this.state.update((items) => items.filter((item) => item.productId !== productId));
      this.lastUpdated.set(Date.now());
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set('Failed to remove from wishlist');
      console.error('Removing from wishlist failed:', error);
      return false;
    }
  }

  isFavorite(productId: string): boolean {
    return this.state().some((item) => item.productId === productId);
  }

  clear(): void {
    this.state.set([]);
  }
}

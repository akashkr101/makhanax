import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, setDoc, updateDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { PRODUCTS } from '../../data/product-data';
import { Product } from '../../models/product';

@Injectable({ providedIn: 'root' })
export class ProductService {
  readonly products = signal<Product[]>(PRODUCTS);
  readonly error = signal('');
  readonly loaded = signal(false);

  private readonly firebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly firestore = getFirestore(this.firebaseApp);

  async load(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(this.firestore, 'products'));
      if (!snapshot.empty) {
        const cloudProducts = snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() } as Product));
        const cloudById = new Map(cloudProducts.map((product) => [product.id, product]));
        this.products.set(PRODUCTS.map((product) => {
          const cloudProduct = cloudById.get(product.id);
          return cloudProduct ? { ...product, ...cloudProduct, id: product.id, category: product.category, size: product.size } : product;
        }));
      }
      this.error.set('');
    } catch (error: unknown) {
      this.error.set('Cloud catalog is unavailable. Showing the default product range.');
      console.error('Loading products from Firestore failed:', error);
    } finally {
      this.loaded.set(true);
    }
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<void> {
    const created = await addDoc(collection(this.firestore, 'products'), product);
    this.products.update((products) => [...products, { ...product, id: created.id }]);
  }

  async updateProduct(id: string, changes: Partial<Product>): Promise<void> {
    await setDoc(doc(this.firestore, 'products', id), changes, { merge: true });
    this.products.update((products) => products.map((product) => product.id === id ? { ...product, ...changes } : product));
  }

  async deleteProduct(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'products', id));
    this.products.update((products) => products.filter((product) => product.id !== id));
  }

  async setStock(id: string, stock: number): Promise<void> {
    await updateDoc(doc(this.firestore, 'products', id), { stock });
    this.products.update((products) => products.map((product) => product.id === id ? { ...product, stock } : product));
  }

  searchByName(query: string): Product[] {
    const lowerQuery = query.toLowerCase();
    return this.products().filter((product) =>
      product.name.toLowerCase().includes(lowerQuery) ||
      product.description.toLowerCase().includes(lowerQuery)
    );
  }

  filterByCategory(category: string): Product[] {
    if (!category) return this.products();
    return this.products().filter((product) => product.category === category);
  }

  filterByPriceRange(minPrice: number, maxPrice: number): Product[] {
    return this.products().filter((product) => product.price >= minPrice && product.price <= maxPrice);
  }

  sortByPrice(ascending: boolean = true): Product[] {
    return [...this.products()].sort((a, b) => ascending ? a.price - b.price : b.price - a.price);
  }

  sortByName(ascending: boolean = true): Product[] {
    return [...this.products()].sort((a, b) =>
      ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }

  getProductById(id: string): Product | undefined {
    return this.products().find((product) => product.id === id);
  }

  getAvailableProducts(): Product[] {
    return this.products().filter((product) => (product.stock ?? 0) > 0);
  }
}

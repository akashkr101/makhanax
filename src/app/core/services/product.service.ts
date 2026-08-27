import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { PRODUCTS } from '../../data/product-data';
import { Product } from '../../models/product';

interface StockLineItem {
  productId?: string;
  name: string;
  size: string;
  quantity: number;
}

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
        const defaultProducts = PRODUCTS.map((product) => {
          const cloudProduct = cloudById.get(product.id);
          return cloudProduct ? { ...product, ...cloudProduct, id: product.id, category: product.category, size: product.size } : product;
        });
        const defaultProductIds = new Set(PRODUCTS.map((product) => product.id));
        const customProducts = cloudProducts
          .filter((product) => !defaultProductIds.has(product.id))
          .map((product) => ({ ...product, size: product.size?.trim() || '250g' }));
        this.products.set([...defaultProducts, ...customProducts]);
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
    const productToSave = { ...product, size: product.size.trim() || '250g' };
    const id = await this.createProductDocumentId(product.name);
    await setDoc(doc(this.firestore, 'products', id), productToSave);
    this.products.update((products) => [...products, { ...productToSave, id }]);
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

  async confirmOrderStock(items: StockLineItem[]): Promise<void> {
    const quantitiesByProductId = new Map<string, number>();
    for (const item of items) {
      const product = this.resolveProductForStock(item);
      if (!product) throw new Error(`Could not find product ${item.name} (${item.size}).`);
      quantitiesByProductId.set(product.id, (quantitiesByProductId.get(product.id) ?? 0) + item.quantity);
    }

    const updates = [...quantitiesByProductId.entries()].map(([id, quantity]) => {
      const product = this.products().find((candidate) => candidate.id === id);
      const stock = product?.stock ?? 0;
      if (!product) throw new Error(`Could not find product ${id}.`);
      if (stock < quantity) throw new Error(`Only ${stock} units are in stock for ${product.name} (${product.size}).`);
      return { id, stock: stock - quantity };
    });

    const batch = writeBatch(this.firestore);
    for (const update of updates) {
      batch.update(doc(this.firestore, 'products', update.id), { stock: update.stock });
    }
    await batch.commit();
    this.products.update((products) => products.map((product) => {
      const update = updates.find((entry) => entry.id === product.id);
      return update ? { ...product, stock: update.stock } : product;
    }));
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

  private resolveProductForStock(item: StockLineItem): Product | undefined {
    if (item.productId) {
      const product = this.products().find((candidate) => candidate.id === item.productId);
      if (product) return product;
    }
    return this.products().find((product) => product.name === item.name && product.size === item.size);
  }

  private async createProductDocumentId(name: string): Promise<string> {
    const baseId = this.toProductDocumentId(name);
    let id = baseId;
    let suffix = 2;
    while ((await getDoc(doc(this.firestore, 'products', id))).exists()) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    return id;
  }

  private toProductDocumentId(name: string): string {
    return name.trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `product-${Date.now()}`;
  }
}

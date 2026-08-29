import { Injectable, computed, signal } from '@angular/core';
import { Product, MakhanaCategory } from '../../models/product';

export interface SearchFilters {
  query: string;
  category?: MakhanaCategory;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  minRating?: number;
  sortBy?: 'price-asc' | 'price-desc' | 'name' | 'rating' | 'newest';
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly allProducts = signal<Product[]>([]);
  private readonly filters = signal<SearchFilters>({
    query: '',
    category: undefined,
    minPrice: 0,
    maxPrice: 5000,
    inStockOnly: false,
    minRating: 0,
    sortBy: 'name'
  });

  readonly filteredProducts = computed(() => {
    let results = this.allProducts();
    const f = this.filters();

    // Text search
    if (f.query.trim()) {
      const query = f.query.toLowerCase();
      results = results.filter((p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.includes(query as any)
      );
    }

    // Category filter
    if (f.category) {
      results = results.filter((p) => p.category === f.category);
    }

    // Price range filter
    if (f.minPrice !== undefined) {
      results = results.filter((p) => p.price >= f.minPrice!);
    }
    if (f.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= f.maxPrice!);
    }

    // Stock filter
    if (f.inStockOnly) {
      results = results.filter((p) => (p.stock ?? 0) > 0);
    }

    // Rating filter
    if (f.minRating && f.minRating > 0) {
      results = results.filter((p) => (p.averageRating ?? 0) >= f.minRating!);
    }

    // Sorting
    if (f.sortBy) {
      results = this.sortResults(results, f.sortBy);
    }

    return results;
  });

  readonly resultCount = computed(() => this.filteredProducts().length);
  readonly uniqueCategories = computed(() => {
    const categories = new Set<MakhanaCategory>();
    this.allProducts().forEach((p) => categories.add(p.category));
    return Array.from(categories);
  });
  readonly priceRange = computed(() => {
    const prices = this.allProducts().map((p) => p.price);
    return {
      min: Math.min(...prices, 0),
      max: Math.max(...prices, 5000)
    };
  });

  setAllProducts(products: Product[]): void {
    this.allProducts.set(products);
  }

  updateFilters(newFilters: Partial<SearchFilters>): void {
    this.filters.update((current) => ({ ...current, ...newFilters }));
  }

  setQuery(query: string): void {
    this.updateFilters({ query });
  }

  setCategory(category: MakhanaCategory | undefined): void {
    this.updateFilters({ category });
  }

  setPriceRange(min: number, max: number): void {
    this.updateFilters({ minPrice: min, maxPrice: max });
  }

  setSortBy(sortBy: SearchFilters['sortBy']): void {
    this.updateFilters({ sortBy });
  }

  setInStockOnly(inStockOnly: boolean): void {
    this.updateFilters({ inStockOnly });
  }

  setMinRating(minRating: number): void {
    this.updateFilters({ minRating });
  }

  clearFilters(): void {
    this.filters.set({
      query: '',
      category: undefined,
      minPrice: 0,
      maxPrice: 5000,
      inStockOnly: false,
      minRating: 0,
      sortBy: 'name'
    });
  }

  private sortResults(products: Product[], sortBy: SearchFilters['sortBy']): Product[] {
    const sorted = [...products];
    switch (sortBy) {
      case 'price-asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'rating':
        return sorted.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
      case 'newest':
        return sorted; // Assuming order in array is newest first
      default:
        return sorted;
    }
  }

  getAutocomplete(prefix: string): string[] {
    const query = prefix.toLowerCase();
    const suggestions = new Set<string>();

    // Product names
    this.allProducts().forEach((p) => {
      if (p.name.toLowerCase().startsWith(query)) {
        suggestions.add(p.name);
      }
    });

    // Categories
    this.uniqueCategories().forEach((c) => {
      if (c.toLowerCase().startsWith(query)) {
        suggestions.add(c);
      }
    });

    return Array.from(suggestions).sort().slice(0, 5);
  }
}

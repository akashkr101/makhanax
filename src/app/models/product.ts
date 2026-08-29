export type MakhanaCategory = 'normal' | 'ready-to-eat' | 'salty' | 'tikha';

export interface Product {
  id: string;
  name: string;
  category: MakhanaCategory;
  size: string;
  price: number;
  image: string;
  tone: string;
  description: string;
  stock?: number;
  averageRating?: number;
  totalReviews?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

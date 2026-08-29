import { Injectable, signal } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { collection, deleteDoc, doc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore';

export interface ProductReview {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: number;
  updatedAt: number;
  helpful: number; // count of helpful votes
}

export interface ProductRating {
  productId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>; // count by star
}

@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly reviews = signal<ProductReview[]>([]);
  private readonly ratings = signal<Map<string, ProductRating>>(new Map());
  private readonly firebaseApp = getApps().length ? getApp() : undefined;
  private readonly firestore = this.firebaseApp ? getFirestore(this.firebaseApp) : null;
  private currentUserId = '';

  readonly allReviews = this.reviews.asReadonly();
  readonly error = signal('');

  setUserId(userId: string): void {
    this.currentUserId = userId;
  }

  async loadProductReviews(productId: string): Promise<ProductReview[]> {
    try {
      if (!this.firestore) return [];
      
      const reviewsRef = collection(this.firestore, 'reviews');
      const q = query(reviewsRef, where('productId', '==', productId));
      const snapshot = await getDocs(q);
      
      const productReviews = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as ProductReview));
      
      return productReviews.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      this.error.set('Failed to load reviews');
      console.error('Loading reviews failed:', error);
      return [];
    }
  }

  async addReview(productId: string, rating: number, comment: string, userName: string): Promise<boolean> {
    if (!this.currentUserId || !this.firestore) return false;
    if (rating < 1 || rating > 5) return false;

    try {
      const reviewId = `${productId}-${this.currentUserId}-${Date.now()}`;
      const reviewRef = doc(this.firestore, 'reviews', reviewId);
      
      const review: Omit<ProductReview, 'id'> = {
        productId,
        userId: this.currentUserId,
        userName,
        rating,
        comment: comment.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        helpful: 0
      };

      await setDoc(reviewRef, review);
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set('Failed to add review');
      console.error('Adding review failed:', error);
      return false;
    }
  }

  async updateReview(reviewId: string, rating: number, comment: string): Promise<boolean> {
    if (!this.firestore) return false;

    try {
      const reviewRef = doc(this.firestore, 'reviews', reviewId);
      await setDoc(reviewRef, {
        rating,
        comment: comment.trim(),
        updatedAt: Date.now()
      }, { merge: true });
      
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set('Failed to update review');
      console.error('Updating review failed:', error);
      return false;
    }
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    if (!this.firestore) return false;

    try {
      await deleteDoc(doc(this.firestore, 'reviews', reviewId));
      this.error.set('');
      return true;
    } catch (error) {
      this.error.set('Failed to delete review');
      console.error('Deleting review failed:', error);
      return false;
    }
  }

  calculateRating(reviews: ProductReview[]): ProductRating {
    if (reviews.length === 0) {
      return {
        productId: '',
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalRating = 0;

    reviews.forEach((review) => {
      totalRating += review.rating;
      distribution[review.rating]++;
    });

    return {
      productId: reviews[0].productId,
      averageRating: Math.round((totalRating / reviews.length) * 10) / 10,
      totalReviews: reviews.length,
      ratingDistribution: distribution
    };
  }

  getStarPercentage(rating: number, reviews: ProductReview[]): number {
    if (reviews.length === 0) return 0;
    const count = reviews.filter((r) => r.rating === rating).length;
    return Math.round((count / reviews.length) * 100);
  }

  getUserReview(productId: string, reviews: ProductReview[]): ProductReview | null {
    return reviews.find((r) => r.productId === productId && r.userId === this.currentUserId) || null;
  }
}

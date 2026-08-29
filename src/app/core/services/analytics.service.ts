import { Injectable } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { ProductReview } from './reviews.service';

export interface ProductAnalytics {
  productId: string;
  productName: string;
  averageRating: number;
  totalReviews: number;
  salesCount: number;
  revenue: number;
}

export interface CustomerSatisfaction {
  averageRating: number;
  totalReviews: number;
  ratingsDistribution: Record<number, number>;
  ratingsByCategory: Record<string, number>;
}

export interface EngagementMetrics {
  customerReviewRate: number;
  averageReviewsPerProduct: number;
  topReviewedProducts: Array<{ name: string; reviews: number }>;
  mostHelpfulReviews: ProductReview[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly firebaseApp = getApps().length ? getApp() : undefined;
  private readonly firestore = this.firebaseApp ? getFirestore(this.firebaseApp) : null;

  async getCustomerSatisfaction(): Promise<CustomerSatisfaction> {
    try {
      if (!this.firestore) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          ratingsByCategory: {}
        };
      }

      const reviewsRef = collection(this.firestore, 'reviews');
      const snapshot = await getDocs(reviewsRef);
      
      if (snapshot.empty) {
        return {
          averageRating: 0,
          totalReviews: 0,
          ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          ratingsByCategory: {}
        };
      }

      const reviews = snapshot.docs.map((doc) => doc.data() as ProductReview);
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let totalRating = 0;

      for (const review of reviews) {
        totalRating += review.rating;
        distribution[review.rating]++;
      }

      const averageRating = reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : 0;

      return {
        averageRating,
        totalReviews: reviews.length,
        ratingsDistribution: distribution,
        ratingsByCategory: {}
      };
    } catch (error) {
      console.error('Getting customer satisfaction failed:', error);
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingsDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        ratingsByCategory: {}
      };
    }
  }

  async getEngagementMetrics(totalCustomers: number, totalOrders: number): Promise<EngagementMetrics> {
    try {
      if (!this.firestore) {
        return {
          customerReviewRate: 0,
          averageReviewsPerProduct: 0,
          topReviewedProducts: [],
          mostHelpfulReviews: []
        };
      }

      const reviewsRef = collection(this.firestore, 'reviews');
      const snapshot = await getDocs(reviewsRef);
      
      if (snapshot.empty) {
        return {
          customerReviewRate: 0,
          averageReviewsPerProduct: 0,
          topReviewedProducts: [],
          mostHelpfulReviews: []
        };
      }

      const reviews = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProductReview));
      const uniqueCustomersWithReviews = new Set(reviews.map((r) => r.userId)).size;
      const customerReviewRate = totalCustomers > 0 ? Math.round((uniqueCustomersWithReviews / totalCustomers) * 100) : 0;

      const productReviewCounts = new Map<string, number>();
      reviews.forEach((review) => {
        productReviewCounts.set(review.productId, (productReviewCounts.get(review.productId) ?? 0) + 1);
      });

      const averageReviewsPerProduct = productReviewCounts.size > 0 
        ? Math.round(reviews.length / productReviewCounts.size * 10) / 10 
        : 0;

      const topReviewedProducts = [...productReviewCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, reviews: count }));

      const mostHelpfulReviews = [...reviews]
        .sort((a, b) => b.helpful - a.helpful)
        .slice(0, 5);

      return {
        customerReviewRate,
        averageReviewsPerProduct,
        topReviewedProducts,
        mostHelpfulReviews
      };
    } catch (error) {
      console.error('Getting engagement metrics failed:', error);
      return {
        customerReviewRate: 0,
        averageReviewsPerProduct: 0,
        topReviewedProducts: [],
        mostHelpfulReviews: []
      };
    }
  }

}

import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ReviewsService, ProductReview, ProductRating } from '../../core/services/reviews.service';
import { Product } from '../../models/product';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reviews-container">
      <div class="reviews-header">
        <h3>Customer Reviews & Ratings</h3>
        <button (click)="toggleReviewForm()" class="btn-add-review">
          {{ showReviewForm() ? 'Cancel' : 'Write a Review' }}
        </button>
      </div>

      <!-- Rating Summary -->
      <div *ngIf="rating()?.totalReviews && rating()!.totalReviews > 0" class="rating-summary">
        <div class="rating-score">
          <div class="score">{{ rating()?.averageRating || 0 }}</div>
          <div class="stars">{{ renderStars(rating()?.averageRating || 0) }}</div>
          <div class="review-count">{{ rating()?.totalReviews }} reviews</div>
        </div>
        <div class="rating-bars">
          <div *ngFor="let starCount of [5, 4, 3, 2, 1]" class="rating-bar-item">
            <span class="star-label">{{ starCount }}★</span>
            <div class="bar">
              <div class="fill" [style.width.%]="getStarPercentage(starCount)"></div>
            </div>
            <span class="count">{{ getStarCount(starCount) }}</span>
          </div>
        </div>
      </div>

      <!-- No Reviews Message -->
      <div *ngIf="!rating()?.totalReviews || rating()!.totalReviews === 0" class="no-reviews">
        <p>No reviews yet. Be the first to review!</p>
      </div>

      <!-- Add Review Form -->
      <div *ngIf="showReviewForm()" class="review-form">
        <div class="form-group">
          <label>Rating</label>
          <div class="star-selector">
            <button *ngFor="let star of [1, 2, 3, 4, 5]"
                    (click)="userRating.set(star)"
                    [class.selected]="userRating() === star"
                    class="star-btn">
              ★
            </button>
          </div>
        </div>
        <div class="form-group">
          <label>Your Review</label>
          <textarea
            [(ngModel)]="reviewComment"
            placeholder="Share your experience with this product..."
            maxlength="500"
            rows="4">
          </textarea>
          <div class="char-count">{{ reviewComment.length }}/500</div>
        </div>
        <button (click)="submitReview()" class="btn-submit" [disabled]="!isReviewValid()">
          Submit Review
        </button>
      </div>

      <!-- Reviews List -->
      <div class="reviews-list">
        <div *ngFor="let review of reviews()" class="review-item">
          <div class="review-header">
            <div>
              <div class="reviewer-name">{{ review.userName }}</div>
              <div class="review-meta">
                <span class="stars">{{ renderStars(review.rating) }}</span>
                <span class="date">{{ formatDate(review.createdAt) }}</span>
                <span *ngIf="review.updatedAt > review.createdAt" class="edited">(edited)</span>
              </div>
            </div>
            <div *ngIf="isOwnReview(review)" class="review-actions">
              <button (click)="editReview(review)" class="btn-edit">Edit</button>
              <button (click)="deleteReview(review.id)" class="btn-delete">Delete</button>
            </div>
          </div>
          <p class="review-comment">{{ review.comment }}</p>
          <div class="review-footer">
            <button class="btn-helpful">👍 Helpful ({{ review.helpful }})</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .reviews-container {
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
      margin: 20px 0;
    }

    .reviews-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #e0e0e0;
    }

    .reviews-header h3 {
      margin: 0;
      font-size: 18px;
      color: #333;
    }

    .btn-add-review {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-add-review:hover {
      background: #0056b3;
    }

    .rating-summary {
      display: grid;
      grid-template-columns: 150px 1fr;
      gap: 30px;
      margin-bottom: 30px;
      padding: 20px;
      background: white;
      border-radius: 8px;
    }

    .rating-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .score {
      font-size: 48px;
      font-weight: bold;
      color: #ffc107;
    }

    .stars {
      font-size: 16px;
      color: #ffc107;
      margin: 5px 0;
    }

    .review-count {
      font-size: 14px;
      color: #666;
      margin-top: 10px;
    }

    .rating-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rating-bar-item {
      display: grid;
      grid-template-columns: 40px 1fr 40px;
      gap: 10px;
      align-items: center;
    }

    .star-label {
      font-size: 12px;
      font-weight: bold;
    }

    .bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .fill {
      height: 100%;
      background: #ffc107;
      transition: width 0.3s ease;
    }

    .count {
      font-size: 12px;
      text-align: right;
      color: #666;
    }

    .no-reviews {
      text-align: center;
      padding: 30px;
      color: #999;
      background: white;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .review-form {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      color: #333;
    }

    .star-selector {
      display: flex;
      gap: 10px;
    }

    .star-btn {
      width: 40px;
      height: 40px;
      font-size: 24px;
      border: 2px solid #ddd;
      background: white;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s;
    }

    .star-btn:hover {
      border-color: #ffc107;
      color: #ffc107;
    }

    .star-btn.selected {
      background: #ffc107;
      border-color: #ffc107;
      color: white;
    }

    textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: inherit;
      resize: vertical;
    }

    .char-count {
      font-size: 12px;
      color: #999;
      text-align: right;
      margin-top: 5px;
    }

    .btn-submit {
      padding: 10px 20px;
      background: #28a745;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .btn-submit:hover:not(:disabled) {
      background: #218838;
    }

    .btn-submit:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .reviews-list {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .review-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #ffc107;
    }

    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .reviewer-name {
      font-weight: bold;
      color: #333;
    }

    .review-meta {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    .review-meta span {
      margin-right: 10px;
    }

    .edited {
      color: #666;
      font-style: italic;
    }

    .review-actions {
      display: flex;
      gap: 8px;
    }

    .btn-edit, .btn-delete {
      padding: 4px 8px;
      font-size: 12px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }

    .btn-edit {
      background: #e3f2fd;
      color: #1976d2;
    }

    .btn-delete {
      background: #ffebee;
      color: #d32f2f;
    }

    .review-comment {
      margin: 0 0 10px 0;
      color: #555;
      line-height: 1.5;
    }

    .review-footer {
      display: flex;
      gap: 10px;
    }

    .btn-helpful {
      padding: 6px 12px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }

    .btn-helpful:hover {
      background: #efefef;
    }

    @media (max-width: 768px) {
      .rating-summary {
        grid-template-columns: 1fr;
      }

      .reviews-header {
        flex-direction: column;
        gap: 10px;
        align-items: flex-start;
      }

      .btn-add-review {
        width: 100%;
      }
    }
  `]
})
export class ReviewsComponent implements OnInit {
  private readonly reviewsService = inject(ReviewsService);
  private readonly authService = inject(AuthService);

  readonly product = input.required<Product>();
  readonly reviewsChanged = output<void>();

  protected readonly showReviewForm = signal(false);
  protected readonly reviews = signal<ProductReview[]>([]);
  protected readonly rating = signal<ProductRating | null>(null);
  protected readonly userRating = signal(0);
  protected reviewComment = '';

  ngOnInit(): void {
    effect(async () => {
      const prod = this.product();
      if (prod) {
        const productReviews = await this.reviewsService.loadProductReviews(prod.id);
        this.reviews.set(productReviews);
        const productRating = this.reviewsService.calculateRating(productReviews);
        this.rating.set(productRating);
      }
    });

    this.reviewsService.setUserId(this.authService.userId() || '');
  }

  protected toggleReviewForm(): void {
    this.showReviewForm.update((v) => !v);
    if (!this.showReviewForm()) {
      this.userRating.set(0);
      this.reviewComment = '';
    }
  }

  protected async submitReview(): Promise<void> {
    if (!this.isReviewValid()) return;

    const prod = this.product();
    const userName = this.authService.customerProfile()?.displayName || 'Anonymous';
    
    const success = await this.reviewsService.addReview(
      prod.id,
      this.userRating(),
      this.reviewComment,
      userName
    );

    if (success) {
      const productReviews = await this.reviewsService.loadProductReviews(prod.id);
      this.reviews.set(productReviews);
      this.rating.set(this.reviewsService.calculateRating(productReviews));
      this.userRating.set(0);
      this.reviewComment = '';
      this.showReviewForm.set(false);
      this.reviewsChanged.emit();
    }
  }

  protected async deleteReview(reviewId: string): Promise<void> {
    if (confirm('Are you sure you want to delete this review?')) {
      await this.reviewsService.deleteReview(reviewId);
      const prod = this.product();
      const productReviews = await this.reviewsService.loadProductReviews(prod.id);
      this.reviews.set(productReviews);
      this.rating.set(this.reviewsService.calculateRating(productReviews));
      this.reviewsChanged.emit();
    }
  }

  protected editReview(review: ProductReview): void {
    this.userRating.set(review.rating);
    this.reviewComment = review.comment;
    this.showReviewForm.set(true);
  }

  protected isReviewValid(): boolean {
    return this.userRating() > 0 && this.reviewComment.trim().length > 0;
  }

  protected isOwnReview(review: ProductReview): boolean {
    return review.userId === this.authService.userId();
  }

  protected getStarPercentage(rating: number): number {
    return this.reviewsService.getStarPercentage(rating, this.reviews());
  }

  protected getStarCount(starRating: number): number {
    const rate = this.rating();
    if (!rate || !rate.ratingDistribution) return 0;
    return rate.ratingDistribution[starRating] || 0;
  }

  protected renderStars(rating: number): string {
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 > 0;
    let stars = '★'.repeat(fullStars);
    if (hasHalf) stars += '½';
    stars += '☆'.repeat(5 - Math.ceil(rating));
    return stars;
  }

  protected formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

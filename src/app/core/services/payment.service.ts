import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface PaymentDetails {
  method: 'upi' | 'card' | 'netbanking' | 'cod';
  upiId?: string;
  cardNumber?: string;
  cardholderName?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  bankName?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId: string;
  message: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly processingPayment = signal(false);
  private readonly paymentError = signal('');
  private readonly paymentSuccess = signal('');

  readonly isProcessing = this.processingPayment.asReadonly();
  readonly error = this.paymentError.asReadonly();
  readonly success = this.paymentSuccess.asReadonly();

  async processPayment(amount: number, details: PaymentDetails, orderId: string): Promise<PaymentResponse> {
    if (this.processingPayment()) return { success: false, transactionId: '', message: 'Payment already processing', timestamp: Date.now() };

    this.processingPayment.set(true);
    this.paymentError.set('');
    this.paymentSuccess.set('');

    try {
      if (!Number.isFinite(amount) || amount <= 0 || !orderId) {
        throw new Error('Invalid order amount or ID.');
      }
      if (details.method !== 'cod') {
        throw new Error('Online payments are unavailable. Please choose cash on delivery.');
      }
      if (!environment.enableCashOnDelivery) {
        throw new Error('Cash on delivery is unavailable.');
      }
      const response: PaymentResponse = {
        success: true,
        transactionId: '',
        message: 'Payment is due on delivery.',
        timestamp: Date.now()
      };

      this.paymentSuccess.set(response.message);
      return response;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Payment processing failed. Please try again.';
      this.paymentError.set(errorMessage);
      return {
        success: false,
        transactionId: '',
        message: errorMessage,
        timestamp: Date.now()
      };
    } finally {
      this.processingPayment.set(false);
    }
  }

  clearMessages(): void {
    this.paymentError.set('');
    this.paymentSuccess.set('');
  }
}

import { Injectable, signal } from '@angular/core';

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
      // Simulate payment processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Validate payment details
      if (!this.validatePaymentDetails(details)) {
        throw new Error('Invalid payment details');
      }

      // Generate transaction ID
      const transactionId = this.generateTransactionId();

      // Simulate payment gateway call (replace with actual gateway)
      const isSuccessful = Math.random() > 0.05; // 95% success rate for demo

      if (!isSuccessful) {
        throw new Error('Payment declined by payment gateway. Please try again.');
      }

      const response: PaymentResponse = {
        success: true,
        transactionId,
        message: `Payment of ₹${amount} processed successfully via ${details.method.toUpperCase()}`,
        timestamp: Date.now()
      };

      this.paymentSuccess.set(`Payment successful! Transaction ID: ${transactionId}`);
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

  private validatePaymentDetails(details: PaymentDetails): boolean {
    switch (details.method) {
      case 'upi':
        return !!details.upiId && details.upiId.includes('@');
      case 'card':
        return !!(details.cardNumber && details.cardholderName && details.expiryMonth && details.expiryYear && details.cvv);
      case 'netbanking':
        return !!details.bankName;
      case 'cod':
        return true;
      default:
        return false;
    }
  }

  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `TXN${timestamp}${random}`;
  }

  clearMessages(): void {
    this.paymentError.set('');
    this.paymentSuccess.set('');
  }
}

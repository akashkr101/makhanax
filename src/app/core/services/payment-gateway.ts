import { environment } from '../../../environments/environment';

export type GatewayProvider = 'razorpay' | 'cashfree' | 'stripe' | 'mock';

export interface GatewayOrderRequest {
  amount: number;
  currency: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  notes?: Record<string, string>;
}

export interface GatewayOrderResponse {
  success: boolean;
  orderId: string;
  paymentGatewayOrderId?: string;
  amount: number;
  currency: string;
  message: string;
  gateway: GatewayProvider;
}

export interface PaymentVerificationPayload {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
}

export class PaymentGateway {
  static provider(): GatewayProvider {
    return environment.paymentProvider || 'mock';
  }

  static async createOrder(request: GatewayOrderRequest): Promise<GatewayOrderResponse> {
    const provider = this.provider();

    return {
      success: false,
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
      message: 'Online payments require a configured server-side gateway.',
      gateway: provider
    };
  }

  static verifyPayment(_payload: PaymentVerificationPayload): boolean {
    return false;
  }
}

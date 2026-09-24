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

    if (provider === 'mock') {
      return {
        success: true,
        orderId: request.orderId,
        paymentGatewayOrderId: `MOCK_${request.orderId}`,
        amount: request.amount,
        currency: request.currency,
        message: 'Mock gateway accepted the order.',
        gateway: 'mock'
      };
    }

    // Real gateways typically return an order ID here. This app keeps the contract ready for integration.
    return {
      success: true,
      orderId: request.orderId,
      paymentGatewayOrderId: `gateway_${request.orderId}`,
      amount: request.amount,
      currency: request.currency,
      message: `${provider.toUpperCase()} order created successfully.`,
      gateway: provider
    };
  }

  static verifyPayment(payload: PaymentVerificationPayload): boolean {
    const provider = this.provider();

    if (provider === 'mock') {
      return !!payload.orderId || !!payload.razorpay_payment_id;
    }

    if (provider === 'razorpay') {
      return !!payload.razorpay_order_id && !!payload.razorpay_payment_id && !!payload.razorpay_signature;
    }

    return !!payload.orderId;
  }
}

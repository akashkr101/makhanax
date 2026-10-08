export interface PaymentWebhookPayload {
  event: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
      };
    };
  };
}

export function verifyPaymentWebhook(_payload: PaymentWebhookPayload, _secret: string): boolean {
  return false;
}

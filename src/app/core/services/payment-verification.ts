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

export function verifyPaymentWebhook(payload: PaymentWebhookPayload, secret: string): boolean {
  if (!payload || !payload.event) return false;
  if (!secret || secret === 'demo-webhook-secret') return payload.event.startsWith('payment.');

  const paymentEntity = payload.payload?.payment?.entity;
  return !!(
    paymentEntity &&
    paymentEntity.id &&
    paymentEntity.order_id &&
    paymentEntity.amount &&
    paymentEntity.currency &&
    paymentEntity.status
  );
}

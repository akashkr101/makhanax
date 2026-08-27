import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import nodemailer from 'nodemailer';

initializeApp();

const smtpHost = defineString('SMTP_HOST');
const smtpPort = defineString('SMTP_PORT', { default: '587' });
const smtpUser = defineString('SMTP_USER');
const smtpFrom = defineString('SMTP_FROM');
const smtpPassword = defineSecret('SMTP_PASSWORD');

interface OrderLineItem {
  name: string;
  size: string;
  quantity: number;
  price: number;
}

interface OrderRecord {
  customerName?: string;
  customerEmail?: string;
  paymentMethod?: string;
  total?: number;
  status?: string;
  confirmationEmailSent?: boolean;
  items?: OrderLineItem[];
}

export const sendOrderConfirmationEmail = onDocumentUpdated({
  document: 'orders/{orderId}',
  region: 'asia-south1',
  cpu: 'gcf_gen1',
  secrets: [smtpPassword]
}, async (event) => {
  const before = event.data?.before.data() as OrderRecord | undefined;
  const after = event.data?.after.data() as OrderRecord | undefined;
  const orderId = event.params.orderId;

  if (!after || after.status !== 'Confirmed') return;
  if (before?.status === 'Confirmed' || after.confirmationEmailSent) return;
  if (!after.customerEmail) {
    logger.warn('Confirmed order has no customer email.', { orderId });
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost.value(),
    port: Number(smtpPort.value()),
    secure: Number(smtpPort.value()) === 465,
    auth: {
      user: smtpUser.value(),
      pass: smtpPassword.value()
    }
  });

  await transporter.sendMail({
    from: smtpFrom.value(),
    to: after.customerEmail,
    subject: `MakhanaX order confirmed #${orderId.slice(-6)}`,
    text: buildTextEmail(orderId, after),
    html: buildHtmlEmail(orderId, after)
  });

  await getFirestore().doc(`orders/${orderId}`).set({
    confirmationEmailSent: true,
    confirmationEmailSentAt: new Date().toISOString()
  }, { merge: true });

  logger.info('Order confirmation email sent.', { orderId, to: after.customerEmail });
});

function buildTextEmail(orderId: string, order: OrderRecord): string {
  const itemLines = (order.items ?? []).map((item) => `${item.quantity} x ${item.name} (${item.size}) - ${formatPrice(item.price * item.quantity)}`);
  return [
    `Hi ${order.customerName || 'Customer'},`,
    '',
    'Your MakhanaX order has been confirmed.',
    '',
    ...itemLines,
    '',
    `Total: ${formatPrice(order.total ?? 0)}`,
    `Payment method: ${(order.paymentMethod ?? '').toUpperCase()}`,
    `Order ID: ${orderId}`,
    '',
    'We will update you when your order is shipped.',
    '',
    'MakhanaX'
  ].join('\n');
}

function buildHtmlEmail(orderId: string, order: OrderRecord): string {
  const rows = (order.items ?? []).map((item) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">${escapeHtml(item.name)}<br><small style="color:#666;">${escapeHtml(item.size)}</small></td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatPrice(item.price * item.quantity)}</td>
    </tr>`).join('');
  return `
    <div style="font-family:Arial,sans-serif;color:#1b1c17;line-height:1.5;max-width:620px;margin:0 auto;padding:24px;">
      <h1 style="margin:0 0 10px;font-size:28px;">Your MakhanaX order is confirmed.</h1>
      <p style="margin:0 0 20px;color:#555;">Hi ${escapeHtml(order.customerName || 'Customer')}, your order ID is <strong>#${escapeHtml(orderId.slice(-6))}</strong>.</p>
      <table style="border-collapse:collapse;width:100%;margin:20px 0;">
        <thead><tr><th style="text-align:left;padding-bottom:8px;">Item</th><th style="padding-bottom:8px;">Qty</th><th style="text-align:right;padding-bottom:8px;">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:18px;margin:18px 0;"><strong>Total: ${formatPrice(order.total ?? 0)}</strong></p>
      <p style="margin:0;color:#555;">Payment method: ${escapeHtml((order.paymentMethod ?? '').toUpperCase())}</p>
      <p style="margin:24px 0 0;color:#555;">We will update you when your order is shipped.</p>
    </div>`;
}

function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN')}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] ?? character));
}

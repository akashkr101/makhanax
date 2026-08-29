import { Injectable, inject, signal } from '@angular/core';
import emailjs from '@emailjs/browser';
import { APP_CONFIG } from '../config/app-config';
import { OrderRecord, OrderStatus } from './order-history.service';

export interface EmailTemplate {
  subject: string;
  templateId: string;
  variables: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class OrderEmailService {
  private readonly config = inject(APP_CONFIG);
  private readonly sendingEmail = signal(false);
  private readonly emailError = signal('');

  readonly isSending = this.sendingEmail.asReadonly();
  readonly error = this.emailError.asReadonly();

  async sendOrderConfirmation(order: OrderRecord): Promise<boolean> {
    return this.sendEmail(order.customerEmail, order.customerName, 'order_confirmation', {
      to_email: order.customerEmail,
      to_name: order.customerName || 'Customer',
      order_id: order.id,
      order_total: this.formatPrice(order.total),
      order_date: new Date(order.placedAt).toLocaleDateString('en-IN'),
      payment_method: order.paymentMethod.toUpperCase(),
      order_items: order.items
        .map((item) => `${item.quantity} x ${item.name} (${item.size}) - ${this.formatPrice(item.price * item.quantity)}`)
        .join('\n')
    });
  }

  async sendOrderStatusUpdate(order: OrderRecord): Promise<boolean> {
    const statusMessages = {
      New: 'Your order has been received and is being processed.',
      Confirmed: 'Your order has been confirmed and will be shipped soon.',
      Shipped: 'Your order has been shipped and is on its way.',
      Delivered: 'Your order has been delivered. Thank you for shopping with us!',
      Cancelled: 'Your order has been cancelled. Please contact us for more details.'
    };

    return this.sendEmail(order.customerEmail, order.customerName, 'order_status_update', {
      to_email: order.customerEmail,
      to_name: order.customerName || 'Customer',
      order_id: order.id,
      status: order.status,
      status_message: statusMessages[order.status],
      order_total: this.formatPrice(order.total)
    });
  }

  async sendOrderReceipt(order: OrderRecord): Promise<boolean> {
    const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = order.total - subtotal;

    return this.sendEmail(order.customerEmail, order.customerName, 'order_receipt', {
      to_email: order.customerEmail,
      to_name: order.customerName || 'Customer',
      order_id: order.id,
      order_date: new Date(order.placedAt).toLocaleDateString('en-IN'),
      order_items: order.items
        .map((item) => `${item.quantity} x ${item.name} (${item.size}) - ${this.formatPrice(item.price * item.quantity)}`)
        .join('\n'),
      subtotal: this.formatPrice(subtotal),
      tax: this.formatPrice(tax),
      total: this.formatPrice(order.total),
      payment_method: order.paymentMethod.toUpperCase(),
      delivery_address: 'Saved address on file'
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    return this.sendEmail(email, name, 'welcome', {
      to_email: email,
      to_name: name,
      welcome_message: `Welcome to MakhanaX, ${name}! Start exploring our delicious snacks.`
    });
  }

  async sendPromotionalEmail(email: string, name: string, promoTitle: string, promoCode: string, discount: number): Promise<boolean> {
    return this.sendEmail(email, name, 'promotion', {
      to_email: email,
      to_name: name,
      promo_title: promoTitle,
      promo_code: promoCode,
      discount_percent: discount
    });
  }

  private async sendEmail(email: string, name: string, templateType: string, variables: Record<string, string | number>): Promise<boolean> {
    const emailConfig = this.config.emailjs;

    if (!emailConfig || emailConfig.serviceId.startsWith('YOUR_')) {
      const msg = 'EmailJS is not configured. Add serviceId, templateId, and publicKey in environment.ts.';
      this.emailError.set(msg);
      console.warn(msg);
      return false;
    }

    if (!email) {
      const msg = 'Email address is required.';
      this.emailError.set(msg);
      console.warn(msg);
      return false;
    }

    this.sendingEmail.set(true);
    this.emailError.set('');

    try {
      await emailjs.send(emailConfig.serviceId.trim(), emailConfig.templateId.trim(), variables, {
        publicKey: emailConfig.publicKey.trim()
      });

      console.log(`📧 Email sent to ${email} (${templateType})`);
      return true;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to send email';
      this.emailError.set(errorMsg);
      console.error('Sending email failed:', error);
      return false;
    } finally {
      this.sendingEmail.set(false);
    }
  }

  private formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }
}


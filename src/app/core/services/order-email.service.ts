import { Injectable, inject } from '@angular/core';
import emailjs from '@emailjs/browser';
import { APP_CONFIG } from '../config/app-config';
import { OrderRecord } from './order-history.service';

@Injectable({ providedIn: 'root' })
export class OrderEmailService {
  private readonly config = inject(APP_CONFIG);

  async sendOrderConfirmation(order: OrderRecord): Promise<void> {
    const emailConfig = this.config.emailjs;
    if (!emailConfig || emailConfig.serviceId.startsWith('YOUR_')) {
      throw new Error('EmailJS is not configured. Add serviceId, templateId, and publicKey in environment.ts.');
    }
    if (!order.customerEmail) {
      throw new Error('This order does not have a customer email address.');
    }

    await emailjs.send(emailConfig.serviceId.trim(), emailConfig.templateId.trim(), {
      to_email: order.customerEmail,
      to_name: order.customerName || 'Customer',
      order_id: order.id,
      order_total: this.formatPrice(order.total),
      payment_method: order.paymentMethod.toUpperCase(),
      order_items: order.items.map((item) => `${item.quantity} x ${item.name} (${item.size}) - ${this.formatPrice(item.price * item.quantity)}`).join('\n')
    }, {
      publicKey: emailConfig.publicKey.trim()
    });
  }

  private formatPrice(price: number): string {
    return `₹${price.toLocaleString('en-IN')}`;
  }
}

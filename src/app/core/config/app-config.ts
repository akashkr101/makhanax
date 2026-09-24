import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  paymentProvider: 'razorpay' | 'cashfree' | 'stripe' | 'mock';
  razorpay?: {
    keyId?: string;
    merchantId?: string;
    webhookSecret?: string;
  };
  otpProvider: 'firebase' | 'twilio' | 'msg91' | 'mock';
  enableCashOnDelivery: boolean;
  demoMode?: boolean;
  adminEmails?: string[];
  emailjs?: {
    serviceId: string;
    templateId: string;
    publicKey: string;
  };
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

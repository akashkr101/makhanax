import { InjectionToken } from '@angular/core';

export interface AppConfig {
  apiBaseUrl: string;
  paymentProvider: 'razorpay' | 'cashfree' | 'stripe' | 'mock';
  otpProvider: 'firebase' | 'twilio' | 'msg91' | 'mock';
  enableCashOnDelivery: boolean;
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

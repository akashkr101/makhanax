import { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  apiBaseUrl: 'https://api.example.com',
  paymentProvider: 'razorpay',
  razorpay: {
    keyId: 'rzp_test_demo_key',
    merchantId: 'MakhanaX Demo Merchant',
    webhookSecret: 'demo-webhook-secret'
  },
  otpProvider: 'firebase',
  enableCashOnDelivery: true,
  demoMode: false,
  adminEmails: ['akrocks63@gmail.com'],
  emailjs: {
    serviceId: 'service_eem8q09',
    templateId: 'template_pfd7b68',
    publicKey: 'qMTc464mSllCY1IHS'
  },
  firebase: {
    apiKey: 'AIzaSyDW915e8VVqboF1_-R0CAm1KIUBR9mjvbE',
    authDomain: 'makhanax-test.firebaseapp.com',
    projectId: 'makhanax-test',
    storageBucket: 'makhanax-test.firebasestorage.app',
    messagingSenderId: '102237410008',
    appId: '1:102237410008:web:116b1026bfbccbb2513dad'
  }
};
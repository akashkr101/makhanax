import { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  apiBaseUrl: 'https://api.example.com',
  paymentProvider: 'mock',
  otpProvider: 'firebase',
  enableCashOnDelivery: true,
  emailjs: {
    serviceId: 'service_eem8q09',
    templateId: 'template_pfd7b68',
    publicKey: 'qMTc464mSllCY1IHS'
  },
  firebase: {
    apiKey: 'AIzaSyAex6h7NZ4w4o10vlKWcRJldn0s0RWxhSI',
    authDomain: 'makhanax-prod.firebaseapp.com',
    projectId: 'makhanax-prod',
    storageBucket: 'makhanax-prod.firebasestorage.app',
    messagingSenderId: '293061390678',
    appId: '1:293061390678:web:458453c7327c71649ee6f7'
  }
};
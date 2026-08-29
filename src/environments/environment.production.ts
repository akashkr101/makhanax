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
    apiKey: 'AIzaSyAyuTSYPKqLvVT51YooWv2MlA_SwHFmT80',
    authDomain: 'makhanax-prod-2026.firebaseapp.com',
    projectId: 'makhanax-prod-2026',
    storageBucket: 'makhanax-prod-2026.firebasestorage.app',
    messagingSenderId: '699539522319',
    appId: '1:699539522319:web:952e0e393dd2a7de40747a'
  }
};
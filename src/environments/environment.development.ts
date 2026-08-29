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
    apiKey: 'AIzaSyAXyLw6e_OUES_hzNcI4eR1YhH1BNkdBuQ',
    authDomain: 'makhanax-dev-2026.firebaseapp.com',
    projectId: 'makhanax-dev-2026',
    storageBucket: 'makhanax-dev-2026.firebasestorage.app',
    messagingSenderId: '392447557831',
    appId: '1:392447557831:web:99d543e0123542817cbee2'
  }
};
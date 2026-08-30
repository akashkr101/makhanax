import { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  apiBaseUrl: 'https://api.example.com',
  paymentProvider: 'mock',
  otpProvider: 'firebase',
  enableCashOnDelivery: true,
  adminEmails: ['akrocks63@gmail.com'],
  emailjs: {
    serviceId: 'service_eem8q09',
    templateId: 'template_pfd7b68',
    publicKey: 'qMTc464mSllCY1IHS'
  },
  firebase: {
    apiKey: 'AIzaSyAQlPLhrSezJAOGTzmBL0jOulvgivYu5m0',
    authDomain: 'makhanax-dev.firebaseapp.com',
    projectId: 'makhanax-dev',
    storageBucket: 'makhanax-dev.firebasestorage.app',
    messagingSenderId: '126320697715',
    appId: '1:126320697715:web:39fa8836880ea46f252506'
  }
};

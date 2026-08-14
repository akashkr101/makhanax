import { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  apiBaseUrl: 'https://api.example.com',
  paymentProvider: 'mock',
  otpProvider: 'firebase',
  enableCashOnDelivery: true,
  firebase: {
    apiKey: 'AIzaSyDL6__w3h0YX86f1qaSeNQxlHwNYTcZ6Q0',
    authDomain: 'makhanax-001.firebaseapp.com',
    projectId: 'makhanax-001',
    storageBucket: 'makhanax-001.firebasestorage.app',
    messagingSenderId: '388424428971',
    appId: '1:388424428971:web:675717ee505ff5496f76ee',
    measurementId: 'G-5PLV1XKXLE'
  }
};

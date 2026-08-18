import { AppConfig } from '../app/core/config/app-config';

export const environment: AppConfig = {
  apiBaseUrl: 'https://api.example.com',
  paymentProvider: 'mock',
  otpProvider: 'firebase',
  enableCashOnDelivery: true,
  firebase: {
    apiKey: 'AIzaSyBAhvhO4V2D5ej5YuF2SFLSgYHSUD-3240',
    authDomain: 'makhanax-01.firebaseapp.com',
    projectId: 'makhanax-01',
    storageBucket: 'makhanax-01.firebasestorage.app',
    messagingSenderId: '647187637605',
    appId: '1:647187637605:web:792bb28e8ba0f3fc56ad8c',
    measurementId: 'G-GWCMFVHXN3'
  }
};

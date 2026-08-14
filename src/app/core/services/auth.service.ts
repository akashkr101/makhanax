import { Injectable, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, ConfirmationResult, RecaptchaVerifier, getAuth, signInWithPhoneNumber } from 'firebase/auth';
import { environment } from '../../../environments/environment';

export type OtpStep = 'phone' | 'verification' | 'verified';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly step = signal<OtpStep>('phone');
  readonly phoneNumber = signal('');
  readonly loginOpen = signal(false);
  readonly error = signal('');
  readonly loading = signal(false);

  private readonly firebaseApp: FirebaseApp = initializeApp(environment.firebase);
  private readonly auth: Auth = getAuth(this.firebaseApp);
  private confirmationResult?: ConfirmationResult;
  private recaptchaVerifier?: RecaptchaVerifier;

  openLogin(): void {
    this.loginOpen.set(true);
    this.resetFlow();
  }

  closeLogin(): void {
    this.loginOpen.set(false);
    this.destroyRecaptcha();
  }

  async requestOtp(countryCode: string, phoneNumber: string): Promise<boolean> {
    const formattedPhoneNumber = this.normalizePhoneNumber(countryCode, phoneNumber);
    if (!formattedPhoneNumber) {
      this.error.set('Enter a valid mobile number. Example: +91 98765 43210 or 9876543210.');
      return false;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      this.phoneNumber.set(formattedPhoneNumber);
      this.recaptchaVerifier ??= new RecaptchaVerifier(this.auth, 'recaptcha-container', { size: 'invisible' });
      this.confirmationResult = await signInWithPhoneNumber(this.auth, formattedPhoneNumber, this.recaptchaVerifier);
      this.step.set('verification');
      return true;
    } catch (error: unknown) {
      this.error.set(this.getRequestError(error));
      console.error('Firebase OTP request failed:', error);
      this.destroyRecaptcha();
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async verifyOtp(code: string): Promise<boolean> {
    if (!this.confirmationResult) {
      this.error.set('Request a new OTP before verifying.');
      return false;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      await this.confirmationResult.confirm(code);
      this.step.set('verified');
      return true;
    } catch (error: unknown) {
      this.error.set(this.getVerificationError(error));
      console.error('Firebase OTP verification failed:', error);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  resetFlow(): void {
    this.step.set('phone');
    this.error.set('');
    this.confirmationResult = undefined;
    this.destroyRecaptcha();
  }

  private destroyRecaptcha(): void {
    this.recaptchaVerifier?.clear();
    this.recaptchaVerifier = undefined;
  }

  private normalizePhoneNumber(countryCode: string, phoneNumber: string): string | null {
    const code = countryCode.replace(/\D/g, '');
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    if (code.length < 1 || digitsOnly.length < 6 || digitsOnly.length > 12) return null;
    return `+${code}${digitsOnly}`;
  }

  private getRequestError(error: unknown): string {
    const code = this.getFirebaseErrorCode(error);
    switch (code) {
      case 'auth/operation-not-allowed': return 'Phone sign-in is not enabled in Firebase Console.';
      case 'auth/unauthorized-domain': return 'This website domain is not authorized in Firebase Authentication settings.';
      case 'auth/invalid-app-credential': return 'Firebase reCAPTCHA verification failed. Refresh the page and try again.';
      case 'auth/too-many-requests': return 'Too many OTP requests. Please wait and try again later.';
      case 'auth/quota-exceeded': return 'Firebase SMS quota has been exceeded for this project.';
      case 'auth/invalid-phone-number': return 'Firebase rejected this phone number. Use a valid number such as +91 98765 43210.';
      default: return 'We could not send the OTP. Check Firebase Phone Auth settings and try again.';
    }
  }

  private getVerificationError(error: unknown): string {
    const code = this.getFirebaseErrorCode(error);
    if (code === 'auth/invalid-verification-code') return 'That OTP is incorrect. Check the SMS and try again.';
    if (code === 'auth/code-expired') return 'That OTP has expired. Request a new code.';
    return 'OTP verification failed. Request a new code and try again.';
  }

  private getFirebaseErrorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  }
}

import { Injectable, inject, signal } from '@angular/core';
import { FirebaseApp, initializeApp } from 'firebase/app';
import { Auth, ConfirmationResult, RecaptchaVerifier, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, sendEmailVerification, signInWithEmailAndPassword, signInWithPhoneNumber, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, getFirestore, increment, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { WishlistService } from './wishlist.service';
import { NotificationService } from './notification.service';

export type AuthStep = 'phone' | 'verification' | 'email' | 'verified';
export type EmailAuthMode = 'signIn' | 'register';
export type UserRole = 'ADMIN' | 'CUSTOMER';
export interface CustomerProfile {
  displayName: string;
  email: string;
  phoneNumber: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly wishlistService = inject(WishlistService);
  private readonly notificationService = inject(NotificationService);
  
  readonly step = signal<AuthStep>('phone');
  readonly phoneNumber = signal('');
  readonly loginOpen = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly loading = signal(false);
  readonly emailMode = signal<EmailAuthMode>('signIn');
  readonly isAuthenticated = signal(false);
  readonly userId = signal('');
  readonly customerProfile = signal<CustomerProfile | null>(null);
  readonly role = signal<UserRole | null>(null);
  readonly roleLoading = signal(false);

  private readonly firebaseApp: FirebaseApp = initializeApp(environment.firebase);
  private readonly auth: Auth = getAuth(this.firebaseApp);
  private readonly firestore = getFirestore(this.firebaseApp);
  private confirmationResult?: ConfirmationResult;
  private recaptchaVerifier?: RecaptchaVerifier;
  private roleResolution: Promise<void> = Promise.resolve();
  private authReadyResolved = false;
  private authReadyResolve: () => void = () => undefined;
  private readonly authReady = new Promise<void>((resolve) => {
    this.authReadyResolve = resolve;
  });

  constructor() {
    onAuthStateChanged(this.auth, (user) => {
      this.isAuthenticated.set(user !== null);
      this.userId.set(user?.uid ?? '');
      this.customerProfile.set(user ? {
        displayName: user.displayName ?? '',
        email: user.email ?? '',
        phoneNumber: user.phoneNumber ?? ''
      } : null);
      if (user) {
        this.step.set('verified');
        this.roleLoading.set(true);
        this.wishlistService.setUserId(user.uid);
        this.notificationService.setUserId(user.uid);
        this.roleResolution = this.syncCustomerDirectory(user.uid, user.displayName ?? '', user.email ?? '', user.phoneNumber ?? '')
          .finally(() => this.roleLoading.set(false));
      } else {
        this.role.set(null);
        this.roleLoading.set(false);
        this.roleResolution = Promise.resolve();
        this.wishlistService.setUserId('');
        this.notificationService.setUserId('');
      }
      if (!this.authReadyResolved) {
        this.authReadyResolved = true;
        this.authReadyResolve();
      }
    });
  }

  async waitForRole(): Promise<UserRole | null> {
    await this.authReady;
    await this.roleResolution;
    return this.role();
  }

  private async syncCustomerDirectory(userId: string, displayName: string, email: string, phoneNumber: string): Promise<void> {
    try {
      const customerDoc = doc(this.firestore, 'customers', userId);
      const statsDoc = doc(this.firestore, 'site-stats', 'community');
      const snapshot = await getDoc(customerDoc);
      const existingRole = snapshot.data()?.['role'] as UserRole | undefined;
      await setDoc(customerDoc, {
        displayName, email, phoneNumber,
        role: existingRole ?? 'CUSTOMER',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      if (!snapshot.exists()) {
        try {
          await setDoc(statsDoc, {
            customerCount: increment(1),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (statsError: unknown) {
          console.error('Updating customer count failed:', statsError);
        }
      }
      this.role.set(existingRole ?? 'CUSTOMER');
    } catch (error: unknown) {
      console.error('Syncing customer directory failed:', error);
      this.role.set('CUSTOMER');
    }
  }

  openLogin(): void {
    this.loginOpen.set(true);
    this.resetFlow();
  }

  closeLogin(): void {
    this.loginOpen.set(false);
    this.destroyRecaptcha();
  }

  async requestOtp(countryCode: string, phoneNumber: string): Promise<boolean> {
    if (this.loading()) return false;

    const formattedPhoneNumber = this.normalizePhoneNumber(countryCode, phoneNumber);
    if (!formattedPhoneNumber) {
      this.error.set('Enter a valid mobile number. Example: +91 98765 43210 or 9876543210.');
      return false;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
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
    this.success.set('');
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

  usePhoneLogin(): void {
    this.error.set('');
    this.success.set('');
    this.step.set('phone');
    this.destroyRecaptcha();
  }

  useEmailLogin(mode: EmailAuthMode = 'signIn'): void {
    this.error.set('');
    this.success.set('');
    this.emailMode.set(mode);
    this.step.set('email');
    this.destroyRecaptcha();
  }

  async authenticateWithEmail(email: string, password: string): Promise<boolean> {
    const normalizedEmail = email.trim().toLowerCase();
    if (!this.isValidEmail(normalizedEmail)) {
      this.error.set('Enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      this.error.set('Password must contain at least 8 characters.');
      return false;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set('');
    try {
      if (this.emailMode() === 'register') {
        const credential = await createUserWithEmailAndPassword(this.auth, normalizedEmail, password);
        await sendEmailVerification(credential.user);
        await signOut(this.auth);
        this.emailMode.set('signIn');
        this.step.set('email');
        this.success.set('Account created successfully. Please sign in to continue.');
        return false;
      } else {
        await signInWithEmailAndPassword(this.auth, normalizedEmail, password);
      }
      this.step.set('verified');
      return true;
    } catch (error: unknown) {
      this.error.set(this.getEmailError(error));
      console.error('Firebase email authentication failed:', error);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async updateCustomerProfile(displayName: string): Promise<boolean> {
    const name = displayName.trim();
    if (!name) {
      this.error.set('Enter your name before saving your profile.');
      return false;
    }
    if (!this.auth.currentUser) {
      this.error.set('Your session has ended. Please sign in again.');
      return false;
    }

    this.loading.set(true);
    this.error.set('');
    try {
      await updateProfile(this.auth.currentUser, { displayName: name });
      const existingProfile = this.customerProfile();
      this.customerProfile.set({
        displayName: name,
        email: existingProfile?.email ?? this.auth.currentUser.email ?? '',
        phoneNumber: existingProfile?.phoneNumber ?? this.auth.currentUser.phoneNumber ?? ''
      });
      return true;
    } catch (error: unknown) {
      this.error.set('We could not save your profile. Please try again.');
      console.error('Firebase profile update failed:', error);
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    this.resetFlow();
  }

  resetFlow(): void {
    this.step.set('phone');
    this.error.set('');
    this.success.set('');
    this.confirmationResult = undefined;
    this.destroyRecaptcha();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private destroyRecaptcha(): void {
    this.recaptchaVerifier?.clear();
    this.recaptchaVerifier = undefined;
    document.getElementById('recaptcha-container')?.replaceChildren();
  }

  private normalizePhoneNumber(countryCode: string, phoneNumber: string): string | null {
    const code = countryCode.replace(/\D/g, '');
    let digitsOnly = phoneNumber.replace(/\D/g, '');
    if (digitsOnly.startsWith(code)) digitsOnly = digitsOnly.slice(code.length);
    if (digitsOnly.startsWith('0')) digitsOnly = digitsOnly.slice(1);
    if (code.length < 1 || digitsOnly.length < 6 || digitsOnly.length > 12) return null;
    return `+${code}${digitsOnly}`;
  }

  private getRequestError(error: unknown): string {
    const code = this.getFirebaseErrorCode(error);
    switch (code) {
      case 'auth/operation-not-allowed': return 'Phone sign-in is unavailable for this project. Enable the Phone provider and allow your country under Firebase Console > Authentication > Settings > SMS regions.';
      case 'auth/unauthorized-domain': return 'This website domain is not authorized in Firebase Authentication settings.';
      case 'auth/invalid-app-credential': return 'Firebase reCAPTCHA verification failed. Refresh the page and try again.';
      case 'auth/captcha-check-failed': return 'Firebase could not verify this browser. Disable blockers, refresh the page, and try again.';
      case 'auth/network-request-failed': return 'The OTP request could not reach Firebase. Check your internet connection and try again.';
      case 'auth/too-many-requests': return 'Too many OTP requests. Please wait and try again later.';
      case 'auth/quota-exceeded': return 'Firebase SMS quota has been exceeded for this project.';
      case 'auth/invalid-phone-number': return 'Firebase rejected this phone number. Use a valid number such as +91 98765 43210.';
      case 'auth/missing-phone-number': return 'Enter a mobile number before requesting an OTP.';
      default: return 'We could not send the OTP. Check Firebase Phone Auth settings and try again.';
    }
  }

  private getVerificationError(error: unknown): string {
    const code = this.getFirebaseErrorCode(error);
    if (code === 'auth/invalid-verification-code') return 'That OTP is incorrect. Check the SMS and try again.';
    if (code === 'auth/code-expired') return 'That OTP has expired. Request a new code.';
    return 'OTP verification failed. Request a new code and try again.';
  }

  private getEmailError(error: unknown): string {
    switch (this.getFirebaseErrorCode(error)) {
      case 'auth/operation-not-allowed': return 'Email and password sign-in is not enabled in Firebase Console.';
      case 'auth/invalid-credential': return 'Email address or password is incorrect.';
      case 'auth/email-already-in-use': return 'An account already exists with this email. Try signing in instead.';
      case 'auth/weak-password': return 'Choose a stronger password with at least 8 characters.';
      case 'auth/too-many-requests': return 'Too many sign-in attempts. Please wait and try again.';
      default: return 'We could not complete email sign-in. Please try again.';
    }
  }

  private getFirebaseErrorCode(error: unknown): string {
    return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  }
}

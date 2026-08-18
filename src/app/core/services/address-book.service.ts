import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

export type AddressCategory = 'home' | 'office' | 'flat' | 'other';

export interface SavedAddress {
  name: string;
  phone: string;
  address: string;
}

type AddressBook = Partial<Record<AddressCategory, SavedAddress>>;

@Injectable({ providedIn: 'root' })
export class AddressBookService {
  readonly addresses = signal<AddressBook>({});
  readonly error = signal('');

  private readonly firebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly firestore = getFirestore(this.firebaseApp);

  async load(userId: string): Promise<void> {
    try {
      const snapshot = await getDoc(doc(this.firestore, 'customers', userId));
      const storedAddresses = snapshot.data()?.['addresses'];
      this.addresses.set(this.isAddressBook(storedAddresses) ? storedAddresses : {});
      this.error.set('');
    } catch (error: unknown) {
      const localAddresses = this.readLocalAddresses(userId);
      this.addresses.set(localAddresses);
      this.error.set('Cloud sync is unavailable. Showing addresses saved on this device.');
      console.error('Loading saved addresses failed:', error);
    }
  }

  async save(userId: string, category: AddressCategory, address: SavedAddress): Promise<'cloud' | 'local'> {
    const normalizedAddress = {
      name: address.name.trim(),
      phone: address.phone.trim(),
      address: address.address.trim()
    };
    try {
      await Promise.race([
        setDoc(doc(this.firestore, 'customers', userId), {
          addresses: { [category]: normalizedAddress }
        }, { merge: true }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('address-save-timeout')), 10000);
        })
      ]);
      this.error.set('');
      this.addresses.update((addresses) => ({ ...addresses, [category]: normalizedAddress }));
      this.writeLocalAddresses(userId, { ...this.addresses(), [category]: normalizedAddress });
      return 'cloud';
    } catch (error: unknown) {
      const fallbackAddresses = { ...this.readLocalAddresses(userId), [category]: normalizedAddress };
      this.writeLocalAddresses(userId, fallbackAddresses);
      this.addresses.set(fallbackAddresses);
      this.error.set('Cloud sync is unavailable. Address saved on this device for now.');
      console.error('Saving address to cloud failed, saved locally instead:', error);
      return 'local';
    }
  }

  clear(): void {
    this.addresses.set({});
    this.error.set('');
  }

  private isAddressBook(value: unknown): value is AddressBook {
    return typeof value === 'object' && value !== null;
  }

  private localStorageKey(userId: string): string {
    return `makhanax-addresses-${userId}`;
  }

  private readLocalAddresses(userId: string): AddressBook {
    try {
      const raw = localStorage.getItem(this.localStorageKey(userId));
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return this.isAddressBook(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeLocalAddresses(userId: string, addresses: AddressBook): void {
    try {
      localStorage.setItem(this.localStorageKey(userId), JSON.stringify(addresses));
    } catch (error: unknown) {
      console.error('Saving addresses to local storage failed:', error);
    }
  }
}

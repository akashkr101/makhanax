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
    } catch (error: unknown) {
      this.error.set('Saved addresses are unavailable right now.');
      console.error('Loading saved addresses failed:', error);
    }
  }

  async save(userId: string, category: AddressCategory, address: SavedAddress): Promise<void> {
    const normalizedAddress = {
      name: address.name.trim(),
      phone: address.phone.trim(),
      address: address.address.trim()
    };
    await setDoc(doc(this.firestore, 'customers', userId), {
      addresses: { [category]: normalizedAddress }
    }, { merge: true });
    this.addresses.update((addresses) => ({ ...addresses, [category]: normalizedAddress }));
  }

  clear(): void {
    this.addresses.set({});
    this.error.set('');
  }

  private isAddressBook(value: unknown): value is AddressBook {
    return typeof value === 'object' && value !== null;
  }
}

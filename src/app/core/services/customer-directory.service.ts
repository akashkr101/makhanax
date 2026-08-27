import { Injectable, signal } from '@angular/core';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { collection, doc, getDocs, getFirestore, onSnapshot } from 'firebase/firestore';
import { environment } from '../../../environments/environment';
import { UserRole } from './auth.service';

export interface CustomerRecord {
  id: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
}

@Injectable({ providedIn: 'root' })
export class CustomerDirectoryService {
  readonly customers = signal<CustomerRecord[]>([]);
  readonly totalCustomers = signal(6034);
  readonly error = signal('');

  private readonly firebaseApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  private readonly firestore = getFirestore(this.firebaseApp);
  private unsubscribeTotalCustomers?: () => void;

  watchTotalCustomers(): void {
    if (this.unsubscribeTotalCustomers) return;
    this.unsubscribeTotalCustomers = onSnapshot(doc(this.firestore, 'site-stats', 'community'), (snapshot) => {
      const count = snapshot.data()?.['customerCount'];
      if (typeof count === 'number' && count >= 0) this.totalCustomers.set(count);
    }, (error) => {
      console.error('Loading customer count failed:', error);
    });
  }

  async loadAll(): Promise<void> {
    try {
      const snapshot = await getDocs(collection(this.firestore, 'customers'));
      this.customers.set(snapshot.docs.map((customerDoc) => {
        const data = customerDoc.data();
        return {
          id: customerDoc.id,
          displayName: data['displayName'] ?? '',
          email: data['email'] ?? '',
          phoneNumber: data['phoneNumber'] ?? '',
          role: (data['role'] ?? 'CUSTOMER') as UserRole
        };
      }));
      this.error.set('');
    } catch (error: unknown) {
      this.error.set('Could not load customers. Check Firestore setup and rules.');
      console.error('Loading customer directory failed:', error);
    }
  }
}

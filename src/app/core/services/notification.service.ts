import { Injectable, signal } from '@angular/core';
import { getApp, getApps } from 'firebase/app';
import { collection, doc, getFirestore, setDoc, query, where, getDocs } from 'firebase/firestore';

export type NotificationType = 'order_placed' | 'order_confirmed' | 'order_shipped' | 'order_delivered' | 'payment_received';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  read: boolean;
  createdAt: number;
  sentVia: 'sms' | 'email' | 'in-app';
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notifications = signal<Notification[]>([]);
  private readonly firebaseApp = getApps().length ? getApp() : undefined;
  private readonly firestore = this.firebaseApp ? getFirestore(this.firebaseApp) : null;
  private currentUserId = '';

  readonly allNotifications = this.notifications.asReadonly();
  readonly unreadCount = signal(0);

  setUserId(userId: string): void {
    this.currentUserId = userId;
    if (userId) {
      void this.loadNotifications(userId);
    } else {
      this.notifications.set([]);
    }
  }

  private async loadNotifications(userId: string): Promise<void> {
    try {
      if (!this.firestore) return;

      const notificationsRef = collection(this.firestore, 'notifications');
      const q = query(notificationsRef, where('userId', '==', userId));
      const snapshot = await getDocs(q);

      const userNotifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Notification));

      this.notifications.set(userNotifications.sort((a, b) => b.createdAt - a.createdAt));
      this.updateUnreadCount();
    } catch (error) {
      console.error('Loading notifications failed:', error);
    }
  }

  async sendNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    channel: 'sms' | 'email' | 'in-app' = 'in-app',
    orderId?: string
  ): Promise<boolean> {
    try {
      if (!this.firestore) return false;

      const notificationId = `notif-${userId}-${Date.now()}`;
      const notificationRef = doc(this.firestore, 'notifications', notificationId);

      const notification: Omit<Notification, 'id'> = {
        userId,
        type,
        title,
        message,
        orderId,
        read: false,
        createdAt: Date.now(),
        sentVia: channel
      };

      await setDoc(notificationRef, notification);

      // Simulate sending via SMS/Email (in production, use actual service)
      if (channel === 'sms') {
        console.log(`📱 SMS sent to user ${userId}: ${message}`);
      } else if (channel === 'email') {
        console.log(`📧 Email sent to user ${userId}: ${title}`);
      }

      // Add to local state if current user
      if (userId === this.currentUserId) {
        this.notifications.update((notifs) => [
          { ...notification, id: notificationId },
          ...notifs
        ]);
        this.updateUnreadCount();
      }

      return true;
    } catch (error) {
      console.error('Sending notification failed:', error);
      return false;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      if (!this.firestore) return;

      const notificationRef = doc(this.firestore, 'notifications', notificationId);
      await setDoc(notificationRef, { read: true }, { merge: true });

      this.notifications.update((notifs) =>
        notifs.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
      this.updateUnreadCount();
    } catch (error) {
      console.error('Marking notification as read failed:', error);
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      if (!this.firestore) return;

      for (const notif of this.notifications()) {
        if (!notif.read) {
          await this.markAsRead(notif.id);
        }
      }
    } catch (error) {
      console.error('Marking all as read failed:', error);
    }
  }

  private updateUnreadCount(): void {
    const count = this.notifications().filter((n) => !n.read).length;
    this.unreadCount.set(count);
  }
}

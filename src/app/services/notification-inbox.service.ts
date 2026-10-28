import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, get, onValue, push, ref, serverTimestamp, set, Unsubscribe, update } from '@angular/fire/database';

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);
const allowedRoutes = new Set(['/dashboard/my-orders', '/dashboard/my-tickets', '/delivery-portal', '/teacher/referrals', '/admin/order-details']);

export type NotificationType = 'quotation' | 'payment' | 'refund' | 'delivery' | 'support' | 'commission' | 'system';
export interface UserNotification {
  recipientUid: string;
  type: NotificationType;
  title: string;
  message: string;
  route: string;
  actorUid: string;
  actorEmail: string;
  actorRole: 'Admin';
  createdAt: number;
  isRead: boolean;
  readAt?: number;
  readBy?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationInboxService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);

  watchOwn(uid: string, next: (items: Array<UserNotification & { id: string }>) => void): Unsubscribe {
    return onValue(ref(this.db, `notifications/${uid}`), snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value)
        .map(id => ({ ...value[id], id }))
        .sort((a, b) => b.createdAt - a.createdAt));
    });
  }

  async notifyUser(recipientUid: string, type: NotificationType, title: string, message: string, route: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase())) throw new Error('Only an authorized administrator can send an in-app notification.');
    const normalizedTitle = title.trim().slice(0, 120);
    const normalizedMessage = message.trim().slice(0, 1000);
    if (!recipientUid || !normalizedTitle || !normalizedMessage || !allowedRoutes.has(route)) throw new Error('The notification recipient or content is invalid.');
    const recipientSnapshot = await get(ref(this.db, `users/${recipientUid}`));
    if (!recipientSnapshot.exists() || !['active', 'rejected', 'pending_approval'].includes(recipientSnapshot.val().status)) {
      throw new Error('The notification recipient is not a valid account.');
    }

    const notificationRef = push(ref(this.db, `notifications/${recipientUid}`));
    if (!notificationRef.key) throw new Error('Could not create a notification record.');
    const item: UserNotification = {
      recipientUid,
      type,
      title: normalizedTitle,
      message: normalizedMessage,
      route,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      createdAt: serverTimestamp() as unknown as number,
      isRead: false
    };
    await set(notificationRef, item);
  }

  async markRead(uid: string, notificationId: string): Promise<void> {
    if (!this.auth.currentUser || this.auth.currentUser.uid !== uid || !notificationId) throw new Error('You can only update your own notification inbox.');
    const itemRef = ref(this.db, `notifications/${uid}/${notificationId}`);
    const snapshot = await get(itemRef);
    if (!snapshot.exists() || snapshot.val().isRead) return;
    await update(itemRef, { isRead: true, readBy: uid, readAt: serverTimestamp() });
  }
}

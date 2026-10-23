import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, get, onValue, push, ref, set, Unsubscribe } from '@angular/fire/database';
import { AuditTrailService } from './audit-trail.service';
import { NotificationInboxService } from './notification-inbox.service';

export interface QuotationVersion {
  amount: number;
  currency: 'INR';
  terms: string;
  version: number;
  actorUid: string;
  actorEmail: string;
  createdAt: string;
}

export interface QuotationDecision {
  uid: string;
  status: 'approved' | 'rejected';
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class QuotationService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);
  private readonly inbox = inject(NotificationInboxService);
  private readonly audit = inject(AuditTrailService);

  async createVersion(orderId: string, amount: number, terms: string, recipientUid = ''): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      throw new Error('A signed-in administrator and a valid quotation amount are required.');
    }

    const versionsRef = ref(this.db, `quotations/${orderId}/versions`);
    const existing = await get(versionsRef);
    const version = existing.exists() ? Object.keys(existing.val()).length + 1 : 1;
    const newVersionRef = push(versionsRef);
    if (!newVersionRef.key) throw new Error('Could not allocate a quotation version.');

    const quotation: QuotationVersion = {
      amount,
      currency: 'INR',
      terms: terms.trim().slice(0, 2000),
      version,
      actorUid: actor.uid,
      actorEmail: actor.email || '',
      createdAt: new Date().toISOString()
    };
    await set(newVersionRef, quotation);
    await set(ref(this.db, `quotations/${orderId}/currentVersionId`), newVersionRef.key);
    if (recipientUid) {
      void this.inbox.notifyUser(recipientUid, 'quotation', 'New quotation received', `A new quotation of ₹${amount} is available for order ${orderId.slice(0, 8)}.`, '/dashboard/my-orders')
        .catch(error => console.warn('Quotation notification could not be delivered:', error));
    }
    void this.audit.recordAdmin('quotation_created', 'order', orderId, `Quotation version ${version} created at ₹${amount} INR.`);
  }

  watch(orderId: string, next: (data: { currentVersionId: string; versions: Record<string, QuotationVersion> }) => void): Unsubscribe {
    return onValue(ref(this.db, `quotations/${orderId}`), snapshot => {
      const value = snapshot.val() || {};
      next({ currentVersionId: value.currentVersionId || '', versions: value.versions || {} });
    });
  }

  watchDecision(orderId: string, versionId: string, next: (decision: QuotationDecision | null) => void): Unsubscribe {
    return onValue(ref(this.db, `quotationDecisions/${orderId}/${versionId}`), snapshot => {
      next(snapshot.exists() ? snapshot.val() as QuotationDecision : null);
    });
  }

  async decide(orderId: string, versionId: string, status: QuotationDecision['status']): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in to respond to this quotation.');
    await set(ref(this.db, `quotationDecisions/${orderId}/${versionId}`), {
      uid,
      status,
      createdAt: new Date().toISOString()
    } satisfies QuotationDecision);
  }
}

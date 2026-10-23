import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, equalTo, get, limitToFirst, onValue, orderByChild, push, query, ref, set, Unsubscribe, update } from '@angular/fire/database';
import { AuditTrailService } from './audit-trail.service';
import { NotificationInboxService } from './notification-inbox.service';

export interface PaymentRecord {
  uid: string;
  orderId: string;
  quoteVersionId: string;
  amount: number;
  currency: 'INR';
  transactionRef: string;
  upiId: string;
  status: 'pending' | 'verified' | 'rejected' | 'refunded';
  createdAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNote?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionNote?: string;
  refundedAt?: string;
  refundedBy?: string;
  refundNote?: string;
}

export interface LedgerEvent {
  type: string;
  actorUid: string;
  actorEmail: string;
  actorRole: 'Admin';
  message: string;
  createdAt: string;
}

export type RefundProcessingStatus = 'failed' | 'processed';
export interface RefundProcessingRecord {
  uid: string;
  paymentId: string;
  orderId: string;
  status: RefundProcessingStatus;
  reference: string;
  note: string;
  actorUid: string;
  actorEmail: string;
  actorRole: 'Admin';
  createdAt: string;
  historyEventId: string;
}

export interface RefundProcessingEvent extends LedgerEvent {
  reference: string;
}

export function normalizeTransactionReference(value: string): string {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,200}$/.test(normalized)) {
    throw new Error('Use 1 to 200 letters, numbers, hyphens, or underscores for the transaction reference.');
  }
  return normalized;
}

@Injectable({ providedIn: 'root' })
export class PaymentLedgerService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);
  private readonly inbox = inject(NotificationInboxService);
  private readonly audit = inject(AuditTrailService);

  async submitPayment(orderId: string, quoteVersionId: string, transactionRef: string, upiId: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Sign in and provide a transaction reference.');
    const normalizedReference = normalizeTransactionReference(transactionRef);
    const normalizedUpiId = upiId.trim().slice(0, 200);
    const paymentRef = ref(this.db, `payments/${normalizedReference}`);
    const existingPayment = await get(paymentRef);
    if (existingPayment.exists()) {
      const existing = existingPayment.val() as PaymentRecord;
      if (existing.uid === uid && existing.orderId === orderId && existing.quoteVersionId === quoteVersionId
        && existing.transactionRef === normalizedReference && existing.upiId === normalizedUpiId) return;
      throw new Error('This transaction reference is already associated with a payment record.');
    }

    const [orderSnap, quoteSnap, decisionSnap, currentQuoteSnap] = await Promise.all([
      get(ref(this.db, `orders/${orderId}`)),
      get(ref(this.db, `quotations/${orderId}/versions/${quoteVersionId}`)),
      get(ref(this.db, `quotationDecisions/${orderId}/${quoteVersionId}`)),
      get(ref(this.db, `quotations/${orderId}/currentVersionId`))
    ]);
    if (!orderSnap.exists() || orderSnap.val().uid !== uid || !quoteSnap.exists() || !decisionSnap.exists()
      || decisionSnap.val().status !== 'approved' || currentQuoteSnap.val() !== quoteVersionId) {
      throw new Error('Only an approved current quotation for your own order can be paid.');
    }

    const payment: PaymentRecord = {
      uid,
      orderId,
      quoteVersionId,
      amount: Number(quoteSnap.val().amount),
      currency: 'INR',
      transactionRef: normalizedReference,
      upiId: normalizedUpiId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    try {
      await set(paymentRef, payment);
    } catch (error) {
      const committed = await get(paymentRef).catch(() => null);
      const value = committed?.exists() ? committed.val() as PaymentRecord : null;
      if (value?.uid === uid && value.orderId === orderId && value.quoteVersionId === quoteVersionId
        && value.transactionRef === normalizedReference && value.upiId === normalizedUpiId) return;
      throw error;
    }
  }

  watchStudentPayments(uid: string, next: (payments: Array<PaymentRecord & { id: string }>) => void): Unsubscribe {
    const paymentsQuery = query(ref(this.db, 'payments'), orderByChild('uid'), equalTo(uid), limitToFirst(100));
    return onValue(paymentsQuery, snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(id => ({ id, ...value[id] })));
    });
  }

  watchOrderPayments(orderId: string, next: (payments: Array<PaymentRecord & { id: string }>) => void): Unsubscribe {
    const paymentsQuery = query(ref(this.db, 'payments'), orderByChild('orderId'), equalTo(orderId), limitToFirst(100));
    return onValue(paymentsQuery, snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(id => ({ id, ...value[id] })));
    });
  }

  watchStudentRefunds(uid: string, next: (refunds: Record<string, any>) => void): Unsubscribe {
    const refundsQuery = query(ref(this.db, 'refunds'), orderByChild('uid'), equalTo(uid), limitToFirst(100));
    return onValue(refundsQuery, snapshot => next(snapshot.val() || {}));
  }

  watchRefund(paymentId: string, next: (refund: any | null) => void): Unsubscribe {
    return onValue(ref(this.db, `refunds/${paymentId}`), snapshot => next(snapshot.exists() ? snapshot.val() : null));
  }

  watchPaymentHistory(paymentId: string, next: (history: Record<string, LedgerEvent>) => void): Unsubscribe {
    return onValue(ref(this.db, `paymentHistory/${paymentId}`), snapshot => next(snapshot.val() || {}));
  }

  watchRefundHistory(paymentId: string, next: (history: Record<string, LedgerEvent>) => void): Unsubscribe {
    return onValue(ref(this.db, `refundHistory/${paymentId}`), snapshot => next(snapshot.val() || {}));
  }

  watchRefundProcessing(paymentId: string, next: (record: RefundProcessingRecord | null) => void): Unsubscribe {
    return onValue(ref(this.db, `refundProcessing/${paymentId}`), snapshot => next(snapshot.exists() ? snapshot.val() as RefundProcessingRecord : null));
  }

  watchRefundProcessingHistory(paymentId: string, next: (history: Record<string, RefundProcessingEvent>) => void): Unsubscribe {
    return onValue(ref(this.db, `refundProcessingHistory/${paymentId}`), snapshot => next(snapshot.val() || {}));
  }

  async updatePaymentStatus(paymentId: string, status: 'verified' | 'rejected' | 'refunded', decisionNote: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email) throw new Error('Administrator authentication is required.');
    const normalizedNote = decisionNote.trim().slice(0, 500);
    if (!normalizedNote) throw new Error('Record the payment verification evidence or decision reason.');
    const paymentRef = ref(this.db, `payments/${paymentId}`);
    const paymentSnap = await get(paymentRef);
    if (!paymentSnap.exists()) throw new Error('Payment record was not found.');
    const payment = paymentSnap.val() as PaymentRecord;
    const transitions: Record<string, string[]> = {
      pending: ['verified', 'rejected'],
      verified: ['refunded'],
      rejected: [],
      refunded: []
    };
    const historyRef = ref(this.db, `paymentHistory/${paymentId}/decision_${status}`);
    if (status === 'refunded') await this.assertApprovedProcessedRefund(paymentId);
    if (payment.status === status) {
      const existingEvent = await get(historyRef);
      if (existingEvent.exists()) return;
      await this.setHistoryIfMissing(historyRef, this.recoveredLedgerEvent(status, actor.uid, actor.email, normalizedNote));
      return;
    }
    if (!transitions[payment.status]?.includes(status)) throw new Error(`Invalid payment transition: ${payment.status} to ${status}.`);

    const event: LedgerEvent = {
      type: status,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      message: normalizedNote,
      createdAt: new Date().toISOString()
    };
    const changes: Record<string, unknown> = { status };
    if (status === 'verified') {
      changes['verifiedAt'] = event.createdAt;
      changes['verifiedBy'] = actor.uid;
      changes['verificationNote'] = normalizedNote;
    } else if (status === 'rejected') {
      changes['rejectedAt'] = event.createdAt;
      changes['rejectedBy'] = actor.uid;
      changes['rejectionNote'] = normalizedNote;
    } else if (status === 'refunded') {
      changes['refundedAt'] = event.createdAt;
      changes['refundedBy'] = actor.uid;
      changes['refundNote'] = normalizedNote;
    }
    try {
      await update(ref(this.db), {
      ...Object.fromEntries(Object.entries(changes).map(([key, value]) => [`payments/${paymentId}/${key}`, value])),
        [`paymentHistory/${paymentId}/decision_${status}`]: event
      });
    } catch (error) {
      const [latestPayment, latestEvent] = await Promise.all([
        get(paymentRef).catch(() => null),
        get(historyRef).catch(() => null)
      ]);
      if (latestPayment?.exists() && latestPayment.val().status === status && latestEvent?.exists()) return;
      throw error;
    }
    const title = status === 'verified' ? 'Payment verified' : status === 'refunded' ? 'Refund processed' : 'Payment update';
    void this.inbox.notifyUser(payment.uid, status === 'refunded' ? 'refund' : 'payment', title, `Your payment for order ${payment.orderId.slice(0, 8)} is marked ${status}.`, '/dashboard/my-orders')
      .catch(error => console.warn('Payment notification could not be delivered:', error));
    void this.audit.recordAdmin(`payment_${status}`, 'payment', paymentId, `Payment for order ${payment.orderId} marked ${status}.`);
  }

  private async assertApprovedProcessedRefund(paymentId: string): Promise<void> {
    const [refundSnap, processingSnap] = await Promise.all([
      get(ref(this.db, `refunds/${paymentId}`)),
      get(ref(this.db, `refundProcessing/${paymentId}`))
    ]);
    if (!refundSnap.exists() || refundSnap.val().status !== 'approved' || !processingSnap.exists() || processingSnap.val().status !== 'processed') {
      throw new Error('An approved refund request and recorded external processing outcome are required.');
    }
  }

  async requestRefund(payment: PaymentRecord & { id: string }, reason: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || payment.uid !== uid || payment.status !== 'verified') throw new Error('Only a verified payment on your account can be refunded.');
    const normalizedReason = reason.trim().slice(0, 1000);
    if (!normalizedReason) throw new Error('Record a reason for the refund request.');
    const refund = {
      uid,
      orderId: payment.orderId,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      reason: normalizedReason,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    const refundRef = ref(this.db, `refunds/${payment.id}`);
    const existing = await get(refundRef);
    if (existing.exists()) {
      const current = existing.val();
      if (current.uid === uid && current.paymentId === payment.id && current.reason === refund.reason) return;
      throw new Error('A refund request already exists for this payment.');
    }
    try {
      await set(refundRef, refund);
    } catch (error) {
      const committed = await get(refundRef).catch(() => null);
      const current = committed?.exists() ? committed.val() : null;
      if (current?.uid === uid && current.paymentId === payment.id && current.reason === refund.reason) return;
      throw error;
    }
  }

  async decideRefund(paymentId: string, status: 'approved' | 'rejected', decisionNote: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email) throw new Error('Administrator authentication is required.');
    const normalizedNote = decisionNote.trim().slice(0, 500);
    if (!normalizedNote) throw new Error('Record the refund approval or rejection reason.');
    const refundRef = ref(this.db, `refunds/${paymentId}`);
    const refundSnap = await get(refundRef);
    if (!refundSnap.exists()) throw new Error('Refund record was not found.');
    const refundData = refundSnap.val();
    const historyRef = ref(this.db, `refundHistory/${paymentId}/decision_${status}`);
    if (refundData.status === status) {
      const existingEvent = await get(historyRef);
      if (existingEvent.exists()) return;
      await this.setHistoryIfMissing(historyRef, this.recoveredLedgerEvent(status, actor.uid, actor.email, normalizedNote));
      return;
    }
    if (refundData.status !== 'pending') throw new Error('Only a pending refund can be reviewed.');
    const event: LedgerEvent = {
      type: status,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      message: normalizedNote,
      createdAt: new Date().toISOString()
    };
    try {
      await update(ref(this.db), {
        [`refunds/${paymentId}/status`]: status,
        [`refunds/${paymentId}/reviewedAt`]: event.createdAt,
        [`refunds/${paymentId}/reviewedBy`]: actor.uid,
        [`refunds/${paymentId}/decisionNote`]: normalizedNote,
        [`refundHistory/${paymentId}/decision_${status}`]: event
      });
    } catch (error) {
      const [latestRefund, latestEvent] = await Promise.all([
        get(refundRef).catch(() => null),
        get(historyRef).catch(() => null)
      ]);
      if (latestRefund?.exists() && latestRefund.val().status === status && latestEvent?.exists()) return;
      throw error;
    }
    void this.inbox.notifyUser(refundSnap.val().uid, 'refund', `Refund ${status}`, `Your refund request for order ${refundSnap.val().orderId.slice(0, 8)} was ${status}.`, '/dashboard/my-orders')
      .catch(error => console.warn('Refund notification could not be delivered:', error));
    void this.audit.recordAdmin(`refund_${status}`, 'refund', paymentId, `Refund request for order ${refundSnap.val().orderId} ${status}.`);
  }

  async recordRefundProcessing(paymentId: string, status: RefundProcessingStatus, reference: string, note: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email) throw new Error('Administrator authentication is required.');
    const normalizedReference = reference.trim().slice(0, 200);
    const normalizedNote = note.trim().slice(0, 500);
    if (!normalizedNote || (status === 'processed' && !normalizedReference)) {
      throw new Error('Record an outcome note and an external reference for a completed refund.');
    }

    const [refundSnap, paymentSnap, currentProcessingSnap] = await Promise.all([
      get(ref(this.db, `refunds/${paymentId}`)),
      get(ref(this.db, `payments/${paymentId}`)),
      get(ref(this.db, `refundProcessing/${paymentId}`))
    ]);
    if (!refundSnap.exists() || refundSnap.val().status !== 'approved' || !paymentSnap.exists()) {
      throw new Error('An approved refund request and payment record are required.');
    }
    const payment = paymentSnap.val() as PaymentRecord;
    const existing = currentProcessingSnap.exists() ? currentProcessingSnap.val() as RefundProcessingRecord : null;
    if (existing?.status === 'processed') {
      if (status !== 'processed') throw new Error('A completed refund outcome cannot transition back to failed.');
      await this.ensureRefundProcessingHistory(paymentId, existing, actor.uid, actor.email);
      if (payment.status === 'refunded') return;
      if (payment.status !== 'verified') throw new Error('Only a verified payment can be refunded.');
      await this.updatePaymentStatus(paymentId, 'refunded', `Refund processing reference ${existing.reference}. ${normalizedNote}`);
      return;
    }
    if (payment.status === 'refunded') throw new Error('A refunded payment cannot accept another processing outcome.');
    if (payment.status !== 'verified') throw new Error('Only a verified payment can be refunded.');
    if (existing) await this.ensureRefundProcessingHistory(paymentId, existing, actor.uid, actor.email);
    if (existing?.status === status && existing.reference === normalizedReference && existing.note === normalizedNote) return;

    const historyRef = push(ref(this.db, `refundProcessingHistory/${paymentId}`));
    if (!historyRef.key) throw new Error('Could not allocate a refund processing history event.');
    const event: RefundProcessingRecord = {
      uid: payment.uid,
      paymentId,
      orderId: payment.orderId,
      status,
      reference: normalizedReference,
      note: normalizedNote,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      createdAt: new Date().toISOString(),
      historyEventId: historyRef.key
    };
    const historyEvent: RefundProcessingEvent = {
      type: status,
      reference: normalizedReference,
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: 'Admin',
      message: `${normalizedReference ? `Reference ${normalizedReference}. ` : ''}${normalizedNote}`.slice(0, 700),
      createdAt: event.createdAt
    };
    const processingRef = ref(this.db, `refundProcessing/${paymentId}`);
    try {
      if (existing) await update(processingRef, event);
      else await set(processingRef, event);
    } catch (error) {
      const committed = await get(processingRef).catch(() => null);
      const current = committed?.exists() ? committed.val() as RefundProcessingRecord : null;
      if (!current || current.historyEventId !== event.historyEventId) throw error;
    }
    await this.ensureRefundProcessingHistory(paymentId, event, actor.uid, actor.email, historyEvent.message);

    if (status === 'processed') await this.updatePaymentStatus(paymentId, 'refunded', `Refund processing reference ${normalizedReference}. ${normalizedNote}`);
    void this.audit.recordAdmin(`refund_processing_${status}`, 'refund', paymentId, normalizedNote);
  }

  private recoveredLedgerEvent(type: string, actorUid: string, actorEmail: string, note: string): LedgerEvent {
    return { type, actorUid, actorEmail, actorRole: 'Admin', message: `Recovered missing history after a retry. ${note}`, createdAt: new Date().toISOString() };
  }

  private async setHistoryIfMissing(eventRef: ReturnType<typeof ref>, event: LedgerEvent): Promise<void> {
    try {
      await set(eventRef, event);
    } catch (error) {
      if (!(await get(eventRef).catch(() => null))?.exists()) throw error;
    }
  }

  private async ensureRefundProcessingHistory(
    paymentId: string,
    record: RefundProcessingRecord,
    actorUid: string,
    actorEmail: string,
    message?: string
  ): Promise<void> {
    if (!record.historyEventId) throw new Error('Refund processing history needs manual reconciliation.');
    const eventRef = ref(this.db, `refundProcessingHistory/${paymentId}/${record.historyEventId}`);
    const existingEvent = await get(eventRef);
    if (existingEvent.exists()) {
      const value = existingEvent.val();
      if (value.type !== record.status || value.reference !== record.reference) {
        throw new Error('Refund processing history conflicts with its saved outcome; manual reconciliation is required.');
      }
      return;
    }
    const recoveryMessage = message || `Recovered missing history; original outcome was recorded by ${record.actorEmail}. ${record.note}`;
    const event: RefundProcessingEvent = {
      type: record.status,
      reference: record.reference,
      actorUid,
      actorEmail,
      actorRole: 'Admin',
      message: recoveryMessage.slice(0, 700),
      createdAt: record.createdAt
    };
    try {
      await set(eventRef, event);
    } catch (error) {
      const committed = await get(eventRef).catch(() => null);
      if (!committed?.exists()) throw error;
    }
  }
}

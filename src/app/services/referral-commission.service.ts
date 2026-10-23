import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, equalTo, get, limitToFirst, onValue, orderByChild, push, query, ref, serverTimestamp, set, Unsubscribe, update } from '@angular/fire/database';
import { AuditTrailService } from './audit-trail.service';
import { NotificationInboxService } from './notification-inbox.service';

const adminEmails = new Set(['admin@filecrafters.in', 'wmohd2514@outlook.com']);

export interface ReferralCode {
  code: string;
  teacherUid: string;
  active: boolean;
  createdBy: string;
  createdAt: number;
}

export interface ReferralAttribution {
  studentUid: string;
  teacherUid: string;
  referralCode: string;
  createdAt: number;
}

export type CommissionStatus = 'pending' | 'approved' | 'rejected' | 'paid';
export interface CommissionRecord {
  teacherUid: string;
  studentUid: string;
  orderId: string;
  paymentId: string;
  amount: number;
  calculationBaseAmount: number;
  calculationRatePercent: number;
  proposedAmount: number;
  calculationFormula: 'verified-payment-times-admin-rate-v1';
  roundingPolicy: 'half-up-to-0.01-INR';
  currency: 'INR';
  status: CommissionStatus;
  memo: string;
  createdBy: string;
  createdAt: number;
  creationHistoryId: string;
  updatedBy?: string;
  updatedAt?: number;
}

export function calculateCommissionAmount(baseAmount: number, ratePercent: number): number {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(ratePercent) || baseAmount <= 0 || ratePercent <= 0 || ratePercent > 100) {
    throw new Error('Commission base and rate must be positive, with the rate at or below 100 percent.');
  }
  const basePaise = Math.round(baseAmount * 100);
  const rateBasisPoints = Math.round(ratePercent * 100);
  if (Math.abs(ratePercent * 100 - rateBasisPoints) > 1e-8) throw new Error('Commission rate must use at most two decimal places.');
  const roundedPaise = Math.floor((basePaise * rateBasisPoints + 5000) / 10000);
  if (roundedPaise < 1) throw new Error('The reviewed rate produces no payable INR paise.');
  return roundedPaise / 100;
}

@Injectable({ providedIn: 'root' })
export class ReferralCommissionService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);
  private readonly inbox = inject(NotificationInboxService);
  private readonly audit = inject(AuditTrailService);

  async createReferralCode(teacherUid: string): Promise<string> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase()) || !teacherUid) throw new Error('An administrator and a teacher account are required.');
    const profileSnap = await get(ref(this.db, `users/${teacherUid}`));
    const profile = profileSnap.val();
    if (profile?.role !== 'Teacher' || profile?.status !== 'active') throw new Error('Referral codes can only be created for active teachers.');

    const suffix = teacherUid.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
    const code = `FC-${suffix}`;
    const codeRef = ref(this.db, `referralCodes/${code}`);
    const existing = await get(codeRef);
    if (existing.exists()) throw new Error('This referral code already exists. Ask an administrator to review the existing record.');
    await set(codeRef, { code, teacherUid, active: true, createdBy: actor.uid, createdAt: serverTimestamp() });
    void this.audit.recordAdmin('teacher_referral_code_created', 'teacher', teacherUid, `Created referral code ${code}.`);
    return code;
  }

  watchCodesForTeacher(teacherUid: string, next: (codes: ReferralCode[]) => void): Unsubscribe {
    const codesQuery = query(ref(this.db, 'referralCodes'), orderByChild('teacherUid'), equalTo(teacherUid), limitToFirst(10));
    return onValue(codesQuery, snapshot => {
      const records = snapshot.val() || {};
      next(Object.values(records) as ReferralCode[]);
    });
  }

  watchStudentAttribution(studentUid: string, next: (record: ReferralAttribution | null) => void): Unsubscribe {
    return onValue(ref(this.db, `referralAttributions/${studentUid}`), snapshot => next(snapshot.exists() ? snapshot.val() as ReferralAttribution : null));
  }

  watchMyAttributions(teacherUid: string, next: (records: ReferralAttribution[]) => void): Unsubscribe {
    const attributionQuery = query(ref(this.db, 'referralAttributions'), orderByChild('teacherUid'), equalTo(teacherUid), limitToFirst(100));
    return onValue(attributionQuery, snapshot => {
      const records = snapshot.val() || {};
      next(Object.values(records) as ReferralAttribution[]);
    });
  }

  watchOrderCommissions(orderId: string, next: (records: Array<CommissionRecord & { id: string }>) => void): Unsubscribe {
    const commissionsQuery = query(ref(this.db, 'commissions'), orderByChild('orderId'), equalTo(orderId), limitToFirst(100));
    return onValue(commissionsQuery, snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(id => ({ ...value[id], id })));
    });
  }

  watchMyCommissions(teacherUid: string, next: (records: Array<CommissionRecord & { id: string }>) => void): Unsubscribe {
    const commissionsQuery = query(ref(this.db, 'commissions'), orderByChild('teacherUid'), equalTo(teacherUid), limitToFirst(100));
    return onValue(commissionsQuery, snapshot => {
      const value = snapshot.val() || {};
      next(Object.keys(value).map(id => ({ ...value[id], id })));
    });
  }

  watchCommissionHistory(commissionId: string, next: (events: Record<string, any>) => void): Unsubscribe {
    return onValue(ref(this.db, `commissionHistory/${commissionId}`), snapshot => next(snapshot.val() || {}));
  }

  async createManualCommission(orderId: string, ratePercent: number, memo = ''): Promise<string> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase()) || !Number.isFinite(ratePercent) || ratePercent <= 0 || ratePercent > 100 || memo.trim().length === 0 || memo.trim().length > 1000) {
      throw new Error('A valid administrator, a commission rate from 0.01 to 100 percent, and a short note are required.');
    }
    const orderSnap = await get(ref(this.db, `orders/${orderId}`));
    const order = orderSnap.val();
    if (!order?.uid) throw new Error('The order could not be found.');

    const attributionSnap = await get(ref(this.db, `referralAttributions/${order.uid}`));
    const attribution = attributionSnap.val() as ReferralAttribution | null;
    if (!attribution?.teacherUid) throw new Error('This student has no recorded teacher referral attribution.');

    const existingCommissionSnap = await get(query(ref(this.db, 'commissions'), orderByChild('orderId'), equalTo(orderId), limitToFirst(100)));
    const existingCommissions = existingCommissionSnap.val() || {};
    const matchingExisting = Object.entries(existingCommissions).filter(([, value]: [string, any]) => value.teacherUid === attribution.teacherUid
      && value.studentUid === order.uid && value.calculationRatePercent === ratePercent && value.memo === memo.trim()) as Array<[string, CommissionRecord]>;
    if (matchingExisting.length === 1) {
      const [existingId, existing] = matchingExisting[0];
      await this.ensureCommissionCreationHistory(existingId, existing);
      return existingId;
    }
    if (matchingExisting.length > 1) throw new Error('Multiple matching commission entries exist and need administrator review.');

    const paymentsSnap = await get(query(ref(this.db, 'payments'), orderByChild('orderId'), equalTo(orderId), limitToFirst(100)));
    const payments = paymentsSnap.val() || {};
    const verifiedPayments = Object.entries(payments).filter(([, payment]: [string, any]) => payment.uid === order.uid && payment.status === 'verified');
    if (verifiedPayments.length !== 1) throw new Error('Exactly one manually verified payment is required to establish the commission base.');
    const verifiedPayment = verifiedPayments[0];
    const baseAmount = Number((verifiedPayment[1] as any).amount);
    const proposedAmount = calculateCommissionAmount(baseAmount, ratePercent);

    const recordId = verifiedPayment[0];
    const recordRef = ref(this.db, `commissions/${recordId}`);
    const existingRecord = await get(recordRef);
    if (existingRecord.exists()) throw new Error('A commission record already exists for this verified payment with different reviewed details.');
    const creationHistoryRef = push(ref(this.db, `commissionHistory/${recordId}`));
    if (!creationHistoryRef.key) throw new Error('Could not allocate commission history.');
    const record: CommissionRecord = {
      teacherUid: attribution.teacherUid,
      studentUid: order.uid,
      orderId,
      paymentId: verifiedPayment[0],
      amount: proposedAmount,
      calculationBaseAmount: baseAmount,
      calculationRatePercent: ratePercent,
      proposedAmount,
      calculationFormula: 'verified-payment-times-admin-rate-v1',
      roundingPolicy: 'half-up-to-0.01-INR',
      currency: 'INR',
      status: 'pending',
      memo: memo.trim(),
      createdBy: actor.uid,
      createdAt: serverTimestamp() as unknown as number,
      creationHistoryId: creationHistoryRef.key
    };
    try {
      await set(recordRef, record);
    } catch (error) {
      const committed = await get(recordRef).catch(() => null);
      const current = committed?.exists() ? committed.val() as CommissionRecord : null;
      if (!current || current.teacherUid !== record.teacherUid || current.studentUid !== record.studentUid
        || current.orderId !== record.orderId || current.paymentId !== record.paymentId
        || current.calculationRatePercent !== record.calculationRatePercent || current.memo !== record.memo) throw error;
      await this.ensureCommissionCreationHistory(recordId, current);
      return recordId;
    }
    const saved = await get(recordRef);
    await this.ensureCommissionCreationHistory(recordId, saved.val() as CommissionRecord);
    void this.audit.recordAdmin('commission_created', 'commission', recordId, `Recorded a pending INR ${proposedAmount} commission at ${ratePercent}% of verified payment ${baseAmount} for order ${orderId}.`);
    return recordId;
  }

  async setCommissionStatus(commissionId: string, status: Exclude<CommissionStatus, 'pending'>, message: string): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase()) || !['approved', 'rejected', 'paid'].includes(status) || message.trim().length === 0 || message.trim().length > 1000) {
      throw new Error('A valid administrator status decision is required.');
    }
    const recordSnap = await get(ref(this.db, `commissions/${commissionId}`));
    const record = recordSnap.val() as CommissionRecord | null;
    const transitionEventRef = ref(this.db, `commissionHistory/${commissionId}/transition_${status}`);
    if (record?.status === status) {
      if (!(await get(transitionEventRef)).exists()) await this.ensureCommissionTransitionHistory(commissionId, record, status, message, actor.uid, actor.email);
      return;
    }
    const valid = record?.status === 'pending' && (status === 'approved' || status === 'rejected') || record?.status === 'approved' && status === 'paid';
    if (!record || !valid) throw new Error('The commission is no longer in a state that allows this transition.');

    const timestamp = serverTimestamp();
    try {
      await update(ref(this.db), {
        [`commissions/${commissionId}/status`]: status,
        [`commissions/${commissionId}/updatedBy`]: actor.uid,
        [`commissions/${commissionId}/updatedAt`]: timestamp,
        [`commissionHistory/${commissionId}/transition_${status}`]: {
        commissionId,
        teacherUid: record.teacherUid,
        status,
        actorUid: actor.uid,
        actorEmail: actor.email || '',
        message: message.trim() || `Commission status changed to ${status}.`,
        createdAt: timestamp
      }
      });
    } catch (error) {
      const [latestRecord, latestEvent] = await Promise.all([
        get(ref(this.db, `commissions/${commissionId}`)).catch(() => null),
        get(transitionEventRef).catch(() => null)
      ]);
      if (latestRecord?.exists() && latestRecord.val().status === status && latestEvent?.exists()) return;
      throw error;
    }
    void this.inbox.notifyUser(record.teacherUid, 'commission', `Commission ${status}`, `A commission for order ${record.orderId.slice(0, 8)} was marked ${status}.`, '/teacher/referrals')
      .catch(error => console.warn('Teacher commission notification could not be delivered:', error));
    void this.audit.recordAdmin(`commission_${status}`, 'commission', commissionId, `Commission for order ${record.orderId} marked ${status}.`);
  }

  async ensureCommissionCreationHistory(commissionId: string, record?: CommissionRecord): Promise<void> {
    const actor = this.auth.currentUser;
    if (!actor?.email || !adminEmails.has(actor.email.toLowerCase())) throw new Error('Administrator authentication is required to repair commission history.');
    const savedRecord = record ?? (await get(ref(this.db, `commissions/${commissionId}`))).val() as CommissionRecord | null;
    if (!savedRecord?.creationHistoryId) throw new Error('This commission has no recoverable initial history key; manual review is required.');
    const eventRef = ref(this.db, `commissionHistory/${commissionId}/${savedRecord.creationHistoryId}`);
    if ((await get(eventRef)).exists()) return;
    const event = {
      commissionId,
      teacherUid: savedRecord.teacherUid,
      status: 'pending',
      actorUid: actor.uid,
      actorEmail: actor.email,
      message: `Initial commission history ${savedRecord.createdBy === actor.uid ? 'recorded' : 'recovered'} for the administrator-created commission. ${savedRecord.memo}`.slice(0, 1000),
      createdAt: typeof savedRecord.createdAt === 'number' ? savedRecord.createdAt : Date.now()
    };
    try {
      await set(eventRef, event);
    } catch (error) {
      const committed = await get(eventRef).catch(() => null);
      if (!committed?.exists() || committed.val().commissionId !== commissionId || committed.val().teacherUid !== savedRecord.teacherUid) throw error;
    }
  }

  private async ensureCommissionTransitionHistory(
    commissionId: string,
    record: CommissionRecord,
    status: CommissionStatus,
    message: string,
    actorUid: string,
    actorEmail: string
  ): Promise<void> {
    const eventRef = ref(this.db, `commissionHistory/${commissionId}/transition_${status}`);
    const event = {
      commissionId,
      teacherUid: record.teacherUid,
      status,
      actorUid,
      actorEmail,
      message: `Recovered missing ${status} history after confirming the saved commission status. ${message.trim()}`.slice(0, 1000),
      createdAt: typeof record.updatedAt === 'number' ? record.updatedAt : Date.now()
    };
    try {
      await set(eventRef, event);
    } catch (error) {
      const committed = await get(eventRef).catch(() => null);
      if (!committed?.exists() || committed.val().commissionId !== commissionId || committed.val().status !== status) throw error;
    }
  }

}

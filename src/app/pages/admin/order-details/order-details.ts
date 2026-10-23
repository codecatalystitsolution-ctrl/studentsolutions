import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Dhyan dein: 'get' import karna zaroori hai
import { Database, ref, onValue, get } from '@angular/fire/database';
import { ActivatedRoute } from '@angular/router';
import { PrivateFileService } from '../../../services/private-file.service';
import { QuotationService, QuotationVersion } from '../../../services/quotation.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { LedgerEvent, PaymentLedgerService, PaymentRecord, RefundProcessingRecord, RefundProcessingStatus } from '../../../services/payment-ledger.service';
import { DeliveryAssignment, DeliveryWorkflowService } from '../../../services/delivery-workflow.service';
import { calculateCommissionAmount, CommissionRecord, CommissionStatus, ReferralAttribution, ReferralCommissionService } from '../../../services/referral-commission.service';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-details.html',
  styleUrls: ['./order-details.scss']
})
export class OrderDetailsComponent implements OnInit, OnDestroy {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute); // Naya injection
  private privateFileService = inject(PrivateFileService);
  private quotationService = inject(QuotationService);
  private notificationService = inject(NotificationService);
  private paymentLedger = inject(PaymentLedgerService);
  private deliveryWorkflow = inject(DeliveryWorkflowService);
  private referralCommission = inject(ReferralCommissionService);

  orders: any[] = [];
  filteredOrders: any[] = [];
  isLoading: boolean = true;
  searchTerm: string = '';
  quoteAmounts: Record<string, number | null> = {};
  quoteTerms: Record<string, string> = {};
  quotations: Record<string, { currentVersionId: string; versions: Record<string, QuotationVersion> }> = {};
  private quotationSubscriptions = new Map<string, () => void>();
  payments: Record<string, Array<PaymentRecord & { id: string }>> = {};
  refunds: Record<string, any | null> = {};
  refundProcessing: Record<string, RefundProcessingRecord | null> = {};
  refundDecisionNotes: Record<string, string> = {};
  paymentDecisionNotes: Record<string, string> = {};
  refundProcessingReferences: Record<string, string> = {};
  refundProcessingNotes: Record<string, string> = {};
  paymentHistory: Record<string, Record<string, LedgerEvent>> = {};
  refundHistory: Record<string, Record<string, LedgerEvent>> = {};
  refundProcessingHistory: Record<string, Record<string, LedgerEvent>> = {};
  private paymentSubscriptions = new Map<string, () => void>();
  private refundSubscriptions = new Map<string, () => void>();
  private paymentHistorySubscriptions = new Map<string, () => void>();
  private refundHistorySubscriptions = new Map<string, () => void>();
  private refundProcessingSubscriptions = new Map<string, () => void>();
  private refundProcessingHistorySubscriptions = new Map<string, () => void>();
  deliveryAgents: Array<{ uid: string; fullName: string; email: string }> = [];
  selectedDeliveryAgent: Record<string, string> = {};
  deliveryAssignments: Record<string, DeliveryAssignment | null> = {};
  private deliverySubscriptions = new Map<string, () => void>();
  referralAttributions: Record<string, ReferralAttribution | null> = {};
  orderCommissions: Record<string, Array<CommissionRecord & { id: string }>> = {};
  commissionHistory: Record<string, Record<string, any>> = {};
  commissionRates: Record<string, number | null> = {};
  commissionMemos: Record<string, string> = {};
  commissionDecisionNotes: Record<string, string> = {};
  private referralSubscriptions = new Map<string, () => void>();
  private commissionSubscriptions = new Map<string, () => void>();
  private commissionHistorySubscriptions = new Map<string, () => void>();
  private stopUsersListener: (() => void) | null = null;

  async createQuotation(order: any): Promise<void> {
    const amount = Number(this.quoteAmounts[order.id]);
    try {
      if (!order.uid || !Number.isFinite(amount)) throw new Error('A valid student order and amount are required.');
      await this.quotationService.createVersion(order.id, amount, this.quoteTerms[order.id] || '', order.uid);
      this.notificationService.show('success', 'A new quotation version is available to the student.', 'Quotation Created');
      this.quoteAmounts[order.id] = null;
      this.quoteTerms[order.id] = '';
    } catch (error) {
      console.error('Could not create quotation:', error);
      this.notificationService.show('error', 'Quotation was not saved. Check administrator access and try again.', 'Quotation Failed');
    }
  }

  async assignDelivery(order: any): Promise<void> {
    try {
      await this.deliveryWorkflow.assign(order, this.selectedDeliveryAgent[order.id] || '');
      this.notificationService.show('success', 'Delivery assignment created and tracking is ready.', 'Delivery Assigned');
    } catch (error) {
      console.error('Delivery assignment failed:', error);
      this.notificationService.show('error', 'The order could not be assigned. Verify the order and active delivery account.', 'Assignment Failed');
    }
  }

  async createCommission(order: any): Promise<void> {
    try {
      const rate = Number(this.commissionRates[order.id]);
      await this.referralCommission.createManualCommission(order.id, rate, this.commissionMemos[order.id] || '');
      this.commissionRates[order.id] = null;
      this.commissionMemos[order.id] = '';
      this.notificationService.show('success', 'A pending commission record was added for administrator review.', 'Commission Recorded');
    } catch (error) {
      console.error('Commission record creation failed:', error);
      this.notificationService.show('error', 'A commission requires a saved referral attribution and a manually verified payment.', 'Commission Not Created');
    }
  }

  hasCommissionHistory(commissionId: string): boolean {
    return Object.keys(this.commissionHistory[commissionId] || {}).length > 0;
  }

  async repairCommissionHistory(record: CommissionRecord & { id: string }): Promise<void> {
    try {
      await this.referralCommission.ensureCommissionCreationHistory(record.id, record);
      this.notificationService.show('success', 'Commission history was checked and any missing creation event was restored.', 'History Reconciled');
    } catch (error) {
      console.error('Commission creation history could not be reconciled:', error);
      this.notificationService.show('error', 'Commission history could not be reconciled. Review the record manually.', 'History Reconciliation Failed');
    }
  }

  async updateCommissionStatus(record: CommissionRecord & { id: string }, status: Exclude<CommissionStatus, 'pending'>): Promise<void> {
    try {
      const message = this.commissionDecisionNotes[record.id] || '';
      await this.referralCommission.setCommissionStatus(record.id, status, message);
      this.commissionDecisionNotes[record.id] = '';
      this.notificationService.show('success', status === 'paid' ? 'Payout marked complete after external processing.' : `Commission ${status}.`, 'Commission Updated');
    } catch (error) {
      console.error('Commission status update failed:', error);
      this.notificationService.show('error', 'The commission status could not be updated. Check its current status and administrator access.', 'Update Failed');
    }
  }

  hasVerifiedPayment(orderId: string): boolean {
    return (this.payments[orderId] || []).some(payment => payment.status === 'verified');
  }

  commissionBaseAmount(orderId: string): number | null {
    const verified = (this.payments[orderId] || []).filter(payment => payment.status === 'verified');
    return verified.length === 1 ? verified[0].amount : null;
  }

  commissionPreview(orderId: string): number | null {
    const base = this.commissionBaseAmount(orderId);
    const rate = Number(this.commissionRates[orderId]);
    if (base === null || !Number.isFinite(rate) || rate <= 0 || rate > 100) return null;
    try { return calculateCommissionAmount(base, rate); } catch { return null; }
  }

  async setPaymentStatus(paymentId: string, status: 'verified' | 'rejected' | 'refunded', note = ''): Promise<void> {
    try {
      await this.paymentLedger.updatePaymentStatus(paymentId, status, note);
      this.paymentDecisionNotes[paymentId] = '';
      this.notificationService.show('success', status === 'verified' ? 'Payment manually verified. Confirm it against your external payment records.' : `Payment marked ${status}.`, 'Payment Updated');
    } catch (error) {
      console.error('Payment status update failed:', error);
      this.notificationService.show('error', 'Payment status could not be updated. Check its current state and your administrator permissions.', 'Update Failed');
    }
  }

  async setRefundStatus(paymentId: string, status: 'approved' | 'rejected'): Promise<void> {
    try {
      await this.paymentLedger.decideRefund(paymentId, status, this.refundDecisionNotes[paymentId] || '');
      this.refundDecisionNotes[paymentId] = '';
      this.notificationService.show('success', `Refund request ${status}. ${status === 'approved' ? 'Mark the payment refunded after processing the refund externally.' : ''}`, 'Refund Reviewed');
    } catch (error) {
      console.error('Refund review failed:', error);
      this.notificationService.show('error', 'Refund request could not be updated.', 'Update Failed');
    }
  }

  async recordRefundProcessing(paymentId: string, status: RefundProcessingStatus): Promise<void> {
    try {
      await this.paymentLedger.recordRefundProcessing(paymentId, status, this.refundProcessingReferences[paymentId] || '', this.refundProcessingNotes[paymentId] || '');
      this.refundProcessingNotes[paymentId] = '';
      if (status === 'processed') this.refundProcessingReferences[paymentId] = '';
      this.notificationService.show('success', status === 'processed' ? 'External refund outcome recorded and payment ledger updated.' : 'External refund failure recorded. The verified payment remains in the ledger.', 'Refund Outcome Recorded');
    } catch (error) {
      console.error('Refund processing outcome could not be recorded:', error);
      this.notificationService.show('error', 'Record the external outcome note and reference, then retry.', 'Refund Outcome Failed');
    }
  }

  async finalizeRefundLedger(paymentId: string): Promise<void> {
    const processing = this.refundProcessing[paymentId];
    if (processing?.status !== 'processed') return;
    await this.setPaymentStatus(paymentId, 'refunded', `External refund reference ${processing.reference}. ${processing.note}`);
  }

  downloadOrderFile(file: any): void {
    if (file?.dataUrl) {
      this.privateFileService.downloadLegacyDataUrl(file.dataUrl, file.name || 'uploaded-file.pdf');
    } else if (file?.storagePath) {
      void this.privateFileService.download(file.storagePath, file.name || 'uploaded-file.pdf');
    }
  }

  ngOnInit(): void {
    // URL se 'search' parameter nikalna
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchTerm = params['search'];
      }
    });

    this.fetchAllDetailedOrders();
    this.stopUsersListener = onValue(ref(this.db, 'users'), snapshot => {
      const users = snapshot.val() || {};
      this.deliveryAgents = Object.keys(users)
        .filter(uid => users[uid].role === 'Delivery' && users[uid].status === 'active')
        .map(uid => ({ uid, fullName: users[uid].fullName || users[uid].name || 'Delivery agent', email: users[uid].email || '' }));
      this.cdr.detectChanges();
    });
  }

  fetchAllDetailedOrders() {
    const ordersRef = ref(this.db, 'orders');

    onValue(ordersRef, async (snapshot) => {
      this.isLoading = true;
      const ordersData = snapshot.val();

      if (ordersData) {
        const rawOrders = Object.keys(ordersData).map(key => ({
          id: key,
          ...ordersData[key]
        }));

        // Har order ke liye user data fetch karna
        const detailedOrders = await Promise.all(
          rawOrders.map(async (order) => {
            const userKey = order.userId || order.uid || order.userUID || order.customerUID;
            let userDetails = null;

            if (userKey) {
              const userSnap = await get(ref(this.db, `users/${userKey}`));
              if (userSnap.exists()) {
                userDetails = userSnap.val();
              }
            }

            if (!userDetails) {
              userDetails = order.userDetails || {
                phone: order.phone || order.userPhone || order.contact?.phone,
                whatsapp: order.whatsapp || order.contact?.whatsapp,
                address: order.address || order.deliveryAddress || order.contact?.address,
                pincode: order.pincode || order.deliveryPincode || order.contact?.pincode
              };
            }

            return { ...order, userDetails };
          })
        );

        this.orders = detailedOrders.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.watchQuotations(this.orders);

        // 2. CRITICAL FIX: Data aane ke baad check karo search term hai ya nahi
        this.filterOrders();
      } else {
        this.orders = [];
        this.filteredOrders = [];
      }

      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  private watchQuotations(orders: any[]): void {
    for (const order of orders) {
      if (!order.uid || this.quotationSubscriptions.has(order.id)) continue;
      const unsubscribe = this.quotationService.watch(order.id, data => {
        this.quotations[order.id] = data;
        this.cdr.detectChanges();
      });
      this.quotationSubscriptions.set(order.id, unsubscribe);
      if (!this.paymentSubscriptions.has(order.id)) {
        this.paymentSubscriptions.set(order.id, this.paymentLedger.watchOrderPayments(order.id, payments => {
          this.payments[order.id] = payments;
          for (const payment of payments) this.watchPaymentDetails(payment.id);
          this.cdr.detectChanges();
        }));
      }
      if (!this.deliverySubscriptions.has(order.id)) {
        this.deliverySubscriptions.set(order.id, this.deliveryWorkflow.watchAssignment(order.id, assignment => {
          this.deliveryAssignments[order.id] = assignment;
          if (assignment?.agentUid) this.selectedDeliveryAgent[order.id] = assignment.agentUid;
          this.cdr.detectChanges();
        }));
      }
      if (!this.referralSubscriptions.has(order.id)) {
        this.referralSubscriptions.set(order.id, this.referralCommission.watchStudentAttribution(order.uid, attribution => {
          this.referralAttributions[order.uid] = attribution;
          this.cdr.detectChanges();
        }));
      }
      if (!this.commissionSubscriptions.has(order.id)) {
        this.commissionSubscriptions.set(order.id, this.referralCommission.watchOrderCommissions(order.id, records => {
          this.orderCommissions[order.id] = records;
          for (const record of records) this.watchCommissionHistory(record.id);
          this.cdr.detectChanges();
        }));
      }
    }
  }

  private watchCommissionHistory(commissionId: string): void {
    if (this.commissionHistorySubscriptions.has(commissionId)) return;
    this.commissionHistorySubscriptions.set(commissionId, this.referralCommission.watchCommissionHistory(commissionId, history => {
      this.commissionHistory[commissionId] = history;
      this.cdr.detectChanges();
    }));
  }

  private watchPaymentDetails(paymentId: string): void {
    if (!this.refundSubscriptions.has(paymentId)) {
      this.refundSubscriptions.set(paymentId, this.paymentLedger.watchRefund(paymentId, refund => {
        this.refunds[paymentId] = refund;
        this.cdr.detectChanges();
      }));
    }
    if (!this.paymentHistorySubscriptions.has(paymentId)) {
      this.paymentHistorySubscriptions.set(paymentId, this.paymentLedger.watchPaymentHistory(paymentId, history => {
        this.paymentHistory[paymentId] = history;
        this.cdr.detectChanges();
      }));
    }
    if (!this.refundHistorySubscriptions.has(paymentId)) {
      this.refundHistorySubscriptions.set(paymentId, this.paymentLedger.watchRefundHistory(paymentId, history => {
        this.refundHistory[paymentId] = history;
        this.cdr.detectChanges();
      }));
    }
    if (!this.refundProcessingSubscriptions.has(paymentId)) {
      this.refundProcessingSubscriptions.set(paymentId, this.paymentLedger.watchRefundProcessing(paymentId, processing => {
        this.refundProcessing[paymentId] = processing;
        this.cdr.detectChanges();
      }));
    }
    if (!this.refundProcessingHistorySubscriptions.has(paymentId)) {
      this.refundProcessingHistorySubscriptions.set(paymentId, this.paymentLedger.watchRefundProcessingHistory(paymentId, history => {
        this.refundProcessingHistory[paymentId] = history;
        this.cdr.detectChanges();
      }));
    }
  }

  ngOnDestroy(): void {
    this.quotationSubscriptions.forEach(unsubscribe => unsubscribe());
    this.quotationSubscriptions.clear();
    this.paymentSubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundSubscriptions.forEach(unsubscribe => unsubscribe());
    this.paymentHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundProcessingSubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundProcessingHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.deliverySubscriptions.forEach(unsubscribe => unsubscribe());
    this.referralSubscriptions.forEach(unsubscribe => unsubscribe());
    this.commissionSubscriptions.forEach(unsubscribe => unsubscribe());
    this.commissionHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.stopUsersListener?.();
  }

  filterOrders() {
    // Agar koi search term nahi hai, toh saare dikhao
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredOrders = [...this.orders];
    } else {
      const term = this.searchTerm.toLowerCase().trim();

      this.filteredOrders = this.orders.filter(order => {
        // Order ID check (Pure ID ya slice dono check karega)
        const orderId = (order.id + '').toLowerCase();
        const shortId = orderId.substring(1, 9); // Humne Manage orders me substring(1,9) bheja tha

        return orderId.includes(term) ||
          shortId.includes(term) ||
          (order.projectDetails?.submittedBy || '').toLowerCase().includes(term) ||
          (order.projectDetails?.rollNumber || '').toLowerCase().includes(term) ||
          (order.userDetails?.phone || '').includes(term);
      });
    }
    this.cdr.detectChanges();
  }
}

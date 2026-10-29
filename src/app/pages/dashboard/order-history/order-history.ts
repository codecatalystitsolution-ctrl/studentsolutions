import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core'; // ChangeDetectorRef add kiya
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
// Firebase Tools
import { Auth, authState } from '@angular/fire/auth';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { QuotationDecision, QuotationService, QuotationVersion } from '../../../services/quotation.service';
import { LedgerEvent, PaymentLedgerService, PaymentRecord, RefundProcessingRecord } from '../../../services/payment-ledger.service';
import { DeliveryAssignment, DeliveryWorkflowService } from '../../../services/delivery-workflow.service';
import { PricingConfigService, PaymentReceivingConfig } from '../../../services/pricing-config.service';
import { Database, ref, query, orderByChild, equalTo, limitToFirst, onValue, off, set } from '@angular/fire/database';

interface Order {
  fileType?: string;
  projectDetails?: any;
  subject?: any;
  printSettings?: any;
  pagesLabel?: any;
  createdAt?: string | number | Date;
  id: string;
  fileName?: string;
  fileSize?: string;
  printType?: string;
  bindingType?: string;
  totalPages?: number;
  copies?: number;
  totalCost?: number;
  status: string;
  orderDate?: string;
  uid?: string;
  studentID?: string;
  requestedPricing?: { estimatedAmount?: number; currency?: string };
  paymentDetails?: {
    status?: string;
    advanceAmount?: number;
    doorstepDue?: number;
    advancePaymentRef?: string;
    advanceUpiId?: string;
    advanceStatus?: string;
  };
  pricing?: any;
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, UpperCasePipe, FormsModule],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  isLoading = true; // Start mein loading true rahega
  private ordersRef: any;

  private db = inject(Database);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // UI force update tool
  private ngZone = inject(NgZone); // Angular zone for UI updates
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private quotationService = inject(QuotationService);
  private paymentLedger = inject(PaymentLedgerService);
  private deliveryWorkflow = inject(DeliveryWorkflowService);
  private pricingConfig = inject(PricingConfigService);
  paymentReceiving: PaymentReceivingConfig = this.pricingConfig.getDefaultPricing().paymentReceiving;
  private stopPricingListener: (() => void) | null = null;
  quotations: Record<string, { currentVersionId: string; versions: Record<string, QuotationVersion> }> = {};
  quotationDecisions: Record<string, Record<string, QuotationDecision | null>> = {};
  private quotationSubscriptions = new Map<string, () => void>();
  private decisionSubscriptions = new Map<string, () => void>();
  paymentsByOrder: Record<string, Array<PaymentRecord & { id: string }>> = {};
  paymentHistoryByPayment: Record<string, Record<string, LedgerEvent>> = {};
  refundsByPayment: Record<string, any> = {};
  refundProcessingByPayment: Record<string, RefundProcessingRecord | null> = {};
  refundHistoryByPayment: Record<string, Record<string, LedgerEvent>> = {};
  refundProcessingHistoryByPayment: Record<string, Record<string, LedgerEvent>> = {};
  paymentReference: Record<string, string> = {};
  paymentUpi: Record<string, string> = {};
  refundReason: Record<string, string> = {};
  private paymentSubscription: (() => void) | null = null;
  private refundSubscription: (() => void) | null = null;
  private paymentHistorySubscriptions = new Map<string, () => void>();
  private refundHistorySubscriptions = new Map<string, () => void>();
  private refundProcessingSubscriptions = new Map<string, () => void>();
  private refundProcessingHistorySubscriptions = new Map<string, () => void>();
  deliveryAssignments: Record<string, DeliveryAssignment | null> = {};
  deliveryHistory: Record<string, Record<string, any>> = {};
  readonly Math = Math;
  private deliverySubscriptions = new Map<string, () => void>();
  private deliveryHistorySubscriptions = new Map<string, () => void>();

  ngOnInit(): void {
    this.stopPricingListener = this.pricingConfig.watchPaymentReceiving(cfg => {
      this.paymentReceiving = cfg;
      this.cdr.detectChanges();
    });

    authState(this.auth).subscribe(user => {
      if (user) {
        const uid = user.uid; // Firebase Auth UID
        this.paymentSubscription?.();
        this.paymentSubscription = this.paymentLedger.watchStudentPayments(uid, payments => {
          this.paymentsByOrder = {};
          for (const payment of payments) {
            (this.paymentsByOrder[payment.orderId] ??= []).push(payment);
            if (!this.paymentHistorySubscriptions.has(payment.id)) {
              this.paymentHistorySubscriptions.set(payment.id, this.paymentLedger.watchPaymentHistory(payment.id, history => {
                this.paymentHistoryByPayment[payment.id] = history;
                this.cdr.detectChanges();
              }));
            }
            if (!this.refundHistorySubscriptions.has(payment.id)) {
              this.refundHistorySubscriptions.set(payment.id, this.paymentLedger.watchRefundHistory(payment.id, history => {
                this.refundHistoryByPayment[payment.id] = history;
                this.cdr.detectChanges();
              }));
            }
            if (!this.refundProcessingSubscriptions.has(payment.id)) {
              this.refundProcessingSubscriptions.set(payment.id, this.paymentLedger.watchRefundProcessing(payment.id, processing => {
                this.refundProcessingByPayment[payment.id] = processing;
                this.cdr.detectChanges();
              }));
            }
            if (!this.refundProcessingHistorySubscriptions.has(payment.id)) {
              this.refundProcessingHistorySubscriptions.set(payment.id, this.paymentLedger.watchRefundProcessingHistory(payment.id, history => {
                this.refundProcessingHistoryByPayment[payment.id] = history;
                this.cdr.detectChanges();
              }));
            }
          }
          this.cdr.detectChanges();
        });
        this.refundSubscription?.();
        this.refundSubscription = this.paymentLedger.watchStudentRefunds(uid, refunds => {
          this.refundsByPayment = {};
          for (const refund of Object.values(refunds)) {
            this.refundsByPayment[(refund as any).paymentId] = refund;
          }
          this.cdr.detectChanges();
        });

        // === NAYA STEP: Database se studentID (FC-XXXXXX) fetch karein ===
        const userRef = ref(this.db, `users/${uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().studentID) {
            const studentID = snapshot.val().studentID;
            // Fetch orders function ko dono IDs pass karein
            this.fetchOrdersLive(uid);
          } else {
            // Agar kisi wajah se studentID nahi hai, toh sirf Firebase UID pass karein
            this.fetchOrdersLive(uid);
          }
        }, { onlyOnce: true }); // onlyOnce true rakha hai taaki loop na bane

      } else {
        this.isLoading = false;
        this.router.navigate(['/login']);
      }
    });
  }

  // Ab ye function dono ID (Firebase UID aur FC-ID) accept karega
  fetchOrdersLive(userId: string): void {
    this.isLoading = true;
    this.ordersRef = query(ref(this.db, 'orders'), orderByChild('uid'), equalTo(userId), limitToFirst(100));

    onValue(this.ordersRef, (snapshot) => {
      this.ngZone.run(() => {
        const data = snapshot.val();
        this.orders = [];

        if (data) {
          this.orders = Object.keys(data).map(key => ({ id: key, ...data[key] })).filter((order: Order) => order.uid === userId).reverse();
          this.watchQuotations(this.orders);
        }

        this.isLoading = false;
      });

      this.cdr.detectChanges();

    }, (error) => {
      this.ngZone.run(() => {
        console.error("Firebase error:", error);
        this.isLoading = false;
      });
    });
  }

  private watchQuotations(orders: Order[]): void {
    for (const order of orders) {
      if (!order.uid) continue;
      if (!this.quotationSubscriptions.has(order.id)) {
        const unsubscribe = this.quotationService.watch(order.id, data => {
          this.quotations[order.id] = data;
          for (const versionId of Object.keys(data.versions)) {
            const key = `${order.id}/${versionId}`;
            if (this.decisionSubscriptions.has(key)) continue;
            this.decisionSubscriptions.set(key, this.quotationService.watchDecision(order.id, versionId, decision => {
              this.quotationDecisions[order.id] ??= {};
              this.quotationDecisions[order.id][versionId] = decision;
              this.cdr.detectChanges();
            }));
          }
          this.cdr.detectChanges();
        });
        this.quotationSubscriptions.set(order.id, unsubscribe);
      }
      if (!this.deliverySubscriptions.has(order.id)) {
        this.deliverySubscriptions.set(order.id, this.deliveryWorkflow.watchAssignment(order.id, assignment => {
          this.deliveryAssignments[order.id] = assignment;
          if (assignment && !this.deliveryHistorySubscriptions.has(order.id)) {
            this.deliveryHistorySubscriptions.set(order.id, this.deliveryWorkflow.watchHistory(order.id, history => {
              this.deliveryHistory[order.id] = history;
              this.cdr.detectChanges();
            }));
          }
          this.cdr.detectChanges();
        }));
      }
    }
  }

  async decideQuotation(orderId: string, versionId: string, status: QuotationDecision['status']): Promise<void> {
    try {
      await this.quotationService.decide(orderId, versionId, status);
      this.notificationService.show('success', `Quotation ${status}.`, 'Quotation Updated');
    } catch (error) {
      console.error('Could not record quotation decision:', error);
      this.notificationService.show('error', 'Your response could not be saved. Please refresh and try again.', 'Update Failed');
    }
  }

  async submitQuotedPayment(orderId: string, quoteVersionId: string): Promise<void> {
    try {
      await this.paymentLedger.submitPayment(orderId, quoteVersionId, this.paymentReference[orderId] || '', this.paymentUpi[orderId] || '');
      this.paymentReference[orderId] = '';
      this.paymentUpi[orderId] = '';
      this.notificationService.show('success', 'Payment details submitted for manual review. This does not verify that funds were received.', 'Payment Submitted');
    } catch (error) {
      console.error('Could not submit payment details:', error);
      this.notificationService.show('error', 'Payment details could not be submitted. Check the approved quotation and try again.', 'Payment Submission Failed');
    }
  }

  paymentForQuote(orderId: string, quoteVersionId: string): (PaymentRecord & { id: string }) | undefined {
    return this.paymentsByOrder[orderId]?.find(payment => payment.quoteVersionId === quoteVersionId);
  }

  async requestPaymentRefund(payment: PaymentRecord & { id: string }): Promise<void> {
    try {
      await this.paymentLedger.requestRefund(payment, this.refundReason[payment.id] || '');
      this.notificationService.show('success', 'Refund request sent to an administrator for review.', 'Refund Requested');
    } catch (error) {
      console.error('Could not request refund:', error);
      this.notificationService.show('error', 'Refund request could not be created.', 'Refund Request Failed');
    }
  }

  getCountByStatus(status: string): number {
    return this.orders.filter(o =>
      (o.status || '').toLowerCase() === status.toLowerCase()
    ).length;
  }

  get50AdvanceAmount(amount: number): number {
    return Math.round((amount || 0) * 0.5);
  }

  getAdvanceQrUrl(amount: number, orderId: string): string {
    const adv = this.get50AdvanceAmount(amount);
    return this.pricingConfig.getUpiPaymentUrl(adv, orderId, this.paymentReceiving);
  }

  getAdvanceQrImage(amount: number, orderId: string): string {
    const adv = this.get50AdvanceAmount(amount);
    return this.pricingConfig.getUpiQrImageUrl(adv, orderId, this.paymentReceiving);
  }

  async copyText(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notificationService.show('success', `${label} copied!`, 'Copied');
    } catch {
      this.notificationService.show('info', text, label);
    }
  }

  ngOnDestroy(): void {
    this.stopPricingListener?.();
    if (this.ordersRef) {
      off(this.ordersRef);
    }
    this.quotationSubscriptions.forEach(unsubscribe => unsubscribe());
    this.decisionSubscriptions.forEach(unsubscribe => unsubscribe());
    this.paymentSubscription?.();
    this.refundSubscription?.();
    this.paymentHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundProcessingSubscriptions.forEach(unsubscribe => unsubscribe());
    this.refundProcessingHistorySubscriptions.forEach(unsubscribe => unsubscribe());
    this.deliverySubscriptions.forEach(unsubscribe => unsubscribe());
    this.deliveryHistorySubscriptions.forEach(unsubscribe => unsubscribe());
  }

  // ==========================================
  // NAYE FUNCTIONS: CANCEL & EDIT ORDER
  // ==========================================

  async cancelOrder(orderId: string) {
    const confirmed = await this.confirmService.confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? This cannot be undone.',
      confirmText: 'Yes, Cancel',
      cancelText: 'Keep Order'
    });

    if (!confirmed) return;

    try {
      const requestRef = ref(this.db, 'cancellationRequests/' + orderId);
      await set(requestRef, { orderId, uid: this.auth.currentUser?.uid || '', reason: 'Cancellation requested by student', status: 'pending', createdAt: new Date().toISOString() });
      this.notificationService.show('success', 'Cancellation request sent to the support team.', 'Request sent');
    } catch (error) {
      console.error('Error cancelling order:', error);
      this.notificationService.show('error', 'Failed to cancel order. Please check your connection.', 'Cancel Failed');
    }
  }

  editOrder(order: any) {
    this.router.navigate(['/dashboard/new-order'], { queryParams: { editId: order.id } });
  }

}

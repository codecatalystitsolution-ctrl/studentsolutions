import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { PaymentLedgerService, PaymentRecord } from '../../../services/payment-ledger.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { AuthService } from '../../../services/auth.service';

export interface DisplayPayment extends PaymentRecord {
  id: string;
}

export interface DisplayPayoutRequest {
  id: string;
  uid: string;
  applicantName: string;
  applicantEmail: string;
  phone?: string;
  role: string;
  amount: number;
  method: string;
  details: {
    upiId?: string;
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
    phone?: string;
  };
  notes?: string;
  status: 'pending' | 'disbursed' | 'rejected' | string;
  createdAt: string;
  disbursedAt?: string;
  transactionRef?: string;
  disbursedNote?: string;
  rejectionReason?: string;
}

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss']
})
export class AdminPaymentsComponent implements OnInit, OnDestroy {
  private db = inject(Database, { optional: true });
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentLedgerService);
  private notification = inject(NotificationService);
  private csvExport = inject(CsvExportService);
  private confirm = inject(ConfirmService);
  private authService = inject(AuthService, { optional: true });
  private route = inject(ActivatedRoute, { optional: true });

  activeTab: 'orders' | 'payouts' = 'orders';

  // Student Payments
  payments: DisplayPayment[] = [];
  filteredPayments: DisplayPayment[] = [];
  isLoading = true;
  isRefreshing = false;

  // Filters for Payments
  searchTerm = '';
  statusFilter = '';
  dateFilter: 'all' | 'today' | 'week' | 'month' = 'all';

  // Stats for Payments
  totalCollected = 0;
  pendingCount = 0;
  verifiedCount = 0;
  rejectedCount = 0;
  refundedCount = 0;

  // Pagination for Payments (15 per page)
  currentPage = 1;
  readonly pageSize = 15;

  // Verification dialog for Payments
  selectedPayment: DisplayPayment | null = null;
  decisionAction: 'verify' | 'reject' | 'refund' = 'verify';
  decisionNote = '';
  isSubmittingDecision = false;

  // Partner Payouts
  payouts: DisplayPayoutRequest[] = [];
  filteredPayouts: DisplayPayoutRequest[] = [];
  isPayoutsLoading = true;

  // Filters for Payouts
  payoutSearchTerm = '';
  payoutRoleFilter = '';
  payoutStatusFilter = '';

  // Stats for Payouts
  pendingPayoutsTotal = 0;
  pendingPayoutsCount = 0;
  disbursedPayoutsTotal = 0;
  disbursedPayoutsCount = 0;
  rejectedPayoutsCount = 0;

  // Payout Decision Modal
  selectedPayout: DisplayPayoutRequest | null = null;
  payoutAction: 'disburse' | 'reject' = 'disburse';
  payoutTxnRef = '';
  payoutAdminNote = '';
  payoutRejectionReason = '';
  isSubmittingPayoutDecision = false;

  private paymentsListener: any;
  private usersListener: any;

  ngOnInit(): void {
    if (this.route) {
      this.route.queryParams.subscribe(params => {
        if (params['tab'] === 'payouts') {
          this.activeTab = 'payouts';
        }
      });
    }
    this.fetchPayments();
    this.fetchPayouts();
  }

  fetchPayments(): void {
    if (!this.db) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    try {
      const paymentsRef = ref(this.db, 'payments');
      this.paymentsListener = onValue(
        paymentsRef,
        snapshot => {
          const data = snapshot.val() || {};
          this.processPayments(data);
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.detectChanges();
        },
        error => {
          console.error('Failed to load payments:', error);
          this.notification.show('error', 'Unable to fetch payments from database.', 'Error');
          this.isLoading = false;
          this.isRefreshing = false;
          this.cdr.detectChanges();
        }
      );
    } catch (err) {
      console.warn('Error reading payments:', err);
      this.isLoading = false;
    }
  }

  fetchPayouts(): void {
    if (!this.db) {
      this.isPayoutsLoading = false;
      return;
    }
    this.isPayoutsLoading = true;
    try {
      const usersRef = ref(this.db, 'users');
      this.usersListener = onValue(
        usersRef,
        snapshot => {
          const usersData = snapshot.val() || {};
          this.processPayouts(usersData);
          this.isPayoutsLoading = false;
          this.cdr.detectChanges();
        },
        error => {
          console.error('Failed to load partner payouts:', error);
          this.isPayoutsLoading = false;
          this.cdr.detectChanges();
        }
      );
    } catch (err) {
      console.warn('Error reading payouts:', err);
      this.isPayoutsLoading = false;
    }
  }

  async refresh(): Promise<void> {
    if (!this.db) return;
    this.isRefreshing = true;
    try {
      const [paymentsSnap, usersSnap] = await Promise.all([
        get(ref(this.db, 'payments')),
        get(ref(this.db, 'users'))
      ]);
      this.processPayments(paymentsSnap.val() || {});
      this.processPayouts(usersSnap.val() || {});
      this.notification.show('success', 'Financial records refreshed.', 'Refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      this.notification.show('error', 'Could not refresh financial records.', 'Error');
    } finally {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }
  }

  private processPayments(data: Record<string, any>): void {
    this.payments = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    }));

    this.payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    this.totalCollected = 0;
    this.pendingCount = 0;
    this.verifiedCount = 0;
    this.rejectedCount = 0;
    this.refundedCount = 0;

    for (const p of this.payments) {
      if (p.status === 'verified') {
        this.totalCollected += Number(p.amount) || 0;
        this.verifiedCount++;
      } else if (p.status === 'pending') {
        this.pendingCount++;
      } else if (p.status === 'rejected') {
        this.rejectedCount++;
      } else if (p.status === 'refunded') {
        this.refundedCount++;
      }
    }

    this.filterPayments();
  }

  private processPayouts(usersData: Record<string, any>): void {
    const list: DisplayPayoutRequest[] = [];
    Object.keys(usersData).forEach(uid => {
      const u = usersData[uid];
      if (u && u.payoutRequests) {
        Object.keys(u.payoutRequests).forEach(reqId => {
          const req = u.payoutRequests[reqId];
          if (req) {
            list.push({
              id: reqId,
              uid,
              applicantName: req.applicantName || u.fullName || u.displayName || (u.role === 'Teacher' ? 'Teacher Partner' : 'Delivery Driver'),
              applicantEmail: req.applicantEmail || u.email || '',
              phone: req.phone || u.phone || req.details?.phone || '',
              role: req.role || u.role || 'Partner',
              amount: Number(req.amount) || 0,
              method: req.method || 'upi',
              details: req.details || u.payoutDetails || {},
              notes: req.notes || '',
              status: req.status || 'pending',
              createdAt: req.createdAt || '',
              disbursedAt: req.disbursedAt,
              transactionRef: req.transactionRef,
              disbursedNote: req.disbursedNote,
              rejectionReason: req.rejectionReason
            });
          }
        });
      }
    });

    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    this.payouts = list;

    this.pendingPayoutsTotal = 0;
    this.pendingPayoutsCount = 0;
    this.disbursedPayoutsTotal = 0;
    this.disbursedPayoutsCount = 0;
    this.rejectedPayoutsCount = 0;

    for (const pr of this.payouts) {
      if (pr.status === 'pending') {
        this.pendingPayoutsTotal += pr.amount;
        this.pendingPayoutsCount++;
      } else if (pr.status === 'disbursed') {
        this.disbursedPayoutsTotal += pr.amount;
        this.disbursedPayoutsCount++;
      } else if (pr.status === 'rejected') {
        this.rejectedPayoutsCount++;
      }
    }

    this.filterPayouts();
  }

  filterPayments(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const status = this.statusFilter.toLowerCase();
    const dateRange = this.dateFilter;

    this.filteredPayments = this.payments.filter(p => {
      const refMatch = (p.transactionRef || p.id || '').toLowerCase().includes(term);
      const orderMatch = (p.orderId || '').toLowerCase().includes(term);
      const studentMatch = (p.uid || '').toLowerCase().includes(term);
      const upiMatch = (p.upiId || '').toLowerCase().includes(term);
      const matchesTerm = !term || refMatch || orderMatch || studentMatch || upiMatch;

      const matchesStatus = !status || (p.status || 'pending').toLowerCase() === status;
      const matchesDate = this.matchesDateRange(p.createdAt, dateRange);

      return matchesTerm && matchesStatus && matchesDate;
    });

    this.currentPage = 1;
  }

  filterPayouts(): void {
    const term = this.payoutSearchTerm.toLowerCase().trim();
    const role = this.payoutRoleFilter.toLowerCase();
    const status = this.payoutStatusFilter.toLowerCase();

    this.filteredPayouts = this.payouts.filter(p => {
      const nameMatch = (p.applicantName || '').toLowerCase().includes(term);
      const emailMatch = (p.applicantEmail || '').toLowerCase().includes(term);
      const idMatch = (p.id || '').toLowerCase().includes(term);
      const upiMatch = (p.details?.upiId || '').toLowerCase().includes(term);
      const acctMatch = (p.details?.accountNumber || '').toLowerCase().includes(term);
      const matchesTerm = !term || nameMatch || emailMatch || idMatch || upiMatch || acctMatch;

      const matchesRole = !role || (p.role || '').toLowerCase() === role;
      const matchesStatus = !status || (p.status || 'pending').toLowerCase() === status;

      return matchesTerm && matchesRole && matchesStatus;
    });
  }

  matchesDateRange(dateStr: string, range: string): boolean {
    if (range === 'all' || !dateStr) return true;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return true;

    const now = new Date();
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return time >= startOfDay;
    }
    if (range === 'week') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
      return time >= startOfWeek;
    }
    if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return time >= startOfMonth;
    }
    return true;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPayments.length / this.pageSize));
  }

  get paginatedPayments(): DisplayPayment[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredPayments.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  exportCsv(): void {
    const today = new Date().toISOString().slice(0, 10);
    const columns = [
      { key: 'transactionRef', label: 'Transaction Reference' },
      { key: 'orderId', label: 'Order ID', format: (id: string) => (id ? id.slice(0, 8) : 'N/A') },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'upiId', label: 'Payment Method / UPI', format: (u: string) => u || 'N/A' },
      { key: 'status', label: 'Verification Status', format: (s: string) => (s || 'pending').toUpperCase() },
      { key: 'createdAt', label: 'Submitted Date', format: (d: string) => (d ? new Date(d).toLocaleString() : '') },
      { key: 'verifiedBy', label: 'Verified By', format: (v: string) => v || 'N/A' },
      { key: 'verificationNote', label: 'Decision Note', format: (n: string) => n || 'N/A' }
    ];

    const success = this.csvExport.exportToCsv(`payments_${today}.csv`, columns, this.filteredPayments);
    if (success) {
      this.notification.show('success', `Exported ${this.filteredPayments.length} payment records.`, 'CSV Export');
    }
  }

  exportPayoutsCsv(): void {
    const today = new Date().toISOString().slice(0, 10);
    const columns = [
      { key: 'id', label: 'Payout Request ID' },
      { key: 'applicantName', label: 'Partner Name' },
      { key: 'role', label: 'Role' },
      { key: 'applicantEmail', label: 'Email' },
      { key: 'amount', label: 'Amount (INR)' },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Request Date', format: (d: string) => (d ? new Date(d).toLocaleString() : '') },
      { key: 'transactionRef', label: 'Disbursement Reference', format: (r: string) => r || 'N/A' }
    ];

    const success = this.csvExport.exportToCsv(`partner_payouts_${today}.csv`, columns, this.filteredPayouts);
    if (success) {
      this.notification.show('success', `Exported ${this.filteredPayouts.length} payout records.`, 'CSV Export');
    }
  }

  openDecisionModal(payment: DisplayPayment, action: 'verify' | 'reject' | 'refund'): void {
    this.selectedPayment = payment;
    this.decisionAction = action;
    this.decisionNote = '';
  }

  closeDecisionModal(): void {
    this.selectedPayment = null;
    this.decisionNote = '';
    this.isSubmittingDecision = false;
  }

  async submitDecision(): Promise<void> {
    if (!this.selectedPayment) return;
    const note = this.decisionNote.trim();
    if (!note) {
      this.notification.show('warning', 'Please provide a decision note or reference.', 'Note Required');
      return;
    }

    this.isSubmittingDecision = true;
    const targetStatus = this.decisionAction === 'verify' ? 'verified' : this.decisionAction === 'reject' ? 'rejected' : 'refunded';

    try {
      await this.paymentService.updatePaymentStatus(this.selectedPayment.id, targetStatus, note);
      this.notification.show('success', `Payment marked as ${targetStatus}.`, 'Status Updated');
      this.closeDecisionModal();
      await this.refresh();
    } catch (err: any) {
      console.error('Failed to update payment status:', err);
      this.notification.show('error', err?.message || 'Unable to update payment status.', 'Decision Failed');
    } finally {
      this.isSubmittingDecision = false;
      this.cdr.detectChanges();
    }
  }

  // Payout Dialog Actions
  openPayoutModal(payout: DisplayPayoutRequest, action: 'disburse' | 'reject'): void {
    this.selectedPayout = payout;
    this.payoutAction = action;
    this.payoutTxnRef = '';
    this.payoutAdminNote = '';
    this.payoutRejectionReason = '';
  }

  closePayoutModal(): void {
    this.selectedPayout = null;
    this.payoutTxnRef = '';
    this.payoutAdminNote = '';
    this.payoutRejectionReason = '';
    this.isSubmittingPayoutDecision = false;
  }

  async submitPayoutDecision(): Promise<void> {
    if (!this.selectedPayout || !this.authService) return;

    if (this.payoutAction === 'disburse') {
      const refNum = this.payoutTxnRef.trim();
      if (!refNum) {
        this.notification.show('warning', 'Please provide a bank UTR / UPI transaction reference.', 'Reference Required');
        return;
      }
      this.isSubmittingPayoutDecision = true;
      try {
        await this.authService.updatePayoutRequestStatus(
          this.selectedPayout.id,
          this.selectedPayout.uid,
          'disbursed',
          { transactionRef: refNum, note: this.payoutAdminNote.trim() }
        );
        this.notification.show(
          'success',
          `Payout of \u20B9${this.selectedPayout.amount} marked disbursed to ${this.selectedPayout.applicantName}.`,
          'Disbursement Complete'
        );
        this.closePayoutModal();
        await this.refresh();
      } catch (err: any) {
        console.error('Failed to disburse payout:', err);
        this.notification.show('error', err?.message || 'Could not update payout status.', 'Disbursement Error');
      } finally {
        this.isSubmittingPayoutDecision = false;
        this.cdr.detectChanges();
      }
    } else {
      const reason = this.payoutRejectionReason.trim();
      if (!reason) {
        this.notification.show('warning', 'Please specify the rejection reason for the partner.', 'Reason Required');
        return;
      }
      this.isSubmittingPayoutDecision = true;
      try {
        await this.authService.updatePayoutRequestStatus(
          this.selectedPayout.id,
          this.selectedPayout.uid,
          'rejected',
          { rejectionReason: reason }
        );
        this.notification.show(
          'info',
          `Payout request ${this.selectedPayout.id} rejected. Reason recorded for partner.`,
          'Payout Rejected'
        );
        this.closePayoutModal();
        await this.refresh();
      } catch (err: any) {
        console.error('Failed to reject payout:', err);
        this.notification.show('error', err?.message || 'Could not reject payout.', 'Rejection Error');
      } finally {
        this.isSubmittingPayoutDecision = false;
        this.cdr.detectChanges();
      }
    }
  }

  async copyToClipboard(text: string, label: string): Promise<void> {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.notification.show('success', `${label} copied to clipboard!`, 'Copied');
    } catch {
      this.notification.show('info', text, label);
    }
  }

  shortId(id: string): string {
    return id?.startsWith('-') ? id.slice(1, 9) : (id || '').slice(0, 8);
  }

  ngOnDestroy(): void {
    if (this.paymentsListener) {
      this.paymentsListener();
    }
    if (this.usersListener) {
      this.usersListener();
    }
  }
}

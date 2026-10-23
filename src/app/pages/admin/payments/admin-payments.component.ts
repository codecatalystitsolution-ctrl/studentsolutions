import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { PaymentLedgerService, PaymentRecord } from '../../../services/payment-ledger.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';

export interface DisplayPayment extends PaymentRecord {
  id: string;
}

@Component({
  selector: 'app-admin-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-payments.component.html',
  styleUrls: ['./admin-payments.component.scss']
})
export class AdminPaymentsComponent implements OnInit, OnDestroy {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private paymentService = inject(PaymentLedgerService);
  private notification = inject(NotificationService);
  private csvExport = inject(CsvExportService);
  private confirm = inject(ConfirmService);

  payments: DisplayPayment[] = [];
  filteredPayments: DisplayPayment[] = [];
  isLoading = true;
  isRefreshing = false;

  // Filters
  searchTerm = '';
  statusFilter = '';
  dateFilter: 'all' | 'today' | 'week' | 'month' = 'all';

  // Stats
  totalCollected = 0;
  pendingCount = 0;
  verifiedCount = 0;
  rejectedCount = 0;
  refundedCount = 0;

  // Pagination (Default: 15 per page per PRD 7.6)
  currentPage = 1;
  readonly pageSize = 15;

  // Verification dialog
  selectedPayment: DisplayPayment | null = null;
  decisionAction: 'verify' | 'reject' | 'refund' = 'verify';
  decisionNote = '';
  isSubmittingDecision = false;

  private paymentsListener: any;

  ngOnInit(): void {
    this.fetchPayments();
  }

  fetchPayments(): void {
    this.isLoading = true;
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
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'payments'));
      this.processPayments(snapshot.val() || {});
      this.notification.show('success', 'Payments ledger refreshed.', 'Refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      this.notification.show('error', 'Could not refresh payments.', 'Error');
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

    // Sort newest first
    this.payments.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Compute stats
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

  shortId(id: string): string {
    return id?.startsWith('-') ? id.slice(1, 9) : (id || '').slice(0, 8);
  }

  ngOnDestroy(): void {
    if (this.paymentsListener) {
      this.paymentsListener();
    }
  }
}

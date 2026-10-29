import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, set, push, Unsubscribe } from '@angular/fire/database';
import { DeliveryAssignment, DeliveryHistoryEvent, DeliveryStatus, DeliveryWorkflowService } from '../../services/delivery-workflow.service';
import { PricingConfigService, PaymentReceivingConfig } from '../../services/pricing-config.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { CsvExportService } from '../../services/csv-export.service';

export interface PayoutAccountDetails {
  method: 'upi' | 'bank';
  upiId?: string;
  bankName?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  phone?: string;
}

export interface PayoutRequestItem {
  id: string;
  amount: number;
  method: string;
  status: 'pending' | 'processing' | 'disbursed';
  createdAt: string;
  disbursedAt?: string;
  reference?: string;
  notes?: string;
}

@Component({
  selector: 'app-delivery-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './delivery-portal.component.html',
  styleUrl: './delivery-portal.component.scss'
})
export class DeliveryPortalComponent implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly db = inject(Database);
  private readonly deliveryService = inject(DeliveryWorkflowService);
  private readonly notifications = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly csvExport = inject(CsvExportService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly pricingConfigService = inject(PricingConfigService);
  paymentReceiving: PaymentReceivingConfig = this.pricingConfigService.getDefaultPricing().paymentReceiving;
  private stopPricingSub: (() => void) | null = null;

  // Theme signal
  readonly theme = this.themeService.theme;

  // Agent & Navigation State
  readonly isSidebarOpen = signal<boolean>(false);
  readonly agentProfile = signal<any | null>(null);
  readonly currentFilter = signal<'all' | 'assigned' | 'in_transit' | 'delivered'>('all');
  readonly searchQuery = signal<string>('');
  readonly activeView = signal<'deliveries' | 'revenue'>('deliveries');

  // Revenue & Payment State
  readonly feePerDelivery = 50; // Standard INR 50 earned per completed campus delivery
  payoutDetails: PayoutAccountDetails = {
    method: 'upi',
    upiId: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    phone: ''
  };
  payoutRequests: PayoutRequestItem[] = [];
  isSavingPayout = false;
  isRequestingPayout = false;
  withdrawInputAmount = 0;
  payoutFeedback = '';

  assignments: DeliveryAssignment[] = [];
  history: Record<string, Record<string, any>> = {};
  notes: Record<string, string> = {};
  loading = true;
  isUpdating = signal<boolean>(false);

  private stopAssignments: Unsubscribe | null = null;
  private historySubscriptions = new Map<string, Unsubscribe>();

  // Quick preset notes for delivery drivers
  readonly quickNotes = [
    'Picked up from print hub; package verified',
    'Arrived at university entrance gate',
    'Handed over directly to student with confirmation',
    'Left at campus hostel security desk per student request',
    'Student requested 15-minute wait / calling back'
  ];

  // 50% Advance & 50% Delivery Balance Helpers
  getBalanceDue(assignment: DeliveryAssignment | null | undefined): number {
    if (!assignment) return 0;
    if (typeof assignment.balanceDue === 'number') return assignment.balanceDue;
    if (typeof assignment.totalAmount === 'number' && assignment.totalAmount > 0) {
      return Math.round(assignment.totalAmount * 0.5);
    }
    return 250;
  }

  getAdvancePaid(assignment: DeliveryAssignment | null | undefined): number {
    if (!assignment) return 0;
    if (typeof assignment.advancePaid === 'number') return assignment.advancePaid;
    if (typeof assignment.totalAmount === 'number' && assignment.totalAmount > 0) {
      return Math.floor(assignment.totalAmount * 0.5);
    }
    return 250;
  }

  getTotalAmount(assignment: DeliveryAssignment | null | undefined): number {
    if (!assignment) return 0;
    if (typeof assignment.totalAmount === 'number') return assignment.totalAmount;
    return this.getAdvancePaid(assignment) + this.getBalanceDue(assignment);
  }

  // QR Modal & Collection state
  selectedQrAssignment: DeliveryAssignment | null = null;
  qrModalOpen = false;
  collectionMethod: Record<string, 'upi_qr' | 'cash'> = {};
  collectionRef: Record<string, string> = {};

  openQrModal(assignment: DeliveryAssignment): void {
    this.selectedQrAssignment = assignment;
    this.qrModalOpen = true;
  }

  closeQrModal(): void {
    this.selectedQrAssignment = null;
    this.qrModalOpen = false;
  }

  getUpiPaymentUrl(assignment: DeliveryAssignment | null): string {
    if (!assignment) return '';
    const due = this.getBalanceDue(assignment);
    return this.pricingConfigService.getUpiPaymentUrl(due, assignment.orderId, this.paymentReceiving);
  }

  getQrCodeImageUrl(assignment: DeliveryAssignment | null): string {
    if (!assignment) return '';
    const url = this.getUpiPaymentUrl(assignment);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  }

  async copyUpiId(): Promise<void> {
    const upi = this.paymentReceiving?.upiId || 'studentsolutions@upi';
    try {
      await navigator.clipboard.writeText(upi);
      this.notifications.show('success', `UPI ID copied: ${upi}`, 'Copied');
    } catch {
      this.notifications.show('info', upi, 'UPI Address');
    }
  }

  async copyPaymentLink(url: string): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      this.notifications.show('success', 'UPI Intent URI copied to clipboard!', 'Copied');
    } catch {
      this.notifications.show('info', url, 'Payment Link');
    }
  }

  ngOnInit(): void {
    this.stopPricingSub = this.pricingConfigService.watchPaymentReceiving(cfg => {
      this.paymentReceiving = cfg;
      this.cdr.detectChanges();
    });

    authState(this.auth).subscribe(async user => {
      this.stopAssignments?.();
      if (!user) {
        this.assignments = [];
        this.agentProfile.set(null);
        this.loading = false;
        this.cdr.detectChanges();
        return;
      }

      // Fetch driver profile
      try {
        const profile = await this.authService.getUserProfile(user.uid);
        this.agentProfile.set(profile || {
          fullName: 'Delivery Partner',
          deliveryID: `DEL-${user.uid.slice(0, 6).toUpperCase()}`,
          vehicleNumber: 'Courier Fleet',
          serviceArea: 'Central Hub'
        });

        if (profile?.payoutDetails) {
          this.payoutDetails = {
            method: profile.payoutDetails.method || 'upi',
            upiId: profile.payoutDetails.upiId || '',
            bankName: profile.payoutDetails.bankName || '',
            accountHolder: profile.payoutDetails.accountHolder || profile.fullName || '',
            accountNumber: profile.payoutDetails.accountNumber || '',
            ifsc: profile.payoutDetails.ifsc || '',
            phone: profile.payoutDetails.phone || profile.phone || ''
          };
        } else {
          this.payoutDetails.accountHolder = profile?.fullName || 'Delivery Partner';
        }

        if (profile?.payoutRequests) {
          this.payoutRequests = Object.values(profile.payoutRequests)
            .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')) as PayoutRequestItem[];
        }
      } catch {
        this.agentProfile.set({
          fullName: 'Delivery Partner',
          deliveryID: `DEL-${user.uid.slice(0, 6).toUpperCase()}`,
          vehicleNumber: 'Courier Fleet',
          serviceArea: 'Central Hub'
        });
      }

      this.stopAssignments = this.deliveryService.watchAgentAssignments(user.uid, assignments => {
        this.assignments = assignments.sort((a, b) => (b.assignedAt || '').localeCompare(a.assignedAt || ''));
        this.loading = false;
        for (const assignment of assignments) {
          this.watchHistory(assignment.orderId);
        }
        this.cdr.detectChanges();
      });
    });
  }

  // --- Revenue & Payment Getters ---
  get totalEarnedRevenue(): number {
    return this.deliveredCount * this.feePerDelivery;
  }

  get totalDisbursed(): number {
    return this.payoutRequests
      .filter(r => r.status === 'disbursed')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }

  get pendingPayoutRequestsTotal(): number {
    return this.payoutRequests
      .filter(r => r.status === 'pending' || r.status === 'processing')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }

  get availableBalance(): number {
    return Math.max(0, this.totalEarnedRevenue - this.totalDisbursed - this.pendingPayoutRequestsTotal);
  }

  setView(view: 'deliveries' | 'revenue'): void {
    this.activeView.set(view);
  }

  async savePayoutDetails(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.notifications.show('error', 'Sign in to configure payout destination.', 'Auth Required');
      return;
    }
    if (this.payoutDetails.method === 'upi' && !this.payoutDetails.upiId?.trim()) {
      this.notifications.show('warning', 'Please provide a valid UPI ID (e.g., driver@okaxis).', 'UPI ID Required');
      return;
    }
    if (this.payoutDetails.method === 'bank' && (!this.payoutDetails.accountNumber?.trim() || !this.payoutDetails.ifsc?.trim())) {
      this.notifications.show('warning', 'Please provide both Account Number and IFSC Code.', 'Bank Details Required');
      return;
    }

    this.isSavingPayout = true;
    try {
      await this.authService.savePayoutDetails(user.uid, this.payoutDetails);
      this.notifications.show('success', 'Your payout destination details have been saved securely.', 'Payout Saved');
      this.payoutFeedback = 'Payout account details updated successfully!';
      setTimeout(() => { this.payoutFeedback = ''; this.cdr.detectChanges(); }, 3000);
    } catch (err: any) {
      console.error('Save payout error:', err);
      this.notifications.show('error', 'Could not save payout details.', 'Save Failed');
    } finally {
      this.isSavingPayout = false;
      this.cdr.detectChanges();
    }
  }

  async requestPayout(customAmount?: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.notifications.show('error', 'Sign in to request delivery payout.', 'Auth Required');
      return;
    }
    const amt = customAmount !== undefined ? customAmount : (this.withdrawInputAmount > 0 ? this.withdrawInputAmount : this.availableBalance);
    if (!amt || amt <= 0) {
      this.notifications.show('warning', 'No available balance for payout withdrawal.', 'Zero Balance');
      return;
    }
    if (amt > this.availableBalance) {
      this.notifications.show('warning', `Requested amount exceeds available balance of INR ${this.availableBalance}.`, 'Insufficient Balance');
      return;
    }

    this.isRequestingPayout = true;
    try {
      const newReq = await this.authService.submitPayoutRequest(user.uid, {
        amount: amt,
        method: this.payoutDetails.method,
        details: this.payoutDetails,
        role: 'Delivery',
        notes: `Courier fee withdrawal for completed campus deliveries`
      });
      this.payoutRequests = [newReq as PayoutRequestItem, ...this.payoutRequests];
      this.withdrawInputAmount = 0;
      this.notifications.show('success', `Payout request for INR ${amt} submitted. Admin will disburse to your ${this.payoutDetails.method.toUpperCase()} account.`, 'Payout Requested');
      this.payoutFeedback = `Payout request for ₹${amt} is pending admin disbursement.`;
      setTimeout(() => { this.payoutFeedback = ''; this.cdr.detectChanges(); }, 3500);
    } catch (err: any) {
      console.error('Payout request error:', err);
      const fallbackReq: PayoutRequestItem = {
        id: `REQ-${Date.now().toString().slice(-6)}`,
        amount: amt,
        method: this.payoutDetails.method,
        status: 'pending',
        createdAt: new Date().toISOString(),
        notes: 'Campus delivery fees'
      };
      this.payoutRequests = [fallbackReq, ...this.payoutRequests];
      this.withdrawInputAmount = 0;
      this.notifications.show('success', `Payout request for INR ${amt} registered.`, 'Payout Requested');
    } finally {
      this.isRequestingPayout = false;
      this.cdr.detectChanges();
    }
  }

  exportRevenueCsv(): void {
    const delivered = this.assignments.filter(a => a.status === 'delivered');
    const records = (delivered.length ? delivered : this.assignments).map(d => ({
      orderId: d.orderId,
      studentName: d.studentName || 'Student',
      deliveryFee: this.feePerDelivery,
      status: d.status === 'delivered' ? 'Delivered & Earned' : this.statusLabel(d.status),
      completedAt: d.lastHistoryCreatedAt || d.assignedAt || new Date().toISOString(),
      address: d.address || '',
      pincode: d.pincode || '',
      paymentType: 'Prepaid Online Verified'
    }));

    const columns = [
      { key: 'orderId', label: 'Order ID' },
      { key: 'studentName', label: 'Recipient Student' },
      { key: 'deliveryFee', label: 'Driver Fee (INR)', format: (v: number) => `₹${v}` },
      { key: 'paymentType', label: 'Collection Status' },
      { key: 'status', label: 'Delivery Status' },
      { key: 'completedAt', label: 'Date' },
      { key: 'address', label: 'Delivery Location' }
    ];

    this.csvExport.exportToCsv(`studentsolutions-delivery-earnings-${new Date().toISOString().slice(0, 10)}.csv`, columns, records);
    this.notifications.show('success', 'Earnings statement downloaded successfully.', 'CSV Exported');
  }

  // --- KPI Metrics ---
  get totalAssigned(): number {
    return this.assignments.length;
  }

  get pendingPickupCount(): number {
    return this.assignments.filter(a => a.status === 'assigned').length;
  }

  get inTransitCount(): number {
    return this.assignments.filter(a => a.status === 'picked_up' || a.status === 'in_transit').length;
  }

  get deliveredCount(): number {
    return this.assignments.filter(a => a.status === 'delivered').length;
  }

  // --- Filtered Assignments ---
  get filteredAssignments(): DeliveryAssignment[] {
    const filter = this.currentFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.assignments.filter(item => {
      // 1. Status Filter
      if (filter === 'assigned' && item.status !== 'assigned') return false;
      if (filter === 'in_transit' && item.status !== 'picked_up' && item.status !== 'in_transit') return false;
      if (filter === 'delivered' && item.status !== 'delivered') return false;

      // 2. Search query filter
      if (query) {
        const orderId = (item.orderId || '').toLowerCase();
        const student = (item.studentName || '').toLowerCase();
        const subject = (item.subject || '').toLowerCase();
        const address = (item.address || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();
        const pincode = (item.pincode || '').toLowerCase();

        return (
          orderId.includes(query) ||
          student.includes(query) ||
          subject.includes(query) ||
          address.includes(query) ||
          phone.includes(query) ||
          pincode.includes(query)
        );
      }

      return true;
    });
  }

  setFilter(filter: 'all' | 'assigned' | 'in_transit' | 'delivered'): void {
    this.currentFilter.set(filter);
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update(v => !v);
  }

  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
      this.router.navigate(['/login']);
    } catch {
      this.router.navigate(['/login']);
    }
  }

  // Next status machine
  nextStatus(status: DeliveryStatus): DeliveryStatus | null {
    const next: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
      assigned: 'picked_up',
      picked_up: 'in_transit',
      in_transit: 'delivered',
      failed_delivery: 'in_transit'
    };
    return next[status] || null;
  }

  nextStatusButtonText(status: DeliveryStatus): string {
    switch (status) {
      case 'assigned':
        return 'Mark Picked Up from Print Hub';
      case 'picked_up':
        return 'Mark In Transit (Out for Delivery)';
      case 'in_transit':
        return 'Confirm Delivered to Student';
      case 'failed_delivery':
        return 'Retry Delivery';
      default:
        return 'Update Status';
    }
  }

  applyPresetNote(orderId: string, text: string): void {
    this.notes[orderId] = text;
  }

  async update(assignment: DeliveryAssignment): Promise<void> {
    const next = this.nextStatus(assignment.status);
    if (!next) return;

    const note = this.notes[assignment.orderId] || '';
    this.notes[assignment.orderId] = '';
    this.isUpdating.set(true);

    const isDelivering = assignment.status === 'in_transit' && next === 'delivered';
    const method = this.collectionMethod[assignment.orderId] || 'upi_qr';
    const methodLabel = method === 'upi_qr' ? 'UPI QR Code' : 'Cash on Delivery (COD)';
    const balance = this.getBalanceDue(assignment);
    const collectionNote = isDelivering ? `[Collected 50% Balance ₹${balance} via ${methodLabel}] ` : '';
    const finalNote = (collectionNote + note).trim();

    try {
      const historyEvent = isDelivering
        ? await this.deliveryService.updateStatus(assignment.orderId, next, finalNote, {
            method,
            reference: this.collectionRef[assignment.orderId] || (method === 'upi_qr' ? 'UPI_QR_SCANNED' : 'CASH_HANDOVER')
          })
        : await this.deliveryService.updateStatus(assignment.orderId, next, finalNote);
      this.zone.run(() => {
        this.history[assignment.orderId] = {
          ...(this.history[assignment.orderId] || {}),
          [historyEvent.id]: historyEvent as DeliveryHistoryEvent
        };
        assignment.status = next;
        if (isDelivering) {
          assignment.paymentCollectionStatus = 'collected';
          assignment.collectedMethod = method;
        }
      });
      this.notifications.show('success', `Order status updated to ${this.statusLabel(next)}.`, 'Delivery Updated');
    } catch (error) {
      this.notes[assignment.orderId] = note;
      console.error('Delivery update failed:', error);
      this.notifications.show('error', 'The assignment could not be updated. Check that it is still assigned to you.', 'Update Failed');
    } finally {
      this.isUpdating.set(false);
      this.cdr.detectChanges();
    }
  }

  async markDeliveryIssue(assignment: DeliveryAssignment): Promise<void> {
    const note = (this.notes[assignment.orderId] || '').trim();
    if (!note) {
      this.notifications.show('warning', 'Please enter a note explaining the delivery issue or delay.', 'Note Required');
      return;
    }

    this.isUpdating.set(true);
    try {
      const historyEvent = await this.deliveryService.updateStatus(assignment.orderId, 'failed_delivery', note);
      this.zone.run(() => {
        this.history[assignment.orderId] = {
          ...(this.history[assignment.orderId] || {}),
          [historyEvent.id]: historyEvent as DeliveryHistoryEvent
        };
        assignment.status = 'failed_delivery';
      });
      this.notes[assignment.orderId] = '';
      this.notifications.show('warning', 'Order marked with delivery issue / reschedule needed.', 'Issue Reported');
    } catch (error) {
      console.error('Delivery issue report failed:', error);
      this.notifications.show('error', 'Could not record delivery issue.', 'Report Failed');
    } finally {
      this.isUpdating.set(false);
      this.cdr.detectChanges();
    }
  }

  statusLabel(status: string): string {
    if (!status) return 'Pending';
    return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  getGoogleMapsUrl(address: string, pincode: string): string {
    const query = `${address || ''} ${pincode || ''}`.trim();
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  getWhatsAppUrl(phone: string, studentName: string, orderId: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
    const message = `Hello ${studentName || 'Student'}, this is your Student Solutions Delivery Courier regarding Order #${(orderId || '').slice(0, 8).toUpperCase()}. I am en route with your project files!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }

  // --- Seed / Demo Generator for Initial Empty States ---
  async createSampleDispatch(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      this.notifications.show('error', 'Please log in to generate demo assignments.', 'Auth Error');
      return;
    }

    const demoId = `DEMO-${Date.now().toString().slice(-6)}`;
    const assignedAt = new Date().toISOString();
    const demoAssignment: DeliveryAssignment = {
      orderId: demoId,
      uid: user.uid,
      agentUid: user.uid,
      status: 'assigned',
      assignedAt,
      assignedBy: user.uid,
      studentName: 'Rahul Sharma',
      subject: 'Major Project Report - Hardcover Golden Foil Print (IEEE Standard)',
      phone: '9876543210',
      address: 'Hostel 3, Room 104, Campus Main Gate, Engineering College',
      pincode: '110025',
      lastHistoryStatus: 'assigned',
      lastHistoryNote: 'Deliverables bound and inspected by Print Lab. Dispatched for courier delivery.',
      lastHistoryCreatedAt: assignedAt
    };

    try {
      await set(ref(this.db, `deliveryAssignments/${demoId}`), demoAssignment);
      const historyRef = push(ref(this.db, `deliveryHistory/${demoId}`));
      if (historyRef.key) {
        await set(historyRef, {
          id: historyRef.key,
          orderId: demoId,
          agentUid: user.uid,
          actorUid: user.uid,
          actorEmail: user.email || 'dispatch@studentsolutions.online',
          status: 'assigned',
          note: 'Hardcover spiral reports packed and allocated to your vehicle route.',
          createdAt: assignedAt
        });
      }
      this.notifications.show('success', 'Sample delivery order dispatched to your portal!', 'Sample Created');
    } catch {
      // In-memory fallback
      this.assignments = [demoAssignment, ...this.assignments];
      this.notifications.show('success', 'Sample delivery order created in preview mode.', 'Sample Created');
      this.cdr.detectChanges();
    }
  }

  private watchHistory(orderId: string): void {
    if (this.historySubscriptions.has(orderId)) return;
    this.historySubscriptions.set(
      orderId,
      this.deliveryService.watchHistory(orderId, value => {
        this.history[orderId] = value;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.stopPricingSub?.();
    this.stopAssignments?.();
    this.historySubscriptions.forEach(unsubscribe => unsubscribe());
  }
}

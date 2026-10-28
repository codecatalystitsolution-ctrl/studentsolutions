import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Auth, authState } from '@angular/fire/auth';
import { Database, Unsubscribe, get, ref } from '@angular/fire/database';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommissionRecord, ReferralAttribution, ReferralCode, ReferralCommissionService } from '../../services/referral-commission.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationInboxService } from '../../services/notification-inbox.service';
import { CsvExportService } from '../../services/csv-export.service';

export interface TeacherProfile {
  fullName?: string;
  email?: string;
  teacherID?: string;
  collegeName?: string;
  department?: string;
  status?: string;
  phone?: string;
  commissionRate?: number;
  payoutDetails?: any;
  payoutRequests?: any;
}

export interface TeacherPayoutRequest {
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
  selector: 'app-teacher-referrals',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './teacher-referrals.component.html',
  styleUrl: './teacher-referrals.component.scss'
})
export class TeacherReferralsComponent implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly referrals = inject(ReferralCommissionService);
  private readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly inboxService = inject(NotificationInboxService);
  private readonly csvExport = inject(CsvExportService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  // Core Data
  codes: ReferralCode[] = [];
  students: ReferralAttribution[] = [];
  commissions: Array<CommissionRecord & { id: string }> = [];
  histories: Record<string, Record<string, any>> = {};
  teacherProfile: TeacherProfile | null = null;
  unreadNotifications = 0;
  loading = true;
  currentUid = '';
  isGeneratingCode = false;
  isTogglingCode = false;

  // Payout & Revenue State
  payoutDetails = {
    method: 'upi' as 'upi' | 'bank',
    upiId: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifsc: '',
    phone: '',
    panNumber: ''
  };
  payoutRequests: TeacherPayoutRequest[] = [];
  isSavingPayout = false;
  isRequestingPayout = false;
  withdrawInputAmount = 0;

  // UI state
  activeTab: 'overview' | 'codes' | 'students' | 'commissions' | 'payouts' = 'overview';
  searchQuery = '';
  commissionStatusFilter: 'all' | 'pending' | 'approved' | 'paid' | 'rejected' = 'all';
  sidebarOpen = false;
  copyFeedback = '';
  demoMode = false;

  private authSubscription?: Subscription;
  private stops: Unsubscribe[] = [];
  private historyStops = new Map<string, Unsubscribe>();

  private demoPayoutRequests: TeacherPayoutRequest[] = [
    {
      id: 'PR-89210',
      amount: 240,
      method: 'upi',
      status: 'disbursed',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      disbursedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      reference: 'UPI/AXIS/4910283921',
      notes: 'Semester 8 Capstone Project honorarium disbursement'
    }
  ];

  // Demo fallback state for instant previews
  private demoCodes: ReferralCode[] = [
    {
      code: 'FC-PROF7729',
      teacherUid: 'demo-teacher',
      active: true,
      createdBy: 'admin',
      createdAt: Date.now() - 86400000 * 7
    }
  ];

  private demoStudents: ReferralAttribution[] = [
    {
      studentUid: 'stu_aarav_m',
      teacherUid: 'demo-teacher',
      referralCode: 'FC-PROF7729',
      studentName: 'Aarav Mehta',
      studentID: 'FC-A9B210',
      collegeName: 'National Institute of Technology',
      courseBranch: 'B.Tech - Computer Science (6th Sem)',
      createdAt: Date.now() - 86400000 * 5
    },
    {
      studentUid: 'stu_neha_s',
      teacherUid: 'demo-teacher',
      referralCode: 'FC-PROF7729',
      studentName: 'Neha Sharma',
      studentID: 'FC-C3D452',
      collegeName: 'National Institute of Technology',
      courseBranch: 'BCA - Information Tech (4th Sem)',
      createdAt: Date.now() - 86400000 * 3
    },
    {
      studentUid: 'stu_rohit_v',
      teacherUid: 'demo-teacher',
      referralCode: 'FC-PROF7729',
      studentName: 'Rohit Verma',
      studentID: 'FC-E5F789',
      collegeName: 'Delhi Technological University',
      courseBranch: 'B.Tech - Mechanical (8th Sem)',
      createdAt: Date.now() - 86400000 * 1
    }
  ];

  private demoCommissions: Array<CommissionRecord & { id: string }> = [
    {
      id: 'comm-101',
      teacherUid: 'demo-teacher',
      studentUid: 'stu_aarav_m',
      orderId: 'FC-ORD-8921',
      paymentId: 'PAY-8921',
      amount: 240,
      calculationBaseAmount: 2400,
      calculationRatePercent: 10,
      proposedAmount: 240,
      calculationFormula: 'verified-payment-times-admin-rate-v1',
      roundingPolicy: 'half-up-to-0.01-INR',
      currency: 'INR',
      status: 'paid',
      memo: 'Final Year Hardbound Capstone Project (10% faculty referral honorarium)',
      createdBy: 'admin',
      createdAt: Date.now() - 86400000 * 4,
      creationHistoryId: 'hist-101'
    },
    {
      id: 'comm-102',
      teacherUid: 'demo-teacher',
      studentUid: 'stu_neha_s',
      orderId: 'FC-ORD-8944',
      paymentId: 'PAY-8944',
      amount: 180,
      calculationBaseAmount: 1800,
      calculationRatePercent: 10,
      proposedAmount: 180,
      calculationFormula: 'verified-payment-times-admin-rate-v1',
      roundingPolicy: 'half-up-to-0.01-INR',
      currency: 'INR',
      status: 'approved',
      memo: 'Semester 8 Project Spiral Binding & High-Gsm Color Print',
      createdBy: 'admin',
      createdAt: Date.now() - 86400000 * 2,
      creationHistoryId: 'hist-102'
    },
    {
      id: 'comm-103',
      teacherUid: 'demo-teacher',
      studentUid: 'stu_rohit_v',
      orderId: 'FC-ORD-8960',
      paymentId: 'PAY-8960',
      amount: 120,
      calculationBaseAmount: 1200,
      calculationRatePercent: 10,
      proposedAmount: 120,
      calculationFormula: 'verified-payment-times-admin-rate-v1',
      roundingPolicy: 'half-up-to-0.01-INR',
      currency: 'INR',
      status: 'pending',
      memo: 'Lab Manual & Assignment Solution Printouts',
      createdBy: 'admin',
      createdAt: Date.now() - 86400000 * 1,
      creationHistoryId: 'hist-103'
    }
  ];

  private demoHistories: Record<string, Record<string, any>> = {
    'comm-101': {
      evt1: { status: 'pending', message: 'Commission proposed automatically upon payment verification', createdAt: Date.now() - 86400000 * 4 },
      evt2: { status: 'approved', message: 'Admin verified project completion and approved payout', createdAt: Date.now() - 86400000 * 3 },
      evt3: { status: 'paid', message: 'Disbursed via UPI to faculty partner account', createdAt: Date.now() - 86400000 * 2 }
    },
    'comm-102': {
      evt1: { status: 'pending', message: 'Commission proposed for reviewed student order', createdAt: Date.now() - 86400000 * 2 },
      evt2: { status: 'approved', message: 'Commission verified and scheduled for next payout cycle', createdAt: Date.now() - 86400000 * 1 }
    },
    'comm-103': {
      evt1: { status: 'pending', message: 'Under verification by order billing desk', createdAt: Date.now() - 86400000 * 1 }
    }
  };

  ngOnInit(): void {
    this.authSubscription = authState(this.auth).subscribe(async user => {
      this.stopListeners();
      if (!user) {
        this.loading = false;
        this.currentUid = '';
        this.codes = [];
        this.students = [];
        this.commissions = [];
        this.teacherProfile = null;
        return;
      }

      this.currentUid = user.uid;

      // Fetch teacher profile
      try {
        const profile = await this.authService.getUserProfile(user.uid);
        this.teacherProfile = profile || {
          fullName: user.displayName || 'Faculty Partner',
          email: user.email || '',
          teacherID: `TEA-${user.uid.slice(-6).toUpperCase()}`
        };

        if (profile?.payoutDetails) {
          this.payoutDetails = {
            method: profile.payoutDetails.method || 'upi',
            upiId: profile.payoutDetails.upiId || '',
            bankName: profile.payoutDetails.bankName || '',
            accountHolder: profile.payoutDetails.accountHolder || profile.fullName || user.displayName || '',
            accountNumber: profile.payoutDetails.accountNumber || '',
            ifsc: profile.payoutDetails.ifsc || '',
            phone: profile.payoutDetails.phone || profile.phone || '',
            panNumber: profile.payoutDetails.panNumber || ''
          };
        } else {
          this.payoutDetails.accountHolder = profile?.fullName || user.displayName || 'Faculty Partner';
        }

        if (profile?.payoutRequests) {
          this.payoutRequests = Object.values(profile.payoutRequests)
            .sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || '')) as TeacherPayoutRequest[];
        }
      } catch {
        this.teacherProfile = {
          fullName: user.displayName || 'Faculty Partner',
          email: user.email || '',
          teacherID: `TEA-${user.uid.slice(-6).toUpperCase()}`
        };
      }

      // Listen for notifications
      try {
        const inboxStop = this.inboxService.watchOwn(user.uid, notifications => {
          this.unreadNotifications = notifications.filter(n => !n.isRead).length;
          this.cdr.detectChanges();
        });
        this.stops.push(inboxStop);
      } catch {
        // Inbox listener optional in tests
      }

      // Live Firebase Listeners
      this.stops.push(
        this.referrals.watchCodesForTeacher(user.uid, value => {
          this.codes = value;
          this.cdr.detectChanges();
        }),
        this.referrals.watchMyAttributions(user.uid, value => {
          this.students = value;
          this.loading = false;
          this.cdr.detectChanges();
        }),
        this.referrals.watchMyCommissions(user.uid, value => {
          this.commissions = value;
          this.loading = false;
          for (const commission of value) this.watchHistory(commission.id);
          this.cdr.detectChanges();
        })
      );
    });
  }

  // Active or Demo Lists
  get activeCodes(): ReferralCode[] {
    return this.demoMode ? this.demoCodes : this.codes;
  }

  get activeStudents(): ReferralAttribution[] {
    return this.demoMode ? this.demoStudents : this.students;
  }

  get activeCommissions(): Array<CommissionRecord & { id: string }> {
    return this.demoMode ? this.demoCommissions : this.commissions;
  }

  get activeHistories(): Record<string, Record<string, any>> {
    return this.demoMode ? this.demoHistories : this.histories;
  }

  // Filtered Lists
  get filteredStudents(): ReferralAttribution[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.activeStudents;
    return this.activeStudents.filter(s =>
      s.studentUid.toLowerCase().includes(q) ||
      s.referralCode.toLowerCase().includes(q) ||
      (s.studentName && s.studentName.toLowerCase().includes(q)) ||
      (s.studentID && s.studentID.toLowerCase().includes(q)) ||
      (s.collegeName && s.collegeName.toLowerCase().includes(q)) ||
      (s.courseBranch && s.courseBranch.toLowerCase().includes(q))
    );
  }

  get filteredCommissions(): Array<CommissionRecord & { id: string }> {
    let list = this.activeCommissions;
    if (this.commissionStatusFilter !== 'all') {
      list = list.filter(c => c.status === this.commissionStatusFilter);
    }
    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(c =>
        c.orderId.toLowerCase().includes(q) ||
        c.studentUid.toLowerCase().includes(q) ||
        (c.memo && c.memo.toLowerCase().includes(q))
      );
    }
    return list;
  }

  // KPI Calculations
  get primaryCode(): string {
    const firstActive = this.activeCodes.find(c => c.active);
    return firstActive?.code || (this.activeCodes[0]?.code ?? '');
  }

  get totalApprovedEarned(): number {
    return this.activeCommissions
      .filter(c => c.status === 'approved' || c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  get totalPendingPayout(): number {
    return this.activeCommissions
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  get totalPaidPayout(): number {
    return this.activeCommissions
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + (c.amount || 0), 0);
  }

  get activePayoutRequests(): TeacherPayoutRequest[] {
    return this.demoMode && !this.payoutRequests.length ? this.demoPayoutRequests : this.payoutRequests;
  }

  get pendingPayoutRequestsTotal(): number {
    return this.activePayoutRequests
      .filter(r => r.status === 'pending' || r.status === 'processing')
      .reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
  }

  get availableForWithdrawal(): number {
    return Math.max(0, this.totalApprovedEarned - this.totalPaidPayout - this.pendingPayoutRequestsTotal);
  }

  async savePayoutDetails(): Promise<void> {
    if (this.demoMode) {
      this.copyFeedback = 'Payout details saved (Demo Mode)';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 2500);
      return;
    }
    if (!this.currentUid) return;
    if (this.payoutDetails.method === 'upi' && !this.payoutDetails.upiId?.trim()) {
      this.copyFeedback = 'Please enter a valid UPI ID (e.g., prof@okaxis).';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
      return;
    }
    if (this.payoutDetails.method === 'bank' && (!this.payoutDetails.accountNumber?.trim() || !this.payoutDetails.ifsc?.trim())) {
      this.copyFeedback = 'Please provide Account Number & IFSC Code.';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
      return;
    }

    this.isSavingPayout = true;
    try {
      await this.authService.savePayoutDetails(this.currentUid, this.payoutDetails);
      this.copyFeedback = 'Payout receiving account saved securely!';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
    } catch (err: any) {
      console.error('Failed saving payout details:', err);
      this.copyFeedback = 'Could not save payout details.';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
    } finally {
      this.isSavingPayout = false;
      this.cdr.detectChanges();
    }
  }

  async requestPayout(customAmount?: number): Promise<void> {
    const amt = customAmount !== undefined ? customAmount : (this.withdrawInputAmount > 0 ? this.withdrawInputAmount : this.availableForWithdrawal);
    if (!amt || amt <= 0) {
      this.copyFeedback = 'No approved balance available for withdrawal.';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
      return;
    }
    if (amt > this.availableForWithdrawal) {
      this.copyFeedback = `Amount exceeds available balance of ₹${this.availableForWithdrawal}.`;
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
      return;
    }

    this.isRequestingPayout = true;
    try {
      if (!this.demoMode && this.currentUid) {
        const req = await this.authService.submitPayoutRequest(this.currentUid, {
          amount: amt,
          method: this.payoutDetails.method,
          details: this.payoutDetails,
          role: 'Teacher',
          notes: 'Faculty referral commission withdrawal'
        });
        this.payoutRequests = [req as TeacherPayoutRequest, ...this.payoutRequests];
      } else {
        const demoReq: TeacherPayoutRequest = {
          id: `PR-${Date.now().toString().slice(-6)}`,
          amount: amt,
          method: this.payoutDetails.method,
          status: 'pending',
          createdAt: new Date().toISOString(),
          notes: 'Faculty referral commission withdrawal (Demo)'
        };
        this.payoutRequests = [demoReq, ...this.payoutRequests];
      }
      this.withdrawInputAmount = 0;
      this.copyFeedback = `Withdrawal request for ₹${amt} submitted to Admin!`;
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3500);
    } catch (err: any) {
      console.error('Payout request failed:', err);
      this.copyFeedback = 'Could not submit withdrawal request.';
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3500);
    } finally {
      this.isRequestingPayout = false;
      this.cdr.detectChanges();
    }
  }

  exportCommissionsCsv(): void {
    const columns = [
      { key: 'orderId', label: 'Order ID' },
      { key: 'studentUid', label: 'Student UID' },
      { key: 'amount', label: 'Commission Amount (INR)', format: (v: number) => `₹${v}` },
      { key: 'calculationRatePercent', label: 'Commission Rate (%)', format: (v: number) => `${v}%` },
      { key: 'calculationBaseAmount', label: 'Order Base Amount (INR)', format: (v: number) => `₹${v}` },
      { key: 'status', label: 'Commission Status' },
      { key: 'memo', label: 'Admin Memo' },
      { key: 'createdAt', label: 'Date', format: (v: number) => new Date(v).toLocaleDateString() }
    ];

    const data = this.activeCommissions;
    this.csvExport.exportToCsv(`filecrafters-teacher-commissions-${new Date().toISOString().slice(0, 10)}.csv`, columns, data);
    this.copyFeedback = 'Commission statement downloaded as CSV!';
    setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3000);
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  async generateMyCode(): Promise<void> {
    if (this.demoMode) {
      await this.copyText('FC-PROF7729', 'Demo code FC-PROF7729 active');
      return;
    }
    if (!this.currentUid || this.isGeneratingCode) return;
    this.isGeneratingCode = true;
    try {
      const code = await this.referrals.createReferralCode(this.currentUid);
      await this.copyText(code, `Unique referral code ${code} generated and activated!`);
    } catch (err: any) {
      console.error('Failed to generate referral code:', err);
      this.copyFeedback = err?.message || 'Could not generate referral code.';
      this.cdr.detectChanges();
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3500);
    } finally {
      this.isGeneratingCode = false;
      this.cdr.detectChanges();
    }
  }

  async toggleCodeStatus(code: ReferralCode): Promise<void> {
    if (this.demoMode) {
      code.active = !code.active;
      this.copyFeedback = code.active ? 'Referral code activated (Demo)' : 'Referral code paused (Demo)';
      this.cdr.detectChanges();
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 2500);
      return;
    }
    if (this.isTogglingCode) return;
    this.isTogglingCode = true;
    const nextState = !code.active;
    try {
      await this.referrals.toggleCodeActive(code.code, nextState);
      this.copyFeedback = nextState ? `Code ${code.code} is now Active!` : `Code ${code.code} is now Paused.`;
      this.cdr.detectChanges();
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 2500);
    } catch (err: any) {
      console.error('Failed to toggle code status:', err);
      this.copyFeedback = err?.message || 'Could not update status.';
      this.cdr.detectChanges();
      setTimeout(() => { this.copyFeedback = ''; this.cdr.detectChanges(); }, 3500);
    } finally {
      this.isTogglingCode = false;
      this.cdr.detectChanges();
    }
  }

  // Share & Copy Utilities
  getShareUrl(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://filecrafters.in';
    return `${origin}/register?ref=${encodeURIComponent(code)}`;
  }

  async copyText(text: string, label: string): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      this.copyFeedback = label;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.copyFeedback = '';
        this.cdr.detectChanges();
      }, 2500);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  }

  shareWhatsApp(code: string): void {
    const link = this.getShareUrl(code);
    const message = `Hello Students! For all your college project reports, assignment prints, and spiral/hardcover binding, register on FileCrafters with my faculty referral code *${code}*:\n${link}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  shareEmail(code: string): void {
    const link = this.getShareUrl(code);
    const subject = encodeURIComponent(`FileCrafters Project & Assignment Printing - Faculty Referral Code: ${code}`);
    const body = encodeURIComponent(
      `Dear Students,\n\nYou can use FileCrafters for your upcoming project file submissions, reports, and spiral binding.\n\nUse faculty referral code: ${code}\nRegistration Link: ${link}\n\nBest regards,\nFaculty Partner`
    );
    if (typeof window !== 'undefined') {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  }

  toggleDemoMode(): void {
    this.demoMode = !this.demoMode;
    this.cdr.detectChanges();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  async logout(): Promise<void> {
    await this.authService.logout();
    await this.router.navigate(['/login']);
  }

  private watchHistory(commissionId: string): void {
    if (this.historyStops.has(commissionId)) return;
    this.historyStops.set(commissionId, this.referrals.watchCommissionHistory(commissionId, history => {
      this.histories[commissionId] = history;
      this.cdr.detectChanges();
    }));
  }

  private stopListeners(): void {
    this.stops.forEach(stop => stop());
    this.stops = [];
    this.historyStops.forEach(stop => stop());
    this.historyStops.clear();
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.stopListeners();
  }
}

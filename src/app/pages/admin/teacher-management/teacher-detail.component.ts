import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Database, ref, onValue, off, update } from '@angular/fire/database';
import { ReferralCode, ReferralCommissionService } from '../../../services/referral-commission.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { PdfExportService, UserPdfReportData } from '../../../services/pdf-export.service';
import { AuthService } from '../../../services/auth.service';
import { VerificationEmailContent, VerificationNotificationService } from '../../../services/verification-notification.service';
import { AuditTrailService } from '../../../services/audit-trail.service';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-detail.component.html',
  styleUrls: ['./teacher-detail.component.scss']
})
export class TeacherDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private db = inject(Database);
  private referralService = inject(ReferralCommissionService);
  private notification = inject(NotificationService);
  private pdfExport = inject(PdfExportService);
  private authService = inject(AuthService);
  private verificationService = inject(VerificationNotificationService);
  private auditTrail = inject(AuditTrailService);

  teacher: any = null;
  isLoading = true;
  errorMessage = '';
  private teacherRef: any;
  private historyRef: any;
  private stopReferralCodes: (() => void) | null = null;
  referralCodes: ReferralCode[] = [];
  emailDispatchHistory: Array<any> = [];
  isCreatingCode = false;
  adminCommissionRate = 10;
  isSavingRate = false;

  // Verification & Approval Actions State
  showApproveModal = false;
  showRejectModal = false;
  isProcessingAction = false;
  selectedRejectionReason = 'Institution / Faculty ID credentials could not be verified';
  customRejectionReason = '';
  approvalNotes = '';
  emailPreview: VerificationEmailContent | null = null;
  emailCopied = false;

  readonly predefinedTeacherReasons: string[] = [
    'Institution / Faculty ID credentials could not be verified',
    'Department or academic domain not eligible for faculty mentor program',
    'Incomplete contact information or duplicate registration profile',
    'Applicant could not be contacted via registered phone or official institutional email',
    'Other (enter specific reason below)'
  ];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const uid = params.get('uid');
      if (!uid) {
        this.errorMessage = 'Teacher ID not found in the URL.';
        this.isLoading = false;
        return;
      }
      this.loadTeacher(uid);
    });
  }

  loadTeacher(uid: string) {
    this.teacherRef = ref(this.db, `users/${uid}`);
    onValue(
      this.teacherRef,
      snapshot => {
        const data = snapshot.val();
        if (!data) {
          this.errorMessage = 'Teacher record not available. Please check the teacher ID.';
          this.teacher = null;
        } else {
          this.teacher = { uid, ...data };
          this.adminCommissionRate = data.commissionRate !== undefined ? Number(data.commissionRate) : 10;
          this.stopReferralCodes?.();
          this.stopReferralCodes = this.referralService.watchCodesForTeacher(
            uid,
            codes => (this.referralCodes = codes)
          );

          // Load email dispatch audit history
          this.historyRef = ref(this.db, `users/${uid}/emailDispatchHistory`);
          onValue(this.historyRef, histSnapshot => {
            const data = histSnapshot.val() || {};
            this.emailDispatchHistory = Object.keys(data)
              .map(k => ({ id: k, ...data[k] }))
              .sort((a, b) => (b.dispatchedAt || 0) - (a.dispatchedAt || 0));
          });
        }
        this.isLoading = false;
      },
      error => {
        console.error('Failed to load teacher detail', error);
        this.errorMessage = 'Unable to load teacher details at this time.';
        this.isLoading = false;
      }
    );
  }

  downloadPdf(): void {
    if (!this.teacher) return;

    const reportData: UserPdfReportData = {
      title: 'Teacher Profile & Referral Summary',
      referenceId: this.teacher.uid?.slice(0, 8) || 'N/A',
      generatedAt: new Date().toLocaleString(),
      profile: {
        fullName: this.teacher.fullName || 'N/A',
        email: this.teacher.email || 'N/A',
        role: 'Teacher',
        status: this.teacher.status || 'active',
        phone: this.teacher.phone,
        whatsapp: this.teacher.whatsapp,
        institution: this.teacher.collegeName,
        createdAt: this.teacher.createdAt
      },
      sections: [
        {
          title: 'Professional & Contact Information',
          rows: [
            { label: 'Full Name', value: this.teacher.fullName || 'N/A' },
            { label: 'Role', value: 'Faculty / Teacher' },
            { label: 'Email', value: this.teacher.email || 'N/A' },
            { label: 'Phone', value: this.teacher.phone || 'N/A' },
            { label: 'WhatsApp', value: this.teacher.whatsapp || 'N/A' },
            { label: 'Institution / College', value: this.teacher.collegeName || 'N/A' },
            { label: 'Department', value: this.teacher.department || 'N/A' },
            { label: 'Account Status', value: (this.teacher.status || 'active').toUpperCase() }
          ]
        }
      ],
      tables: [
        {
          title: `Active Referral Codes (${this.referralCodes.length})`,
          headers: ['Code', 'Created Date', 'Status'],
          rows: this.referralCodes.map(c => [
            c.code || 'N/A',
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A',
            c.active ? 'Active' : 'Inactive'
          ])
        }
      ]
    };

    this.pdfExport.exportReport(reportData);
  }

  async createReferralCode(): Promise<void> {
    if (!this.teacher?.uid || this.isCreatingCode) return;
    this.isCreatingCode = true;
    try {
      const code = await this.referralService.createReferralCode(this.teacher.uid);
      this.notification.show('success', `Created referral code ${code}.`, 'Referral Code');
    } catch (err: any) {
      console.error('Failed to create referral code:', err);
      this.notification.show('error', err?.message || 'Could not create referral code.', 'Referral Error');
    } finally {
      this.isCreatingCode = false;
    }
  }

  async saveCommissionRate(): Promise<void> {
    if (!this.teacher?.uid || this.isSavingRate) return;
    const rate = Number(this.adminCommissionRate);
    if (!rate || rate <= 0 || rate > 100) {
      this.notification.show('error', 'Please enter a valid commission rate from 1 to 100%.', 'Invalid Rate');
      return;
    }
    this.isSavingRate = true;
    try {
      await update(ref(this.db, `users/${this.teacher.uid}`), {
        commissionRate: rate,
        commissionRateUpdatedAt: new Date().toISOString()
      });
      this.teacher.commissionRate = rate;
      this.notification.show('success', `Faculty commission rate successfully set to ${rate}%.`, 'Commission Rate Set');
    } catch (err: any) {
      console.error('Failed to set commission rate:', err);
      this.notification.show('error', err?.message || 'Could not update commission rate.', 'Error');
    } finally {
      this.isSavingRate = false;
    }
  }

  // === Verification & Approval Actions ===

  openApproveModal(): void {
    if (!this.teacher) return;
    this.emailPreview = this.verificationService.generateEmail({
      applicantName: this.teacher.fullName || 'Faculty Member',
      applicantEmail: this.teacher.email || '',
      role: 'Teacher',
      decision: 'approved',
      customId: this.teacher.employeeID || `TEA-${this.teacher.uid.slice(0, 6).toUpperCase()}`
    });
    this.emailCopied = false;
    this.showApproveModal = true;
  }

  async confirmApproval(): Promise<void> {
    if (!this.teacher?.uid || this.isProcessingAction) return;
    this.isProcessingAction = true;

    try {
      // 1. Update user profile to active
      await this.authService.approveUserApplication(this.teacher.uid, 'Teacher', this.approvalNotes);

      // 2. Automatically generate referral code if teacher has none
      if (this.referralCodes.length === 0) {
        try {
          await this.referralService.createReferralCode(this.teacher.uid);
        } catch (codeErr) {
          console.warn('Could not auto-generate referral code:', codeErr);
        }
      }

      // 3. Dispatch & log email + in-app notification
      if (this.emailPreview) {
        await this.verificationService.recordAndNotify(
          this.teacher.uid,
          {
            applicantName: this.teacher.fullName,
            applicantEmail: this.teacher.email,
            role: 'Teacher',
            decision: 'approved',
            customId: this.teacher.employeeID
          },
          this.emailPreview
        );
        // Trigger mail client
        this.verificationService.openMailClient(this.emailPreview.mailtoUrl);
      }

      // 4. Record admin audit trail event
      await this.auditTrail.recordAdmin(
        'teacher_approved',
        'Teacher',
        this.teacher.uid,
        `Approved faculty application for ${this.teacher.fullName || 'Teacher'} (${this.teacher.email}). Reference: ${this.teacher.employeeID || 'TEA'}`
      );

      this.notification.show(
        'success',
        `Faculty application for ${this.teacher.fullName || 'Teacher'} approved! Notification & email dispatched.`,
        'Application Approved'
      );
      this.showApproveModal = false;
    } catch (err: any) {
      console.error('Failed to approve teacher application:', err);
      this.notification.show('error', err?.message || 'Could not approve application.', 'Approval Error');
    } finally {
      this.isProcessingAction = false;
    }
  }

  openRejectModal(): void {
    if (!this.teacher) return;
    this.selectedRejectionReason = this.predefinedTeacherReasons[0];
    this.customRejectionReason = '';
    this.emailCopied = false;
    this.updateRejectionEmailPreview();
    this.showRejectModal = true;
  }

  onRejectionReasonChange(): void {
    this.updateRejectionEmailPreview();
  }

  private getEffectiveRejectionReason(): string {
    if (this.selectedRejectionReason === 'Other (enter specific reason below)') {
      return this.customRejectionReason.trim() || 'Verification credentials could not be authenticated.';
    }
    return this.selectedRejectionReason;
  }

  private updateRejectionEmailPreview(): void {
    const reason = this.getEffectiveRejectionReason();
    this.emailPreview = this.verificationService.generateEmail({
      applicantName: this.teacher.fullName || 'Faculty Member',
      applicantEmail: this.teacher.email || '',
      role: 'Teacher',
      decision: 'rejected',
      rejectionReason: reason
    });
  }

  async confirmRejection(): Promise<void> {
    if (!this.teacher?.uid || this.isProcessingAction) return;
    const finalReason = this.getEffectiveRejectionReason();
    this.isProcessingAction = true;

    try {
      // 1. Update user profile to rejected
      await this.authService.rejectUserApplication(this.teacher.uid, 'Teacher', finalReason);

      // 2. Dispatch email audit and in-app notification
      if (this.emailPreview) {
        await this.verificationService.recordAndNotify(
          this.teacher.uid,
          {
            applicantName: this.teacher.fullName,
            applicantEmail: this.teacher.email,
            role: 'Teacher',
            decision: 'rejected',
            rejectionReason: finalReason
          },
          this.emailPreview
        );
        // Trigger mail client
        this.verificationService.openMailClient(this.emailPreview.mailtoUrl);
      }

      // 3. Record admin audit trail event
      await this.auditTrail.recordAdmin(
        'teacher_rejected',
        'Teacher',
        this.teacher.uid,
        `Rejected faculty application for ${this.teacher.fullName || 'Teacher'} (${this.teacher.email}). Reason: ${finalReason}`
      );

      this.notification.show(
        'success',
        `Application rejected and email notification sent to ${this.teacher.email}.`,
        'Application Rejected'
      );
      this.showRejectModal = false;
    } catch (err: any) {
      console.error('Failed to reject teacher application:', err);
      this.notification.show('error', err?.message || 'Could not reject application.', 'Rejection Error');
    } finally {
      this.isProcessingAction = false;
    }
  }

  resendEmail(item: any): void {
    if (!item?.recipientEmail || !item?.subject || !item?.bodyText) return;
    const mailtoUrl = `mailto:${encodeURIComponent(item.recipientEmail)}?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(item.bodyText)}`;
    this.verificationService.openMailClient(mailtoUrl);
    this.notification.show('info', 'Opening mail client for resent message...', 'Mail Client');
  }

  async copyEmailPreview(): Promise<void> {
    if (!this.emailPreview?.bodyText) return;
    const copied = await this.verificationService.copyToClipboard(this.emailPreview.bodyText);
    if (copied) {
      this.emailCopied = true;
      this.notification.show('success', 'Email body copied to clipboard.', 'Copied');
      setTimeout(() => (this.emailCopied = false), 2500);
    }
  }

  triggerMailClient(): void {
    if (this.emailPreview?.mailtoUrl) {
      this.verificationService.openMailClient(this.emailPreview.mailtoUrl);
    }
  }

  closeModals(): void {
    this.showApproveModal = false;
    this.showRejectModal = false;
  }

  ngOnDestroy() {
    if (this.teacherRef) {
      off(this.teacherRef);
    }
    if (this.historyRef) {
      off(this.historyRef);
    }
    this.stopReferralCodes?.();
  }

  goBack() {
    this.router.navigate(['/admin/teachers']);
  }
}

import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { PdfExportService, UserPdfReportData } from '../../../services/pdf-export.service';
import { AuthService } from '../../../services/auth.service';
import { VerificationEmailContent, VerificationNotificationService } from '../../../services/verification-notification.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { AuditTrailService } from '../../../services/audit-trail.service';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delivery-detail.component.html',
  styleUrls: ['./delivery-detail.component.scss']
})
export class DeliveryDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private db = inject(Database);
  private pdfExport = inject(PdfExportService);
  private authService = inject(AuthService);
  private verificationService = inject(VerificationNotificationService);
  private notification = inject(NotificationService);
  private auditTrail = inject(AuditTrailService);

  delivery: any = null;
  isLoading = true;
  errorMessage = '';
  private deliveryRef: any;
  private historyRef: any;
  emailDispatchHistory: Array<any> = [];

  // Verification & Approval Actions State
  showApproveModal = false;
  showRejectModal = false;
  isProcessingAction = false;
  approvalNotes = '';
  selectedRejectionReason = 'Vehicle details or driving license could not be verified';
  customRejectionReason = '';
  emailPreview: VerificationEmailContent | null = null;
  emailCopied = false;

  readonly predefinedDeliveryReasons: string[] = [
    'Vehicle details or driving license could not be verified',
    'Delivery service area is currently not covered or out of operational range',
    'Incomplete contact information or unverified mobile number',
    'Vehicle category or courier documents invalid or expired',
    'Other (enter specific reason below)'
  ];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const uid = params.get('uid');
      if (!uid) {
        this.errorMessage = 'Delivery Staff ID not found in the URL.';
        this.isLoading = false;
        return;
      }
      this.loadDelivery(uid);
    });
  }

  loadDelivery(uid: string) {
    this.deliveryRef = ref(this.db, `users/${uid}`);
    onValue(
      this.deliveryRef,
      snapshot => {
        const data = snapshot.val();
        if (!data) {
          this.errorMessage = 'Delivery Staff record not available. Please check the ID.';
          this.delivery = null;
        } else {
          this.delivery = { uid, ...data };

          // Listen to email dispatch history
          this.historyRef = ref(this.db, `users/${uid}/emailDispatchHistory`);
          onValue(this.historyRef, histSnapshot => {
            const histData = histSnapshot.val() || {};
            this.emailDispatchHistory = Object.keys(histData)
              .map(k => ({ id: k, ...histData[k] }))
              .sort((a, b) => (b.dispatchedAt || 0) - (a.dispatchedAt || 0));
          });
        }
        this.isLoading = false;
      },
      error => {
        console.error('Failed to load delivery staff detail', error);
        this.errorMessage = 'Unable to load delivery staff details at this time.';
        this.isLoading = false;
      }
    );
  }

  downloadPdf(): void {
    if (!this.delivery) return;

    const reportData: UserPdfReportData = {
      title: 'Delivery Personnel Profile & Service Record',
      referenceId: this.delivery.uid?.slice(0, 8) || 'N/A',
      generatedAt: new Date().toLocaleString(),
      profile: {
        fullName: this.delivery.fullName || 'N/A',
        email: this.delivery.email || 'N/A',
        role: 'Delivery Personnel',
        status: this.delivery.status || 'active',
        phone: this.delivery.phone,
        whatsapp: this.delivery.whatsapp,
        serviceArea: this.delivery.serviceArea || this.delivery.address,
        createdAt: this.delivery.createdAt
      },
      sections: [
        {
          title: 'Personnel & Logistics Profile',
          rows: [
            { label: 'Full Name', value: this.delivery.fullName || 'N/A' },
            { label: 'Role', value: 'Delivery Partner' },
            { label: 'Email', value: this.delivery.email || 'N/A' },
            { label: 'Phone', value: this.delivery.phone || 'N/A' },
            { label: 'WhatsApp', value: this.delivery.whatsapp || 'N/A' },
            { label: 'Assigned Service Area', value: this.delivery.serviceArea || this.delivery.address || 'N/A' },
            { label: 'Pincode', value: this.delivery.pincode || 'N/A' },
            { label: 'Account Status', value: (this.delivery.status || 'active').toUpperCase() }
          ]
        }
      ]
    };

    this.pdfExport.exportReport(reportData);
  }

  // === Verification & Approval Actions ===

  openApproveModal(): void {
    if (!this.delivery) return;
    this.emailPreview = this.verificationService.generateEmail({
      applicantName: this.delivery.fullName || 'Delivery Partner',
      applicantEmail: this.delivery.email || '',
      role: 'Delivery',
      decision: 'approved',
      customId: this.delivery.deliveryID || `DEL-${this.delivery.uid.slice(0, 6).toUpperCase()}`
    });
    this.emailCopied = false;
    this.showApproveModal = true;
  }

  async confirmApproval(): Promise<void> {
    if (!this.delivery?.uid || this.isProcessingAction) return;
    this.isProcessingAction = true;

    try {
      // 1. Update user profile to active
      await this.authService.approveUserApplication(this.delivery.uid, 'Delivery', this.approvalNotes);

      // 2. Dispatch email and in-app notification
      if (this.emailPreview) {
        await this.verificationService.recordAndNotify(
          this.delivery.uid,
          {
            applicantName: this.delivery.fullName,
            applicantEmail: this.delivery.email,
            role: 'Delivery',
            decision: 'approved',
            customId: this.delivery.deliveryID
          },
          this.emailPreview
        );
        // Trigger mail client
        this.verificationService.openMailClient(this.emailPreview.mailtoUrl);
      }

      // 3. Record admin audit trail event
      await this.auditTrail.recordAdmin(
        'delivery_approved',
        'Delivery',
        this.delivery.uid,
        `Approved delivery partner application for ${this.delivery.fullName || 'Partner'} (${this.delivery.email}). Reference: ${this.delivery.deliveryID || 'DEL'}`
      );

      this.notification.show(
        'success',
        `Delivery partner account for ${this.delivery.fullName || 'Partner'} approved! Email prepared.`,
        'Application Approved'
      );
      this.showApproveModal = false;
    } catch (err: any) {
      console.error('Failed to approve delivery application:', err);
      this.notification.show('error', err?.message || 'Could not approve application.', 'Approval Error');
    } finally {
      this.isProcessingAction = false;
    }
  }

  openRejectModal(): void {
    if (!this.delivery) return;
    this.selectedRejectionReason = this.predefinedDeliveryReasons[0];
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
      return this.customRejectionReason.trim() || 'Logistics credentials could not be authenticated.';
    }
    return this.selectedRejectionReason;
  }

  private updateRejectionEmailPreview(): void {
    const reason = this.getEffectiveRejectionReason();
    this.emailPreview = this.verificationService.generateEmail({
      applicantName: this.delivery.fullName || 'Delivery Partner',
      applicantEmail: this.delivery.email || '',
      role: 'Delivery',
      decision: 'rejected',
      rejectionReason: reason
    });
  }

  async confirmRejection(): Promise<void> {
    if (!this.delivery?.uid || this.isProcessingAction) return;
    const finalReason = this.getEffectiveRejectionReason();
    this.isProcessingAction = true;

    try {
      // 1. Update user profile to rejected
      await this.authService.rejectUserApplication(this.delivery.uid, 'Delivery', finalReason);

      // 2. Dispatch email audit and in-app notification
      if (this.emailPreview) {
        await this.verificationService.recordAndNotify(
          this.delivery.uid,
          {
            applicantName: this.delivery.fullName,
            applicantEmail: this.delivery.email,
            role: 'Delivery',
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
        'delivery_rejected',
        'Delivery',
        this.delivery.uid,
        `Rejected delivery partner application for ${this.delivery.fullName || 'Partner'} (${this.delivery.email}). Reason: ${finalReason}`
      );

      this.notification.show(
        'success',
        `Application rejected and notification email prepared for ${this.delivery.email}.`,
        'Application Rejected'
      );
      this.showRejectModal = false;
    } catch (err: any) {
      console.error('Failed to reject delivery application:', err);
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
    if (this.deliveryRef) {
      off(this.deliveryRef);
    }
    if (this.historyRef) {
      off(this.historyRef);
    }
  }

  goBack() {
    this.router.navigate(['/admin/delivery']);
  }
}

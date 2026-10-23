import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { ReferralCode, ReferralCommissionService } from '../../../services/referral-commission.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { PdfExportService, UserPdfReportData } from '../../../services/pdf-export.service';

@Component({
  selector: 'app-teacher-detail',
  standalone: true,
  imports: [CommonModule],
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

  teacher: any = null;
  isLoading = true;
  errorMessage = '';
  private teacherRef: any;
  private stopReferralCodes: (() => void) | null = null;
  referralCodes: ReferralCode[] = [];
  isCreatingCode = false;

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
          this.stopReferralCodes?.();
          this.stopReferralCodes = this.referralService.watchCodesForTeacher(
            uid,
            codes => (this.referralCodes = codes)
          );
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

  ngOnDestroy() {
    if (this.teacherRef) {
      off(this.teacherRef);
    }
    this.stopReferralCodes?.();
  }

  goBack() {
    this.router.navigate(['/admin/teachers']);
  }
}

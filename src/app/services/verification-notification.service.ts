import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Database, push, ref, set } from '@angular/fire/database';
import { NotificationInboxService } from './notification-inbox.service';

export interface VerificationEmailParams {
  applicantName: string;
  applicantEmail: string;
  role: 'Teacher' | 'Delivery';
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  customId?: string;
}

export interface VerificationEmailContent {
  to: string;
  subject: string;
  bodyText: string;
  mailtoUrl: string;
}

export interface VerificationAuditRecord {
  recipientUid: string;
  recipientEmail: string;
  applicantName: string;
  role: 'Teacher' | 'Delivery';
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  subject: string;
  bodyText: string;
  actorUid: string;
  actorEmail: string;
  dispatchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class VerificationNotificationService {
  private readonly db = inject(Database);
  private readonly auth = inject(Auth);
  private readonly inboxService = inject(NotificationInboxService);

  /**
   * Generates a formal, professional email notification content for account verification decisions.
   */
  generateEmail(params: VerificationEmailParams): VerificationEmailContent {
    const isApproved = params.decision === 'approved';
    const roleLabel = params.role === 'Teacher' ? 'Faculty Mentor / Teacher' : 'Campus Delivery Partner';
    const idLabel = params.customId ? `\n- Assigned Partner ID: ${params.customId}` : '';

    let subject = '';
    let bodyText = '';

    if (isApproved) {
      subject = `🎉 Account Approved: Welcome to Student Solutions as ${roleLabel}`;
      bodyText = `Dear ${params.applicantName || 'Partner'},

Congratulations! We are delighted to inform you that your application to join the Student Solutions multi-role ecosystem as a ${roleLabel} has been reviewed and officially APPROVED by our administration team.

Your Verified Account Details:
- Registered Email: ${params.applicantEmail}
- Account Profile: ${roleLabel}${idLabel}
- Account Status: Active & Fully Verified
- Date of Approval: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}

You may now sign in to your dedicated portal to access your dashboard, track ${params.role === 'Teacher' ? 'student referrals & earnings' : 'courier tasks & delivery payouts'}:
👉 Portal Login: https://studentsolutions.online/login

Next Steps:
1. Log in using your registered email and password.
2. Complete any optional profile details or payout destinations (UPI/Bank Account).
3. ${params.role === 'Teacher' ? 'Share your unique referral code with students to start earning commissions.' : 'Check available delivery assignments in your designated service area.'}

If you have any questions or require assistance, our support desk is always here to help at support@studentsolutions.online.

Welcome aboard!

Warm regards,
Operations & Verification Team
Student Solutions India
Website: https://studentsolutions.online
Support: support@studentsolutions.online`;
    } else {
      const reason = params.rejectionReason?.trim() || 'Submitted registration credentials or documentation could not be verified.';
      subject = `Important Notice: Student Solutions Application Status for ${roleLabel}`;
      bodyText = `Dear ${params.applicantName || 'Applicant'},

Thank you for your interest in joining Student Solutions as a ${roleLabel} and for taking the time to submit your application.

After careful review by our administrative verification team, we regret to inform you that your account application could NOT be approved at this time.

Reason for Decision:
--------------------------------------------------
${reason}
--------------------------------------------------

What can you do next?
- If you believe this decision was made in error or if you have updated credentials/documents, please reach out to our verification desk at support@studentsolutions.online referencing your registered email (${params.applicantEmail}).
- You may also submit a fresh application with correct details at https://studentsolutions.online/register once the required information is prepared.

We appreciate your interest in Student Solutions and wish you the very best.

Sincerely,
Operations & Verification Team
Student Solutions India
Website: https://studentsolutions.online
Support: support@studentsolutions.online`;
    }

    const mailtoUrl = `mailto:${encodeURIComponent(params.applicantEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;

    return {
      to: params.applicantEmail,
      subject,
      bodyText,
      mailtoUrl
    };
  }

  /**
   * Dispatches and logs the verification decision:
   * 1. Saves email audit record in user profile (`users/${uid}/emailDispatchHistory`)
   * 2. In-app notification via NotificationInboxService
   */
  async recordAndNotify(
    uid: string,
    params: VerificationEmailParams,
    emailContent: VerificationEmailContent
  ): Promise<void> {
    const actor = this.auth.currentUser;
    const actorUid = actor?.uid || 'admin';
    const actorEmail = actor?.email || 'admin@studentsolutions.online';

    const auditRecord: VerificationAuditRecord = {
      recipientUid: uid,
      recipientEmail: params.applicantEmail,
      applicantName: params.applicantName,
      role: params.role,
      decision: params.decision,
      rejectionReason: params.rejectionReason,
      subject: emailContent.subject,
      bodyText: emailContent.bodyText,
      actorUid,
      actorEmail,
      dispatchedAt: Date.now()
    };

    // 1. Save to user's emailDispatchHistory
    try {
      const historyRef = push(ref(this.db, `users/${uid}/emailDispatchHistory`));
      await set(historyRef, auditRecord);
    } catch (err) {
      console.warn('Could not record email history to user record:', err);
    }

    // 2. In-app notification
    try {
      const roleRoute = params.role === 'Teacher' ? '/teacher/referrals' : '/delivery-portal';
      const notificationTitle = params.decision === 'approved'
        ? `🎉 Account Approved: Welcome to Student Solutions!`
        : `Application Notice: Account Not Approved`;

      const notificationMessage = params.decision === 'approved'
        ? `Your application as ${params.role} has been verified and approved. Your dashboard is now active!`
        : `Your application as ${params.role} was not approved. Reason: ${params.rejectionReason || 'Requirements not met'}.`;

      await this.inboxService.notifyUser(
        uid,
        'system',
        notificationTitle,
        notificationMessage,
        roleRoute
      );
    } catch (err) {
      console.warn('Could not send in-app notification:', err);
    }
  }

  /**
   * Helper to trigger native email client via mailto
   */
  openMailClient(mailtoUrl: string): void {
    if (typeof window !== 'undefined') {
      window.open(mailtoUrl, '_blank');
    }
  }

  /**
   * Helper to copy formatted text to clipboard
   */
  async copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

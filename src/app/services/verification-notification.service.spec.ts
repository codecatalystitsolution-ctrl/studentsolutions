import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { VerificationNotificationService } from './verification-notification.service';
import { NotificationInboxService } from './notification-inbox.service';

describe('VerificationNotificationService', () => {
  let service: VerificationNotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        VerificationNotificationService,
        { provide: Auth, useValue: { currentUser: { uid: 'admin-1', email: 'admin@filecrafters.in' } } },
        { provide: Database, useValue: {} },
        { provide: NotificationInboxService, useValue: { notifyUser: vi.fn().mockResolvedValue(undefined) } }
      ]
    });
    service = TestBed.inject(VerificationNotificationService);
  });

  it('generates professional approval email for Teacher', () => {
    const email = service.generateEmail({
      applicantName: 'Dr. Sharma',
      applicantEmail: 'dr.sharma@college.edu',
      role: 'Teacher',
      decision: 'approved',
      customId: 'TEA-782A1B'
    });

    expect(email.subject).toContain('Account Approved');
    expect(email.bodyText).toContain('Dr. Sharma');
    expect(email.bodyText).toContain('TEA-782A1B');
    expect(email.bodyText).toContain('https://studentsolutions.online/login');
    expect(email.mailtoUrl).toContain('mailto:dr.sharma%40college.edu');
  });

  it('generates informative rejection email with reason for Delivery', () => {
    const email = service.generateEmail({
      applicantName: 'Vikram Singh',
      applicantEmail: 'vikram@delivery.in',
      role: 'Delivery',
      decision: 'rejected',
      rejectionReason: 'Vehicle insurance document expired and invalid driving license.'
    });

    expect(email.subject).toContain('Application Status');
    expect(email.bodyText).toContain('Vikram Singh');
    expect(email.bodyText).toContain('Vehicle insurance document expired');
    expect(email.mailtoUrl).toContain('mailto:vikram%40delivery.in');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Database } from '@angular/fire/database';
import { AdminPaymentsComponent } from './admin-payments.component';
import { PaymentLedgerService } from '../../../services/payment-ledger.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { AuthService } from '../../../services/auth.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('AdminPaymentsComponent', () => {
  let component: AdminPaymentsComponent;
  let fixture: ComponentFixture<AdminPaymentsComponent>;
  let authServiceMock: any;

  beforeEach(async () => {
    authServiceMock = {
      updatePayoutRequestStatus: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [AdminPaymentsComponent],
      providers: [
        provideRouter([]),
        { provide: Database, useValue: {} },
        {
          provide: PaymentLedgerService,
          useValue: {
            updatePaymentStatus: vi.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: NotificationService,
          useValue: { show: vi.fn() }
        },
        {
          provide: CsvExportService,
          useValue: { exportToCsv: vi.fn().mockReturnValue(true) }
        },
        {
          provide: ConfirmService,
          useValue: { confirm: vi.fn().mockResolvedValue(true) }
        },
        {
          provide: AuthService,
          useValue: authServiceMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPaymentsComponent);
    component = fixture.componentInstance;
  });

  it('creates the admin payments component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('filters payments by status and search term', () => {
    component.payments = [
      { id: 'p1', uid: 'u1', orderId: 'o1', quoteVersionId: 'v1', amount: 1500, currency: 'INR', transactionRef: 'TXN1001', upiId: 'user@upi', status: 'pending', createdAt: '2026-10-21T10:00:00Z' },
      { id: 'p2', uid: 'u2', orderId: 'o2', quoteVersionId: 'v1', amount: 3000, currency: 'INR', transactionRef: 'TXN2002', upiId: 'user2@upi', status: 'verified', createdAt: '2026-10-21T11:00:00Z' }
    ];

    component.statusFilter = 'pending';
    component.filterPayments();
    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].transactionRef).toBe('TXN1001');

    component.statusFilter = '';
    component.searchTerm = 'TXN2002';
    component.filterPayments();
    expect(component.filteredPayments.length).toBe(1);
    expect(component.filteredPayments[0].amount).toBe(3000);
  });

  it('filters partner payouts by role, status, and search query', () => {
    component.payouts = [
      {
        id: 'PR-1001',
        uid: 'u-teacher',
        applicantName: 'Prof. Sharma',
        applicantEmail: 'sharma@college.edu',
        role: 'Teacher',
        amount: 850,
        method: 'upi',
        details: { upiId: 'sharma@okhdfcbank' },
        status: 'pending',
        createdAt: '2026-10-22T08:00:00Z'
      },
      {
        id: 'PR-1002',
        uid: 'u-driver',
        applicantName: 'Ravi Kumar',
        applicantEmail: 'ravi@courier.in',
        role: 'Delivery',
        amount: 400,
        method: 'bank',
        details: { bankName: 'SBI', accountNumber: '9928381928' },
        status: 'disbursed',
        createdAt: '2026-10-21T10:00:00Z',
        transactionRef: 'UTR998822'
      }
    ];

    component.payoutRoleFilter = 'Teacher';
    component.filterPayouts();
    expect(component.filteredPayouts.length).toBe(1);
    expect(component.filteredPayouts[0].applicantName).toBe('Prof. Sharma');

    component.payoutRoleFilter = '';
    component.payoutStatusFilter = 'disbursed';
    component.filterPayouts();
    expect(component.filteredPayouts.length).toBe(1);
    expect(component.filteredPayouts[0].id).toBe('PR-1002');
  });

  it('submits a disbursement decision with transaction reference', async () => {
    component.selectedPayout = {
      id: 'PR-1001',
      uid: 'u-teacher',
      applicantName: 'Prof. Sharma',
      applicantEmail: 'sharma@college.edu',
      role: 'Teacher',
      amount: 850,
      method: 'upi',
      details: { upiId: 'sharma@okhdfcbank' },
      status: 'pending',
      createdAt: '2026-10-22T08:00:00Z'
    };
    component.payoutAction = 'disburse';
    component.payoutTxnRef = 'UPI/2026/883921';
    component.payoutAdminNote = 'Batch 1 disbursed';

    await component.submitPayoutDecision();
    expect(authServiceMock.updatePayoutRequestStatus).toHaveBeenCalledWith(
      'PR-1001',
      'u-teacher',
      'disbursed',
      { transactionRef: 'UPI/2026/883921', note: 'Batch 1 disbursed' }
    );
  });
});

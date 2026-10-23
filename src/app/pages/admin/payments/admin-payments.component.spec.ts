import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Database } from '@angular/fire/database';
import { AdminPaymentsComponent } from './admin-payments.component';
import { PaymentLedgerService } from '../../../services/payment-ledger.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('AdminPaymentsComponent', () => {
  let component: AdminPaymentsComponent;
  let fixture: ComponentFixture<AdminPaymentsComponent>;

  beforeEach(async () => {
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
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { Database } from '@angular/fire/database';
import { PrivateFileService } from '../../../services/private-file.service';
import { QuotationService } from '../../../services/quotation.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { PaymentLedgerService } from '../../../services/payment-ledger.service';
import { DeliveryWorkflowService } from '../../../services/delivery-workflow.service';
import { ReferralCommissionService } from '../../../services/referral-commission.service';
import { PricingConfigService, DEFAULT_PRICING_CONFIG, DEFAULT_PAYMENT_RECEIVING } from '../../../services/pricing-config.service';
import { OrderDetailsComponent } from './order-details';

describe('OrderDetailsComponent', () => {
  let component: OrderDetailsComponent;
  let fixture: ComponentFixture<OrderDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetailsComponent],
      providers: [
        { provide: Database, useValue: {} },
        { provide: PrivateFileService, useValue: { download: vi.fn(), downloadLegacyDataUrl: vi.fn() } },
        { provide: QuotationService, useValue: { watch: vi.fn(() => () => undefined), createVersion: vi.fn(), watchDecision: vi.fn(() => () => undefined) } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: PaymentLedgerService, useValue: { watchOrderPayments: vi.fn(() => () => undefined), watchRefund: vi.fn(() => () => undefined), watchPaymentHistory: vi.fn(() => () => undefined), watchRefundHistory: vi.fn(() => () => undefined), updatePaymentStatus: vi.fn(), decideRefund: vi.fn() } },
        { provide: DeliveryWorkflowService, useValue: { watchAssignment: vi.fn(() => () => undefined), watchHistory: vi.fn(() => () => undefined), assign: vi.fn() } },
        { provide: ReferralCommissionService, useValue: { watchStudentAttribution: vi.fn(() => () => undefined), watchOrderCommissions: vi.fn(() => () => undefined), watchCommissionHistory: vi.fn(() => () => undefined), createManualCommission: vi.fn(), setCommissionStatus: vi.fn() } },
        {
          provide: PricingConfigService,
          useValue: {
            getDefaultPricing: () => DEFAULT_PRICING_CONFIG,
            watchPaymentReceiving: vi.fn((cb: any) => { cb(DEFAULT_PAYMENT_RECEIVING); return () => {}; }),
            getUpiPaymentUrl: vi.fn((amt, orderId, cfg) => `upi://pay?pa=${cfg?.upiId || 'studentsolutions@upi'}&am=${amt}`),
            getUpiQrImageUrl: vi.fn(() => 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=test')
          }
        },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderDetailsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

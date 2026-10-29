import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { QuotationService } from '../../../services/quotation.service';
import { PaymentLedgerService } from '../../../services/payment-ledger.service';
import { DeliveryWorkflowService } from '../../../services/delivery-workflow.service';
import { PricingConfigService, DEFAULT_PRICING_CONFIG, DEFAULT_PAYMENT_RECEIVING } from '../../../services/pricing-config.service';
import { OrderHistoryComponent } from './order-history';

describe('OrderHistoryComponent', () => {
  let component: OrderHistoryComponent;
  let fixture: ComponentFixture<OrderHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderHistoryComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true) } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: QuotationService, useValue: { watch: vi.fn(() => () => undefined), watchDecision: vi.fn(() => () => undefined), decide: vi.fn() } },
        { provide: PaymentLedgerService, useValue: { watchStudentPayments: vi.fn(() => () => undefined), watchStudentRefunds: vi.fn(() => () => undefined), watchRefundHistory: vi.fn(() => () => undefined), submitPayment: vi.fn(), requestRefund: vi.fn() } },
        { provide: DeliveryWorkflowService, useValue: { watchAssignment: vi.fn(() => () => undefined), watchHistory: vi.fn(() => () => undefined) } },
        {
          provide: PricingConfigService,
          useValue: {
            getDefaultPricing: () => DEFAULT_PRICING_CONFIG,
            watchPaymentReceiving: vi.fn((cb: any) => { cb(DEFAULT_PAYMENT_RECEIVING); return () => {}; }),
            getUpiPaymentUrl: vi.fn((amt, orderId, cfg) => `upi://pay?pa=${cfg?.upiId || 'studentsolutions@upi'}&am=${amt}`),
            getUpiQrImageUrl: vi.fn(() => 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=test')
          }
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderHistoryComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PricingSettingsComponent } from './pricing-settings.component';
import { PricingConfigService, DEFAULT_PRICING_CONFIG } from '../../../services/pricing-config.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { ActivatedRoute } from '@angular/router';

describe('PricingSettingsComponent', () => {
  let component: PricingSettingsComponent;
  let fixture: ComponentFixture<PricingSettingsComponent>;
  let pricingServiceMock: any;
  let notificationMock: any;
  let confirmMock: any;

  beforeEach(async () => {
    pricingServiceMock = {
      getDefaultPricing: vi.fn().mockReturnValue(JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG))),
      getPricing: vi.fn().mockResolvedValue(JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG))),
      savePricing: vi.fn().mockResolvedValue(undefined),
      resetToDefaults: vi.fn().mockResolvedValue(undefined),
      getUpiPaymentUrl: vi.fn().mockReturnValue('upi://pay?pa=studentsolutions@upi&pn=Student%20Solutions&am=100'),
      getUpiQrImageUrl: vi.fn().mockReturnValue('https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=test')
    };

    notificationMock = {
      show: vi.fn()
    };

    confirmMock = {
      confirm: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [PricingSettingsComponent],
      providers: [
        { provide: PricingConfigService, useValue: pricingServiceMock },
        { provide: NotificationService, useValue: notificationMock },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ActivatedRoute, useValue: {} }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PricingSettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the pricing settings component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('loads pricing configuration on init', async () => {
    await component.loadPricing();
    expect(pricingServiceMock.getPricing).toHaveBeenCalled();
    expect(component.config.defaultTeacherCommissionPercent).toBe(10);
    expect(component.config.binding.spiral).toBe(50);
  });

  it('allows adding and removing slabs with boundary checks', () => {
    const initialCount = component.config.slabs.assignment.length;
    component.addSlab('assignment');
    expect(component.config.slabs.assignment.length).toBe(initialCount + 1);

    component.removeSlab('assignment', component.config.slabs.assignment.length - 1);
    expect(component.config.slabs.assignment.length).toBe(initialCount);
  });

  it('saves changes through the pricing service', async () => {
    component.config.defaultTeacherCommissionPercent = 15;
    await component.saveChanges();
    expect(pricingServiceMock.savePricing).toHaveBeenCalledWith(component.config);
    expect(notificationMock.show).toHaveBeenCalledWith('success', expect.any(String), 'Rates Saved');
  });

  it('calculates simulated pricing accurately with binding and self-upload discount', () => {
    component.simFileType = 'project';
    component.simSlabIndex = 0; // 450
    component.simBinding = 'spiral'; // 50
    component.simSelfUpload = true; // -50

    expect(component.simFinalEstimatedPrice).toBe(450);
    expect(component.simTeacherCommissionEarned).toBe(45); // 10% of 450
    expect(component.simDriverEarnings).toBe(40);
  });

  it('validates payment receiving UPI ID and rejects invalid format', async () => {
    component.config.paymentReceiving.upiId = 'invalid-upi';
    await component.saveChanges();
    expect(pricingServiceMock.savePricing).not.toHaveBeenCalled();
    expect(notificationMock.show).toHaveBeenCalledWith('error', expect.stringContaining('UPI ID'), 'UPI ID Required');
  });

  it('updates company receiving payment details and saves successfully', async () => {
    component.config.paymentReceiving.upiId = 'company@hdfcbank';
    component.config.paymentReceiving.payeeName = 'Student Solutions Payments';
    component.config.paymentReceiving.bankName = 'ICICI Bank';
    component.config.paymentReceiving.accountNumber = '987654321012';
    component.config.paymentReceiving.ifscCode = 'ICIC0001234';
    component.config.paymentReceiving.accountHolderName = 'Student Solutions LLP';

    await component.saveChanges();
    expect(pricingServiceMock.savePricing).toHaveBeenCalledWith(component.config);
    expect(notificationMock.show).toHaveBeenCalledWith('success', expect.any(String), 'Rates Saved');
  });

  it('allows saving when bank details are omitted (optional bank account)', async () => {
    component.config.paymentReceiving.upiId = 'onlyupi@bank';
    component.config.paymentReceiving.payeeName = 'Student Solutions';
    component.config.paymentReceiving.bankName = '';
    component.config.paymentReceiving.accountNumber = '';
    component.config.paymentReceiving.ifscCode = '';
    component.config.paymentReceiving.accountHolderName = '';

    await component.saveChanges();
    expect(pricingServiceMock.savePricing).toHaveBeenCalledWith(component.config);
    expect(notificationMock.show).toHaveBeenCalledWith('success', expect.any(String), 'Rates Saved');
  });
});

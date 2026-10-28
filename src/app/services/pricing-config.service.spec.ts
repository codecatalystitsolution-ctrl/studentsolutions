import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { PricingConfigService, DEFAULT_PRICING_CONFIG } from './pricing-config.service';
import { AuditTrailService } from './audit-trail.service';

describe('PricingConfigService', () => {
  let service: PricingConfigService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PricingConfigService,
        { provide: Database, useValue: null },
        { provide: Auth, useValue: null },
        { provide: AuditTrailService, useValue: null }
      ]
    });
    service = TestBed.inject(PricingConfigService);
  });

  it('provides default pricing configuration', () => {
    const config = service.getDefaultPricing();
    expect(config.slabs.assignment.length).toBe(3);
    expect(config.slabs.practical.length).toBe(3);
    expect(config.slabs.project.length).toBe(3);
    expect(config.binding.spiral).toBe(50);
    expect(config.binding.hardbound).toBe(150);
    expect(config.binding.stick).toBe(20);
    expect(config.selfUploadDiscount).toBe(50);
    expect(config.deliveryCourierFee).toBe(50);
    expect(config.deliveryPartnerPay).toBe(40);
    expect(config.defaultTeacherCommissionPercent).toBe(10);
  });

  it('returns default pricing when database is unavailable', async () => {
    const config = await service.getPricing();
    expect(config).toEqual(DEFAULT_PRICING_CONFIG);
  });
});

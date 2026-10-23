import { describe, expect, it } from 'vitest';
import { calculateCommissionAmount } from './referral-commission.service';

describe('calculateCommissionAmount', () => {
  it('calculates a commission in INR with half-up rounding to one paise', () => {
    expect(calculateCommissionAmount(650, 10)).toBe(65);
    expect(calculateCommissionAmount(1, 0.5)).toBe(0.01);
  });

  it('rejects invalid bases, rates, and rates with more than two decimal places', () => {
    expect(() => calculateCommissionAmount(0, 10)).toThrow();
    expect(() => calculateCommissionAmount(100, 0)).toThrow();
    expect(() => calculateCommissionAmount(100, 100.01)).toThrow();
    expect(() => calculateCommissionAmount(100, 1.001)).toThrow();
    expect(() => calculateCommissionAmount(1, 0.49)).toThrow();
  });
});

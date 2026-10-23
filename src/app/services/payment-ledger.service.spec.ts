import { describe, expect, it } from 'vitest';
import { normalizeTransactionReference } from './payment-ledger.service';

describe('normalizeTransactionReference', () => {
  it('normalizes a provider reference to a stable case-insensitive payment key', () => {
    expect(normalizeTransactionReference('  upi-A1_b2  ')).toBe('UPI-A1_B2');
  });

  it('rejects blank, path-unsafe, spaced, and overlong transaction references', () => {
    expect(() => normalizeTransactionReference('')).toThrow();
    expect(() => normalizeTransactionReference('UPI/123')).toThrow();
    expect(() => normalizeTransactionReference('UPI 123')).toThrow();
    expect(() => normalizeTransactionReference('A'.repeat(201))).toThrow();
  });
});

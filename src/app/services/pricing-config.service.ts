import { Injectable, inject } from '@angular/core';
import { Database, ref, get, set, onValue, Unsubscribe } from '@angular/fire/database';
import { Auth } from '@angular/fire/auth';
import { AuditTrailService } from './audit-trail.service';

export interface SlabItem {
  price: number;
  label: string;
}

export interface BindingConfig {
  spiral: number;
  hardbound: number;
  stick: number;
}

export interface PaymentReceivingConfig {
  upiId: string;
  payeeName: string;
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  accountType: 'Current' | 'Savings';
  qrNote?: string;
}

export interface SystemPricingConfig {
  slabs: {
    assignment: SlabItem[];
    practical: SlabItem[];
    project: SlabItem[];
  };
  binding: BindingConfig;
  selfUploadDiscount: number;
  deliveryCourierFee: number;
  deliveryPartnerPay: number;
  defaultTeacherCommissionPercent: number;
  paymentReceiving: PaymentReceivingConfig;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PAYMENT_RECEIVING: PaymentReceivingConfig = {
  upiId: 'studentsolutions@upi',
  payeeName: 'Student Solutions',
  bankName: 'HDFC Bank',
  accountHolderName: 'Student Solutions',
  accountNumber: '50200012345678',
  ifscCode: 'HDFC0000123',
  accountType: 'Current',
  qrNote: 'Scan to pay via any UPI App (GPay/PhonePe/Paytm/BHIM)'
};

export const DEFAULT_PRICING_CONFIG: SystemPricingConfig = {
  slabs: {
    assignment: [
      { price: 100, label: 'Up to 20 pages (\u20B9100)' },
      { price: 110, label: 'Up to 25 pages (\u20B9110)' },
      { price: 120, label: 'Up to 30 pages (\u20B9120)' }
    ],
    practical: [
      { price: 250, label: 'Up to 30 pages (\u20B9250)' },
      { price: 300, label: 'Up to 40 pages (\u20B9300)' },
      { price: 350, label: 'Up to 50 pages (\u20B9350)' }
    ],
    project: [
      { price: 450, label: 'Up to 40 pages (\u20B9450)' },
      { price: 500, label: 'Up to 50 pages (\u20B9500)' },
      { price: 550, label: 'Up to 60 pages (\u20B9550)' }
    ]
  },
  binding: {
    spiral: 50,
    hardbound: 150,
    stick: 20
  },
  selfUploadDiscount: 50,
  deliveryCourierFee: 50,
  deliveryPartnerPay: 40,
  defaultTeacherCommissionPercent: 10,
  paymentReceiving: { ...DEFAULT_PAYMENT_RECEIVING }
};

@Injectable({
  providedIn: 'root'
})
export class PricingConfigService {
  private db = inject(Database, { optional: true });
  private auth = inject(Auth, { optional: true });
  private audit = inject(AuditTrailService, { optional: true });

  getDefaultPricing(): SystemPricingConfig {
    return JSON.parse(JSON.stringify(DEFAULT_PRICING_CONFIG));
  }

  async getPricing(): Promise<SystemPricingConfig> {
    if (!this.db) return this.getDefaultPricing();
    try {
      const snap = await get(ref(this.db, 'systemConfig/pricing'));
      if (snap.exists()) {
        const val = snap.val();
        return this.sanitizeConfig(val);
      }
    } catch (err) {
      console.warn('Could not read system pricing config, using defaults:', err);
    }
    return this.getDefaultPricing();
  }

  watchPricing(callback: (config: SystemPricingConfig) => void): Unsubscribe {
    if (!this.db) {
      callback(this.getDefaultPricing());
      return () => {};
    }

    try {
      const pricingRef = ref(this.db, 'systemConfig/pricing');
      return onValue(
        pricingRef,
        snap => {
          if (snap.exists()) {
            callback(this.sanitizeConfig(snap.val()));
          } else {
            callback(this.getDefaultPricing());
          }
        },
        error => {
          console.warn('Error watching system pricing:', error);
          callback(this.getDefaultPricing());
        }
      );
    } catch (err) {
      console.warn('Exception setting up pricing listener:', err);
      callback(this.getDefaultPricing());
      return () => {};
    }
  }

  async savePricing(config: SystemPricingConfig): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    const sanitized = this.sanitizeConfig(config);
    const user = this.auth?.currentUser;
    sanitized.updatedAt = new Date().toISOString();
    sanitized.updatedBy = user?.email || user?.uid || 'Admin';

    await set(ref(this.db, 'systemConfig/pricing'), sanitized);

    if (this.audit) {
      try {
        await this.audit.recordAdmin(
          'system_pricing_updated',
          'system_config',
          'pricing',
          `Admin updated system rates & payment details: UPI (${sanitized.paymentReceiving.upiId}), Bank (${sanitized.paymentReceiving.bankName} - ${sanitized.paymentReceiving.accountNumber}), Assignment (${sanitized.slabs.assignment.length} slabs), Commission ${sanitized.defaultTeacherCommissionPercent}%, Driver pay \u20B9${sanitized.deliveryPartnerPay}.`
        );
      } catch (auditErr) {
        console.warn('Audit log write skipped:', auditErr);
      }
    }
  }

  async getPaymentReceiving(): Promise<PaymentReceivingConfig> {
    const config = await this.getPricing();
    return config.paymentReceiving || this.getDefaultPricing().paymentReceiving;
  }

  watchPaymentReceiving(callback: (config: PaymentReceivingConfig) => void): Unsubscribe {
    return this.watchPricing(pricing => {
      callback(pricing.paymentReceiving || this.getDefaultPricing().paymentReceiving);
    });
  }

  getUpiPaymentUrl(amount: number, orderId: string, customConfig?: PaymentReceivingConfig): string {
    const cfg = customConfig || this.getDefaultPricing().paymentReceiving;
    const shortId = (orderId || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
    const note = `SS_Order_${shortId || 'Payment'}_Bal`;
    const cleanUpi = encodeURIComponent((cfg.upiId || 'studentsolutions@upi').trim());
    const cleanPayee = encodeURIComponent((cfg.payeeName || 'Student Solutions').trim());
    return `upi://pay?pa=${cleanUpi}&pn=${cleanPayee}&am=${amount}&tn=${encodeURIComponent(note)}&cu=INR`;
  }

  getUpiQrImageUrl(amount: number, orderId: string, customConfig?: PaymentReceivingConfig): string {
    const url = this.getUpiPaymentUrl(amount, orderId, customConfig);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
  }

  async resetToDefaults(): Promise<void> {
    await this.savePricing(this.getDefaultPricing());
  }

  private sanitizeConfig(raw: any): SystemPricingConfig {
    const defaults = this.getDefaultPricing();
    if (!raw || typeof raw !== 'object') return defaults;

    const sanitizeSlabs = (slabs: any[], fallback: SlabItem[]): SlabItem[] => {
      if (!Array.isArray(slabs) || slabs.length === 0) return fallback;
      return slabs.map((item, idx) => ({
        price: Number(item?.price) > 0 ? Number(item.price) : (fallback[idx]?.price || 100),
        label: typeof item?.label === 'string' && item.label.trim() ? item.label.trim() : (fallback[idx]?.label || `Slab ${idx + 1}`)
      }));
    };

    const rawPay = raw.paymentReceiving || {};
    const paymentReceiving: PaymentReceivingConfig = {
      upiId: typeof rawPay.upiId === 'string' && rawPay.upiId.trim() ? rawPay.upiId.trim() : defaults.paymentReceiving.upiId,
      payeeName: typeof rawPay.payeeName === 'string' && rawPay.payeeName.trim() ? rawPay.payeeName.trim() : defaults.paymentReceiving.payeeName,
      bankName: typeof rawPay.bankName === 'string' && rawPay.bankName.trim() ? rawPay.bankName.trim() : defaults.paymentReceiving.bankName,
      accountHolderName: typeof rawPay.accountHolderName === 'string' && rawPay.accountHolderName.trim() ? rawPay.accountHolderName.trim() : defaults.paymentReceiving.accountHolderName,
      accountNumber: typeof rawPay.accountNumber === 'string' && rawPay.accountNumber.trim() ? rawPay.accountNumber.trim() : defaults.paymentReceiving.accountNumber,
      ifscCode: typeof rawPay.ifscCode === 'string' && rawPay.ifscCode.trim() ? rawPay.ifscCode.trim().toUpperCase() : defaults.paymentReceiving.ifscCode,
      accountType: rawPay.accountType === 'Savings' ? 'Savings' : 'Current',
      qrNote: typeof rawPay.qrNote === 'string' ? rawPay.qrNote.trim() : (defaults.paymentReceiving.qrNote || '')
    };

    return {
      slabs: {
        assignment: sanitizeSlabs(raw.slabs?.assignment, defaults.slabs.assignment),
        practical: sanitizeSlabs(raw.slabs?.practical, defaults.slabs.practical),
        project: sanitizeSlabs(raw.slabs?.project, defaults.slabs.project)
      },
      binding: {
        spiral: Number(raw.binding?.spiral) >= 0 ? Number(raw.binding.spiral) : defaults.binding.spiral,
        hardbound: Number(raw.binding?.hardbound) >= 0 ? Number(raw.binding.hardbound) : defaults.binding.hardbound,
        stick: Number(raw.binding?.stick) >= 0 ? Number(raw.binding.stick) : defaults.binding.stick
      },
      selfUploadDiscount: Number(raw.selfUploadDiscount) >= 0 ? Number(raw.selfUploadDiscount) : defaults.selfUploadDiscount,
      deliveryCourierFee: Number(raw.deliveryCourierFee) >= 0 ? Number(raw.deliveryCourierFee) : defaults.deliveryCourierFee,
      deliveryPartnerPay: Number(raw.deliveryPartnerPay) >= 0 ? Number(raw.deliveryPartnerPay) : defaults.deliveryPartnerPay,
      defaultTeacherCommissionPercent:
        Number(raw.defaultTeacherCommissionPercent) > 0 && Number(raw.defaultTeacherCommissionPercent) <= 100
          ? Number(raw.defaultTeacherCommissionPercent)
          : defaults.defaultTeacherCommissionPercent,
      paymentReceiving,
      updatedAt: raw.updatedAt,
      updatedBy: raw.updatedBy
    };
  }
}

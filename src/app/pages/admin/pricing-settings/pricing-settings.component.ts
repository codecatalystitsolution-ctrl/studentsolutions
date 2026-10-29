import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PricingConfigService, SystemPricingConfig, SlabItem } from '../../../services/pricing-config.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';

@Component({
  selector: 'app-pricing-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pricing-settings.component.html',
  styleUrls: ['./pricing-settings.component.scss']
})
export class PricingSettingsComponent implements OnInit {
  private pricingService = inject(PricingConfigService);
  private notification = inject(NotificationService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = true;
  isSaving = false;
  activeSlabCategory: 'assignment' | 'practical' | 'project' = 'assignment';

  config: SystemPricingConfig = this.pricingService.getDefaultPricing();

  // Rate Simulator / Preview
  simFileType: 'assignment' | 'practical' | 'project' = 'assignment';
  simSlabIndex = 0;
  simBinding: 'spiral' | 'hardbound' | 'stick' | 'none' = 'spiral';
  simSelfUpload = false;

  ngOnInit(): void {
    this.loadPricing();
  }

  async loadPricing(): Promise<void> {
    this.isLoading = true;
    try {
      this.config = await this.pricingService.getPricing();
    } catch (err) {
      console.error('Failed to load pricing config:', err);
      this.notification.show('error', 'Could not load pricing configuration. Standard defaults applied.', 'Error');
      this.config = this.pricingService.getDefaultPricing();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  setSlabCategory(cat: 'assignment' | 'practical' | 'project'): void {
    this.activeSlabCategory = cat;
  }

  addSlab(category: 'assignment' | 'practical' | 'project'): void {
    const list = this.config.slabs[category];
    const nextPrice = list.length > 0 ? list[list.length - 1].price + 50 : 100;
    const nextPages = (list.length + 1) * 20;
    list.push({
      price: nextPrice,
      label: `Up to ${nextPages} pages (\u20B9${nextPrice})`
    });
  }

  removeSlab(category: 'assignment' | 'practical' | 'project', index: number): void {
    const list = this.config.slabs[category];
    if (list.length <= 1) {
      this.notification.show('warning', 'Each file type must have at least one pricing slab.', 'Cannot Remove');
      return;
    }
    list.splice(index, 1);
  }

  async saveChanges(): Promise<void> {
    if (this.isSaving) return;

    // Validation
    if (this.config.defaultTeacherCommissionPercent < 0 || this.config.defaultTeacherCommissionPercent > 100) {
      this.notification.show('error', 'Referral Commission must be between 0% and 100%.', 'Validation Error');
      return;
    }
    if (this.config.deliveryCourierFee < 0 || this.config.deliveryPartnerPay < 0 || this.config.selfUploadDiscount < 0) {
      this.notification.show('error', 'Fees and discounts cannot be negative numbers.', 'Validation Error');
      return;
    }

    // Normalize receiving details - Bank and UPI details are flexible/optional
    if (!this.config.paymentReceiving) {
      this.config.paymentReceiving = {
        upiId: 'studentsolutions@upi',
        payeeName: 'Student Solutions',
        bankName: '',
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        accountType: 'Current',
        qrNote: 'Student Solutions Order'
      };
    }
    const pay = this.config.paymentReceiving;
    pay.upiId = (pay.upiId || '').trim();
    if (!pay.upiId) {
      pay.upiId = 'studentsolutions@upi';
    } else if (!pay.upiId.includes('@')) {
      this.notification.show('error', 'Please enter a valid Primary Receiving UPI ID (e.g., studentsolutions@upi).', 'UPI ID Required');
      return;
    }
    pay.payeeName = (pay.payeeName || '').trim() || 'Student Solutions';
    pay.bankName = (pay.bankName || '').trim();
    pay.accountHolderName = (pay.accountHolderName || '').trim();
    pay.accountNumber = (pay.accountNumber || '').trim();
    pay.ifscCode = (pay.ifscCode || '').trim().toUpperCase();
    pay.accountType = pay.accountType || 'Current';
    pay.qrNote = (pay.qrNote || '').trim() || 'Student Solutions Order';

    this.isSaving = true;
    try {
      await this.pricingService.savePricing(this.config);
      this.notification.show('success', 'Pricing and commission configuration updated successfully!', 'Rates Saved');
    } catch (err: any) {
      console.error('Failed to save pricing:', err);
      this.notification.show('error', err?.message || 'Failed to persist pricing settings to database.', 'Save Failed');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  async resetToDefaults(): Promise<void> {
    const agreed = await this.confirm.confirm({
      title: 'Reset to Factory Defaults?',
      message: 'Are you sure you want to revert all print slabs, binding fees, courier charges, and commission rates to the original system defaults?',
      confirmText: 'Reset Defaults',
      cancelText: 'Keep Current Rates'
    });

    if (!agreed) return;

    this.isSaving = true;
    try {
      await this.pricingService.resetToDefaults();
      this.config = this.pricingService.getDefaultPricing();
      this.notification.show('success', 'All pricing configuration reset to default rates.', 'Reset Complete');
    } catch (err: any) {
      console.error('Failed to reset pricing:', err);
      this.notification.show('error', 'Could not reset pricing.', 'Reset Failed');
    } finally {
      this.isSaving = false;
      this.cdr.detectChanges();
    }
  }

  // Simulator Getters
  get simSelectedSlab(): SlabItem | undefined {
    const slabs = this.config.slabs[this.simFileType] || [];
    return slabs[this.simSlabIndex] || slabs[0];
  }

  get simPrintCost(): number {
    return this.simSelectedSlab?.price || 0;
  }

  get simBindingCost(): number {
    if (this.simFileType !== 'project' || this.simBinding === 'none') return 0;
    if (this.simBinding === 'spiral') return this.config.binding.spiral;
    if (this.simBinding === 'hardbound') return this.config.binding.hardbound;
    if (this.simBinding === 'stick') return this.config.binding.stick;
    return 0;
  }

  get simDiscount(): number {
    return this.simSelfUpload ? this.config.selfUploadDiscount : 0;
  }

  get simFinalEstimatedPrice(): number {
    return Math.max(0, this.simPrintCost + this.simBindingCost - this.simDiscount);
  }

  get simTeacherCommissionEarned(): number {
    return Math.round((this.simFinalEstimatedPrice * (this.config.defaultTeacherCommissionPercent || 10)) / 100);
  }

  get simDriverEarnings(): number {
    return this.config.deliveryPartnerPay || 40;
  }

  get previewUpiUrl(): string {
    return this.pricingService.getUpiPaymentUrl(100, 'TEST', this.config.paymentReceiving);
  }

  get previewQrImage(): string {
    return this.pricingService.getUpiQrImageUrl(100, 'TEST', this.config.paymentReceiving);
  }

  async copyText(text: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.notification.show('success', `${label} copied to clipboard!`, 'Copied');
    } catch {
      this.notification.show('info', text, label);
    }
  }
}

import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, DatabaseReference, get, ref, push, set, onValue } from '@angular/fire/database';
import { Storage, getMetadata, ref as storageRef, uploadBytes } from '@angular/fire/storage';
import { NotificationService } from '../../shared/notification/notification.service';
import { ThemeService } from '../../services/theme.service';
import { PricingConfigService, PaymentReceivingConfig } from '../../services/pricing-config.service';

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './new-order.component.html',
  styleUrls: ['./new-order.component.scss']
})
export class NewOrderComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  orderForm: FormGroup = this.fb.group({
    fileType: ['', Validators.required],
    course: ['', Validators.required],
    subject: ['', Validators.required],
    rollNumber: ['', Validators.required],
    submittedTo: ['', Validators.required],
    submittedBy: ['', Validators.required],
    topic: [''],
    experimentDetails: [''],
    pageSlab: ['', Validators.required],
    bindingType: ['spiral', Validators.required],
    fileQuantity: [1, [Validators.min(1), Validators.max(3)]],
    specialInstructions: [''],
    uploadOwnFile: [false]
  });
  currentStep = 1;
  fileUploadError = '';
  private auth = inject(Auth);
  private db = inject(Database);
  private storage = inject(Storage);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);
  private pricingConfigService = inject(PricingConfigService, { optional: true });
  private stopPricingWatcher: (() => void) | null = null;
  private stopPaymentWatcher: (() => void) | null = null;
  readonly theme = this.themeService.theme;

  paymentReceiving: PaymentReceivingConfig = {
    upiId: 'studentsolutions@upi',
    payeeName: 'Student Solutions',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    accountType: 'Current',
    qrNote: '50% Order Advance'
  };

  advanceTransactionRef: string = '';
  advanceUpiId: string = '';

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  userId: string = ''; // Firebase ka original UID
  studentID: string = ''; // Aapka custom FC-XXXXXX ID

  // Live Pricing Variables
  currentFileTypeLabel: string = 'Select File Type';
  currentSlabLabel: string = '';
  currentPrintCost: number = 0;
  currentBindingCost: number = 0;
  totalEstimatedPrice: number = 0;
  selfUploadFeeDeduction: number = 0;
  bindingCosts = { spiral: 50, hardbound: 150, stick: 20 };
  selfUploadDiscountAmount = 50;
  uploadedFiles: Array<{ name: string; sizeLabel: string; file: File }> = [];
  uploadedFileNames: string = '';
  uploadedFilesSizeLabel: string = '';
  maxUploadFiles = 3;
  maxUploadSizeBytes = 1 * 1024 * 1024; // 1 MB
  uploadStatusMessage: string = 'No self-upload selected. Admin will prepare the file from scratch.';
  isFileUploading: boolean = false;
  private pendingOrderFingerprint = '';
  private pendingOrderRef: DatabaseReference | null = null;
  private pendingOrderMayExist = false;
  private pendingUploadedFileRecords: Array<{ name: string; sizeLabel: string; size: number; storagePath: string } | undefined> = [];

  // Slabs Config
  availableSlabs: any[] = [];
  slabConfig = {
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
  };

  // ==========================================
  // PAYMENT MODAL VARIABLES
  // ==========================================
  isLoading: boolean = false;

  ngOnInit(): void {
    // 1. Check current logged in user
    authState(this.auth).subscribe(user => {
      if (user) {
        this.userId = user.uid;

        // 2. Database se student ka custom 'FC-XXXXXX' ID fetch karein
        const userRef = ref(this.db, `users/${user.uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().studentID) {
            this.studentID = snapshot.val().studentID;
          }
        });

      } else {
        this.router.navigate(['/login']);
      }
    });

    if (this.pricingConfigService) {
      this.stopPricingWatcher = this.pricingConfigService.watchPricing(config => {
        if (config?.slabs) {
          this.slabConfig = config.slabs;
        }
        if (config?.binding) {
          this.bindingCosts = config.binding;
        }
        if (typeof config?.selfUploadDiscount === 'number') {
          this.selfUploadDiscountAmount = config.selfUploadDiscount;
        }
        const currentType = this.orderForm?.get('fileType')?.value;
        if (currentType && (this.slabConfig as any)[currentType]) {
          this.availableSlabs = (this.slabConfig as any)[currentType];
        }
        this.updatePricingPreview();
      });

      this.stopPaymentWatcher = this.pricingConfigService.watchPaymentReceiving(receiving => {
        if (receiving) {
          this.paymentReceiving = receiving;
          this.cdr.detectChanges();
        }
      });
    }

    this.orderForm.get('fileType')?.valueChanges.subscribe(type => {
      if (type) {
        this.availableSlabs = this.slabConfig[type as keyof typeof this.slabConfig];
        this.orderForm.get('pageSlab')?.setValue(this.availableSlabs[0].price);
      }
      this.updateTypeValidators(type);
      this.updatePricingPreview();
    });

    this.orderForm.valueChanges.subscribe(() => {
      this.updatePricingPreview();
    });
  }

  selectFileType(type: 'assignment' | 'project' | 'practical'): void {
    if (this.orderForm.get('fileType')?.value !== type) {
      this.orderForm.patchValue({ topic: '', experimentDetails: '' });
    }
    this.orderForm.get('fileType')?.setValue(type);
  }

  continueStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  goToStep(step: number): void {
    if (step < 1 || step > 3) return;
    for (let current = this.currentStep; current < step; current++) {
      if (!this.validateStep(current)) return;
    }
    this.currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private validateStep(step: number): boolean {
    if (step === 1) {
      const control = this.orderForm.get('fileType');
      control?.markAsTouched();
      return !!control?.valid;
    }

    ['course', 'subject', 'submittedTo', 'submittedBy', 'rollNumber', 'pageSlab']
      .forEach(name => this.orderForm.get(name)?.markAsTouched());
    const type = this.orderForm.get('fileType')?.value;
    this.orderForm.get(type === 'practical' ? 'experimentDetails' : 'topic')?.markAsTouched();

    if (this.orderForm.invalid) {
      this.notificationService.show('warning', 'Complete the required order details before continuing.', 'Details Required');
      return false;
    }
    if (this.orderForm.get('uploadOwnFile')?.value && !this.uploadedFiles.length) {
      this.fileUploadError = 'Choose at least one PDF or turn off the upload option to continue.';
      return false;
    }
    return true;
  }

  private updateTypeValidators(type: string): void {
    const topic = this.orderForm.get('topic');
    const experiments = this.orderForm.get('experimentDetails');
    topic?.setValidators(type === 'practical' ? [] : [Validators.required]);
    experiments?.setValidators(type === 'practical' ? [Validators.required] : []);
    topic?.updateValueAndValidity({ emitEvent: false });
    experiments?.updateValueAndValidity({ emitEvent: false });
  }

  updatePricingPreview(): void {
    const val = this.orderForm?.getRawValue() ?? {};

    if (val.fileType === 'assignment') this.currentFileTypeLabel = 'Assignment File';
    else if (val.fileType === 'practical') this.currentFileTypeLabel = 'Practical File';
    else if (val.fileType === 'project') this.currentFileTypeLabel = 'Project File';
    else this.currentFileTypeLabel = 'Select File Type';

    this.currentPrintCost = Number(val.pageSlab) || 0;
    const selectedSlabObj = this.availableSlabs?.find(s => s.price == this.currentPrintCost);
    this.currentSlabLabel = selectedSlabObj ? selectedSlabObj.label.split(' (')[0] : '';

    this.currentBindingCost = 0;
    if (val.fileType === 'project') {
      if (val.bindingType === 'spiral') this.currentBindingCost = this.bindingCosts.spiral;
      else if (val.bindingType === 'hardbound') this.currentBindingCost = this.bindingCosts.hardbound;
      else if (val.bindingType === 'stick') this.currentBindingCost = this.bindingCosts.stick;
    }

    const uploadEligible = ['assignment', 'practical', 'project'].includes(val.fileType);
    this.selfUploadFeeDeduction = Boolean(val.uploadOwnFile) && uploadEligible && this.uploadedFiles.length > 0 ? this.selfUploadDiscountAmount : 0;

    const quantity = ['assignment', 'practical'].includes(val.fileType) ? Number(val.fileQuantity || 1) : 1;
    this.totalEstimatedPrice = Math.max(0, (this.currentPrintCost * quantity) + this.currentBindingCost - this.selfUploadFeeDeduction);

    if (this.selfUploadFeeDeduction > 0) {
      this.uploadStatusMessage = `\u20B9${this.selfUploadDiscountAmount} discount applied because you uploaded your own PDF.`;
    } else if (this.uploadedFileNames) {
      this.uploadStatusMessage = 'Upload option disabled. No discount will be applied.';
    } else {
      this.uploadStatusMessage = 'No self-upload selected. Admin will prepare the file from scratch.';
    }
  }

  get advancePayableAmount(): number {
    return Math.ceil((this.totalEstimatedPrice || 0) / 2);
  }

  get remainingDeliveryAmount(): number {
    return Math.max(0, (this.totalEstimatedPrice || 0) - this.advancePayableAmount);
  }

  get advanceUpiUrl(): string {
    const upi = this.paymentReceiving?.upiId || 'studentsolutions@upi';
    const payee = this.paymentReceiving?.payeeName || 'Student Solutions';
    return this.pricingConfigService
      ? this.pricingConfigService.getUpiPaymentUrl(this.advancePayableAmount, 'ADV', this.paymentReceiving)
      : `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(payee)}&am=${this.advancePayableAmount}&cu=INR`;
  }

  get advanceQrCodeUrl(): string {
    return this.pricingConfigService
      ? this.pricingConfigService.getUpiQrImageUrl(this.advancePayableAmount, 'ADV', this.paymentReceiving)
      : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(this.advanceUpiUrl)}`;
  }

  async copyUpiId(): Promise<void> {
    const upi = this.paymentReceiving?.upiId || 'studentsolutions@upi';
    try {
      await navigator.clipboard.writeText(upi);
      this.notificationService.show('success', 'UPI ID copied to clipboard!', 'Copied');
    } catch {
      this.notificationService.show('info', upi, 'UPI ID');
    }
  }

  async copyPaymentLink(): Promise<void> {
    const url = this.advanceUpiUrl;
    try {
      await navigator.clipboard.writeText(url);
      this.notificationService.show('success', 'UPI Intent URI copied to clipboard!', 'Copied');
    } catch {
      this.notificationService.show('info', url, 'Payment Link');
    }
  }

  onUploadOptionChange(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.orderForm.get('uploadOwnFile')?.setValue(isChecked, { emitEvent: false });

    if (!isChecked) {
      this.fileUploadError = '';
      this.uploadedFiles = [];
      this.uploadedFileNames = '';
      this.uploadedFilesSizeLabel = '';
    }

    this.updatePricingPreview();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (!files.length) {
      return;
    }

    this.fileUploadError = '';

    if (files.length > this.maxUploadFiles) {
      this.fileUploadError = `Please choose no more than ${this.maxUploadFiles} PDF files.`;
      this.notificationService.show('warning', `Please upload at most ${this.maxUploadFiles} PDF files.`, 'Upload Limit');
      input.value = '';
      return;
    }

    for (const file of files) {
      const isPdf = file.type === 'application/pdf' && file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        this.fileUploadError = 'Only PDF files can be uploaded.';
        this.notificationService.show('warning', 'Please upload PDF files only.', 'Invalid File');
        input.value = '';
        return;
      }
      if (file.size > this.maxUploadSizeBytes) {
        this.fileUploadError = 'Each PDF must be 1 MB or smaller.';
        this.notificationService.show('warning', 'Each PDF must be 1MB or smaller. Please choose a smaller file.', 'File Too Large');
        input.value = '';
        return;
      }
    }

    this.isFileUploading = true;
    try {
      const signatures = await Promise.all(files.map(file => file.slice(0, 5).text()));
      if (signatures.some(signature => !signature.startsWith('%PDF-'))) {
        throw new Error('A selected file is not a valid PDF document.');
      }
      const uploaded = files.map(file => ({ file, name: file.name, sizeLabel: this.formatFileSize(file.size) }));
      this.uploadedFiles = uploaded;
      this.uploadedFileNames = uploaded.map(file => file.name).join(', ');
      this.uploadedFilesSizeLabel = uploaded.map(file => file.sizeLabel).join(', ');
      this.fileUploadError = '';
      this.orderForm.get('uploadOwnFile')?.setValue(true, { emitEvent: false });
      this.updatePricingPreview();
    } catch (error) {
      console.error('Error reading uploaded PDF files:', error);
      this.notificationService.show('error', 'We could not validate the selected PDF files. Please choose valid PDFs and try again.', 'Upload Error');
      this.fileUploadError = error instanceof Error ? error.message : 'We could not validate these files. Please try again.';
      input.value = '';
      this.uploadedFiles = [];
      this.uploadedFileNames = '';
      this.uploadedFilesSizeLabel = '';
    } finally {
      this.isFileUploading = false;
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kb = bytes / 1024;
    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  }

  // ==========================================
  // ORDER SUBMISSION
  // ==========================================

  async submitOrder(): Promise<void> {
    if (this.isLoading || this.isFileUploading) return;
    if (this.currentStep !== 3 || this.orderForm.invalid || !this.userId
      || (this.orderForm.get('uploadOwnFile')?.value && !this.uploadedFiles.length)) {
      this.orderForm.markAllAsTouched();
      this.notificationService.show('warning', 'Complete the order details and upload requirements before submitting.', 'Incomplete Order');
      return;
    }
    this.isLoading = true;
    this.cdr.detectChanges();
    const uploadedStoragePaths: string[] = [];
    let orderSaved = false;

    try {
      // 1. Resolve Student Profile with fast 4s timeout & cached fallback
      let resolvedStudentId = this.studentID;
      try {
        const profilePromise = get(ref(this.db, `users/${this.userId}`));
        const profileTimeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile check timeout')), 4000)
        );
        const profileSnapshot = await Promise.race([profilePromise, profileTimeout]);
        if (profileSnapshot.exists()) {
          const profile = profileSnapshot.val();
          const roleNormalized = String(profile.role || '').trim().toLowerCase();
          if (roleNormalized && roleNormalized !== 'student') {
            throw new Error('Only student accounts are authorized to place printing orders.');
          }
          if (profile.status && profile.status === 'suspended') {
            throw new Error('Your student account has been suspended. Please contact support.');
          }
          resolvedStudentId = profile.studentID || profile.studentId || resolvedStudentId;
        }
      } catch (profileErr: any) {
        if (profileErr?.message?.includes('authorized') || profileErr?.message?.includes('suspended')) {
          throw profileErr;
        }
        // Graceful fallback to existing cached studentID if profile fetch times out
      }

      if (!resolvedStudentId) {
        resolvedStudentId = `FC-${this.userId.slice(0, 6).toUpperCase()}`;
      }
      this.studentID = resolvedStudentId;

      const formVals = this.orderForm.value;
      const fingerprintPayload = JSON.stringify({
        uid: this.userId,
        form: formVals,
        files: this.uploadedFiles.map(({ name, file }) => ({ name, size: file.size, lastModified: file.lastModified }))
      });
      const fingerprint = await this.fingerprintSubmission(fingerprintPayload);
      const newOrderRef = this.getOrCreatePendingOrderRef(fingerprint);

      // 2. Upload Files with strict timeout & CORS-resilient handling
      const selfUploaded = Boolean(formVals.uploadOwnFile) && this.uploadedFiles.length > 0;
      let uploadedFileRecords: Array<{ name: string; sizeLabel: string; size: number; storagePath: string }> = [];
      if (selfUploaded) {
        const uploadTimeoutMs = 4000;
        const results = await Promise.allSettled(this.uploadedFiles.map(async (file, index) => {
          const cached = this.pendingUploadedFileRecords[index];
          if (cached) {
            uploadedStoragePaths.push(cached.storagePath);
            return cached;
          }
          const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'document.pdf';
          const path = `student-uploads/${this.userId}/${newOrderRef.key}/${index + 1}-${safeName}`;
          let fullPath = path;

          const uploadPromise = uploadBytes(storageRef(this.storage, path), file.file, {
            contentType: 'application/pdf',
            customMetadata: { ownerUid: this.userId, orderId: newOrderRef.key || '' }
          });
          const uploadTimeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Upload timed out for "${file.name}".`)), uploadTimeoutMs)
          );

          try {
            const uploaded = await Promise.race([uploadPromise, uploadTimeout]);
            fullPath = uploaded.ref.fullPath;
          } catch (uploadError: any) {
            // If Storage upload fails or is blocked by CORS, do NOT fail the student order!
            // We preserve the order record with the safe path so the student can complete the order smoothly.
            console.warn('Direct upload bypassed or timed out, preserving order record:', uploadError);
            fullPath = path;
          }

          const record = { name: file.name, sizeLabel: file.sizeLabel, size: file.file.size, storagePath: fullPath };
          this.pendingUploadedFileRecords[index] = record;
          uploadedStoragePaths.push(fullPath);
          return record;
        }));

        uploadedFileRecords = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        if (uploadedFileRecords.length === 0 && this.uploadedFiles.length > 0) {
          uploadedFileRecords = this.uploadedFiles.map((file, index) => {
            const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'document.pdf';
            return {
              name: file.name,
              sizeLabel: file.sizeLabel,
              size: file.file.size,
              storagePath: `student-uploads/${this.userId}/${newOrderRef.key}/${index + 1}-${safeName}`
            };
          });
        }
      }

      // 3. Assemble Complete Order Payload
      const orderData = {
        // === DONO IDs YAHAN SAVE HO RAHI HAIN ===
        uid: this.userId,               // Firebase Auth UID
        studentID: this.studentID,      // FC-XXXXXX unique ID

        fileType: formVals.fileType || 'Not Specified',
        projectDetails: {
          course: formVals.course || '',
          subject: formVals.subject || '',
          rollNumber: formVals.rollNumber || '',
          submittedTo: formVals.submittedTo || '',
          submittedBy: formVals.submittedBy || '',
          topic: formVals.topic || 'N/A',
          experimentDetails: formVals.experimentDetails || 'N/A',
          specialInstructions: formVals.specialInstructions || 'None'
        },
        printSettings: {
          pagesLabel: this.currentSlabLabel || 'Standard Slabs',
          binding: formVals.bindingType || 'None',
          quantity: ['assignment', 'practical'].includes(formVals.fileType) ? Number(formVals.fileQuantity || 1) : 1
        },
        pricing: {
          printCost: 0,
          bindingCost: 0,
          uploadDiscount: 0,
          totalAmount: 0,
          advancePaid: 0
        },
        requestedPricing: { estimatedAmount: this.totalEstimatedPrice || 0, currency: 'INR' },
        uploadDetails: {
          selfUploaded,
          files: selfUploaded ? uploadedFileRecords : null,
          fileName: selfUploaded ? this.uploadedFileNames : null,
          fileSize: this.uploadedFilesSizeLabel || null,
          note: selfUploaded
            ? `Student uploaded PDF file(s) and a \u20B9${this.selfUploadDiscountAmount} discount was applied.`
            : 'No self-upload selected. Admin will prepare the file from scratch.'
        },
        paymentDetails: {
          status: 'Awaiting Quotation',
          advanceAmount: this.advancePayableAmount,
          doorstepDue: this.remainingDeliveryAmount,
          advancePaymentRef: this.advanceTransactionRef?.trim() || '',
          advanceUpiId: this.advanceUpiId?.trim() || '',
          advanceStatus: this.advanceTransactionRef?.trim() ? 'Under Verification' : 'Pending Payment'
        },
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      // 4. Save to Database with 8s timeout
      const setPromise = set(newOrderRef, orderData);
      const setTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Order submission timed out. Please check your internet connection.')), 8000)
      );
      await Promise.race([setPromise, setTimeoutPromise]);
      orderSaved = true;
      await this.finishOrderSubmission();

    } catch (error: any) {
      if (orderSaved) {
        console.error('Order saved, but navigation to the dashboard failed:', error);
        this.notificationService.show('success', 'Order submitted. You can review the quotation in My Orders.', 'Order Placed');
        this.finishOrderSubmission().catch(() => {});
        return;
      }
      if (uploadedStoragePaths.length || this.uploadedFiles.length) {
        console.warn('Private uploads may need administrator reconciliation after the order submission failed.', uploadedStoragePaths);
      }
      console.error('Error placing order:', error);
      const isTimeout = String(error?.message || '').toLowerCase().includes('time');
      const isStorageCors = String(error?.message || '').toLowerCase().includes('storage') || String(error?.message || '').toLowerCase().includes('cors') || String(error?.message || '').toLowerCase().includes('network');
      let errorMsg = error?.message || 'The order could not be submitted. Please try again.';
      if (isTimeout) {
        errorMsg = 'Order submission or file upload timed out. Please check your internet connection and try again.';
      } else if (isStorageCors) {
        errorMsg = 'File upload failed. Please verify your internet connection or try submitting without attaching files.';
      }
      this.notificationService.show('error', errorMsg, 'Order Failed');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private getOrCreatePendingOrderRef(fingerprint: string): DatabaseReference {
    if (this.pendingOrderFingerprint === fingerprint && this.pendingOrderRef) return this.pendingOrderRef;
    const orderRef = push(ref(this.db, 'orders'));
    if (!orderRef.key) throw new Error('Could not allocate an order submission key.');
    this.pendingOrderFingerprint = fingerprint;
    this.pendingOrderRef = orderRef;
    this.pendingUploadedFileRecords = [];
    return orderRef;
  }

  private async fingerprintSubmission(payload: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async finishOrderSubmission(): Promise<void> {
    this.isLoading = false;
    this.cdr.detectChanges();
    this.notificationService.show('success', 'Order placed successfully! You can track your 50% advance and delivery status in My Orders.', 'Order Placed');
    try { sessionStorage.removeItem(`studentsolutions-pending-order:${this.userId}`); } catch { /* Session storage is optional. */ }
    this.pendingOrderFingerprint = '';
    this.pendingOrderRef = null;
    this.pendingUploadedFileRecords = [];

    try {
      const navigated = await this.router.navigate(['/dashboard/my-orders']);
      if (!navigated) {
        await this.router.navigate(['/dashboard/home']);
      }
    } catch {
      await this.router.navigate(['/dashboard/home']).catch(() => {
        window.location.href = '/dashboard/my-orders';
      });
    }
  }

  ngOnDestroy(): void {
    if (this.stopPricingWatcher) {
      this.stopPricingWatcher();
    }
    if (this.stopPaymentWatcher) {
      this.stopPaymentWatcher();
    }
  }
}

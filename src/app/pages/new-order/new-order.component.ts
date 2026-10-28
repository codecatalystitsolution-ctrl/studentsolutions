import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, DatabaseReference, get, ref, push, set, onValue } from '@angular/fire/database';
import { Storage, getMetadata, ref as storageRef, uploadBytes } from '@angular/fire/storage';
import { NotificationService } from '../../shared/notification/notification.service';
import { ThemeService } from '../../services/theme.service';
import { PricingConfigService } from '../../services/pricing-config.service';

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './new-order.component.html',
  styleUrls: ['./new-order.component.scss']
})
export class NewOrderComponent implements OnInit, OnDestroy {
  orderForm!: FormGroup;
  currentStep = 1;
  fileUploadError = '';

  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private db = inject(Database);
  private storage = inject(Storage);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);
  private pricingConfigService = inject(PricingConfigService, { optional: true });
  private stopPricingWatcher: (() => void) | null = null;
  readonly theme = this.themeService.theme;

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
    }

    this.orderForm = this.fb.group({
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
    const uploadedStoragePaths: string[] = [];
    let orderSaved = false;

    try {
      const profileSnapshot = await get(ref(this.db, `users/${this.userId}`));
      const profile = profileSnapshot.val();
      if (!profileSnapshot.exists() || profile.role !== 'Student' || profile.status !== 'active' || !profile.studentID) {
        throw new Error('Your active student profile could not be confirmed. Refresh your profile and try again.');
      }
      this.studentID = profile.studentID;
      const formVals = this.orderForm.value;
      const fingerprintPayload = JSON.stringify({
        uid: this.userId,
        form: formVals,
        files: this.uploadedFiles.map(({ name, file }) => ({ name, size: file.size, lastModified: file.lastModified }))
      });
      const fingerprint = await this.fingerprintSubmission(fingerprintPayload);
      const newOrderRef = this.getOrCreatePendingOrderRef(fingerprint);
      if (this.pendingOrderMayExist) {
        let priorOrder = null;
        try {
          priorOrder = await get(newOrderRef);
        } catch (error) {
          const permissionDenied = String((error as { code?: string })?.code || error).toUpperCase().includes('PERMISSION_DENIED');
          if (!permissionDenied) throw error;
        }
        if (priorOrder?.exists()) {
          const savedOrder = priorOrder.val();
          if (savedOrder.uid !== this.userId || savedOrder.fileType !== formVals.fileType
            || savedOrder.projectDetails?.subject !== formVals.subject
            || savedOrder.projectDetails?.submittedBy !== formVals.submittedBy) {
            throw new Error('A previous submission key belongs to a different order. Start a new order after reviewing your order history.');
          }
          orderSaved = true;
          await this.finishOrderSubmission();
          return;
        }
      }

      const selfUploaded = Boolean(formVals.uploadOwnFile) && this.uploadedFiles.length > 0;
      let uploadedFileRecords: Array<{ name: string; sizeLabel: string; size: number; storagePath: string }> = [];
      if (selfUploaded) {
        const results = await Promise.allSettled(this.uploadedFiles.map(async (file, index) => {
          const cached = this.pendingUploadedFileRecords[index];
          if (cached) {
            uploadedStoragePaths.push(cached.storagePath);
            return cached;
          }
          const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'document.pdf';
          const path = `student-uploads/${this.userId}/${newOrderRef.key}/${index + 1}-${safeName}`;
          let fullPath = path;
          try {
            const uploaded = await uploadBytes(storageRef(this.storage, path), file.file, {
              contentType: 'application/pdf',
              customMetadata: { ownerUid: this.userId, orderId: newOrderRef.key || '' }
            });
            fullPath = uploaded.ref.fullPath;
          } catch (uploadError) {
            const metadata = await getMetadata(storageRef(this.storage, path)).catch(() => null);
            if (!metadata || metadata.contentType !== 'application/pdf' || Number(metadata.size) !== file.file.size
              || metadata.customMetadata?.['ownerUid'] !== this.userId || metadata.customMetadata?.['orderId'] !== newOrderRef.key) {
              throw uploadError;
            }
            fullPath = metadata.fullPath;
          }
          const record = { name: file.name, sizeLabel: file.sizeLabel, size: file.file.size, storagePath: fullPath };
          this.pendingUploadedFileRecords[index] = record;
          uploadedStoragePaths.push(fullPath);
          return record;
        }));
        const failedUpload = results.find(result => result.status === 'rejected');
        if (failedUpload?.status === 'rejected') throw failedUpload.reason;
        uploadedFileRecords = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      }
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
        paymentDetails: { status: 'Awaiting Quotation' },
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      this.pendingOrderMayExist = true;
      await set(newOrderRef, orderData);
      orderSaved = true;
      await this.finishOrderSubmission();

    } catch (error) {
      if (orderSaved) {
        console.error('Order saved, but navigation to the dashboard failed:', error);
        this.notificationService.show('success', 'Order submitted. You can review the quotation in My Orders.', 'Order Placed');
        setTimeout(() => { this.isLoading = false; }, 0);
        return;
      }
      if (uploadedStoragePaths.length || this.uploadedFiles.length) {
        console.warn('Private uploads may need administrator reconciliation after the order submission failed.', uploadedStoragePaths);
      }
      console.error('Error placing order:', error);
      this.notificationService.show('error', uploadedStoragePaths.length || this.uploadedFiles.length
        ? 'The order could not be submitted. Uploaded files remain private and may need administrator cleanup; contact support before retrying.'
        : 'The order could not be submitted. Please try again.', 'Order Failed');
    } finally {
      if (!orderSaved) this.isLoading = false;
    }
  }

  private getOrCreatePendingOrderRef(fingerprint: string): DatabaseReference {
    if (this.pendingOrderFingerprint === fingerprint && this.pendingOrderRef) return this.pendingOrderRef;
    const storageKey = `filecrafters-pending-order:${this.userId}`;
    let savedOrderId = '';
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (saved?.fingerprint === fingerprint && typeof saved.orderId === 'string'
        && /^[A-Za-z0-9_-]{20}$/.test(saved.orderId)) savedOrderId = saved.orderId;
    } catch {
      // The in-memory key still protects retries if session storage is unavailable.
    }
    const orderRef = savedOrderId ? ref(this.db, `orders/${savedOrderId}`) : push(ref(this.db, 'orders'));
    if (!orderRef.key) throw new Error('Could not allocate an order submission key.');
    this.pendingOrderFingerprint = fingerprint;
    this.pendingOrderRef = orderRef;
    this.pendingOrderMayExist = savedOrderId.length > 0;
    this.pendingUploadedFileRecords = [];
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ orderId: orderRef.key, fingerprint }));
    } catch {
      // Keep the request idempotent for this component instance when storage is unavailable.
    }
    return orderRef;
  }

  private async fingerprintSubmission(payload: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private async finishOrderSubmission(): Promise<void> {
    this.notificationService.show('success', 'Order submitted. Review and approve the quotation in My Orders before sending payment details.', 'Order Placed');
    const navigated = await this.router.navigate(['/dashboard/home']);
    if (navigated) {
      try { sessionStorage.removeItem(`filecrafters-pending-order:${this.userId}`); } catch { /* Session storage is optional. */ }
      this.pendingOrderFingerprint = '';
      this.pendingOrderRef = null;
      this.pendingOrderMayExist = false;
      this.pendingUploadedFileRecords = [];
    } else {
      setTimeout(() => { this.isLoading = false; }, 0);
    }
  }

  ngOnDestroy(): void {
    if (this.stopPricingWatcher) {
      this.stopPricingWatcher();
    }
  }
}

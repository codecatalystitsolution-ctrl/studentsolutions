import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, push, set, onValue } from '@angular/fire/database'; // 'onValue' add kiya hai

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './new-order.component.html',
  styleUrls: ['./new-order.component.scss']
})
export class NewOrderComponent implements OnInit {
  orderForm!: FormGroup;

  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private db = inject(Database);
  private router = inject(Router);

  userId: string = ''; // Firebase ka original UID
  studentID: string = ''; // Aapka custom FC-XXXXXX ID

  // Live Pricing Variables
  currentFileTypeLabel: string = 'Select File Type';
  currentSlabLabel: string = '';
  currentPrintCost: number = 0;
  currentBindingCost: number = 0;
  totalEstimatedPrice: number = 0;
  selfUploadFeeDeduction: number = 0;
  uploadedFiles: Array<{ name: string; sizeLabel: string; dataUrl: string }> = [];
  uploadedFileNames: string = '';
  uploadedFilesSizeLabel: string = '';
  uploadedFileDataUrl: string | null = null;
  maxUploadFiles = 3;
  maxUploadSizeBytes = 1 * 1024 * 1024; // 1 MB
  uploadStatusMessage: string = 'No self-upload selected. Admin will prepare the file from scratch.';
  isFileUploading: boolean = false;

  // Slabs Config
  availableSlabs: any[] = [];
  slabConfig = {
    assignment: [
      { price: 100, label: 'Up to 20 Pages (₹100)' },
      { price: 110, label: 'Up to 25 Pages (₹110)' },
      { price: 120, label: 'Up to 30 Pages (₹120)' }
    ],
    practical: [
      { price: 250, label: 'Up to 30 Pages (₹250)' },
      { price: 300, label: 'Up to 40 Pages (₹300)' },
      { price: 350, label: 'Up to 50 Pages (₹350)' }
    ],
    project: [
      { price: 450, label: 'Up to 40 Pages (₹450)' },
      { price: 500, label: 'Up to 50 Pages (₹500)' },
      { price: 550, label: 'Up to 60 Pages (₹650)' }
    ]
  };

  // ==========================================
  // PAYMENT MODAL VARIABLES
  // ==========================================
  showPaymentModal: boolean = false;
  paymentStep: number = 1;
  transactionRef: string = '';
  transactionUPIId: string = '';
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
      this.updatePricingPreview();
    });

    this.orderForm.valueChanges.subscribe(() => {
      this.updatePricingPreview();
    });
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
      if (val.bindingType === 'spiral') this.currentBindingCost = 50;
      else if (val.bindingType === 'hardbound') this.currentBindingCost = 150;
      else if (val.bindingType === 'stick') this.currentBindingCost = 20;
    }

    const uploadEligible = ['assignment', 'practical', 'project'].includes(val.fileType);
    this.selfUploadFeeDeduction = Boolean(val.uploadOwnFile) && uploadEligible ? 50 : 0;

    const quantity = ['assignment', 'practical'].includes(val.fileType) ? Number(val.fileQuantity || 1) : 1;
    this.totalEstimatedPrice = Math.max(0, (this.currentPrintCost * quantity) + this.currentBindingCost - this.selfUploadFeeDeduction);

    if (this.selfUploadFeeDeduction > 0) {
      this.uploadStatusMessage = '₹50 discount applied because you uploaded your own PDF.';
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
      this.uploadedFiles = [];
      this.uploadedFileNames = '';
      this.uploadedFilesSizeLabel = '';
      this.uploadedFileDataUrl = null;
    }

    this.updatePricingPreview();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);

    if (!files.length) {
      return;
    }

    if (files.length > this.maxUploadFiles) {
      alert(`Please upload at most ${this.maxUploadFiles} PDF files.`);
      input.value = '';
      return;
    }

    for (const file of files) {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        alert('Please upload PDF files only.');
        input.value = '';
        return;
      }
      if (file.size > this.maxUploadSizeBytes) {
        alert('Each PDF must be 1MB or smaller. Please choose a smaller file.');
        input.value = '';
        return;
      }
    }

    this.isFileUploading = true;
    try {
      const uploaded = await Promise.all(files.map(file => this.readPdfFile(file)));
      this.uploadedFiles = uploaded;
      this.uploadedFileNames = uploaded.map(file => file.name).join(', ');
      this.uploadedFilesSizeLabel = uploaded.map(file => file.sizeLabel).join(', ');
      this.uploadedFileDataUrl = uploaded[0]?.dataUrl || null;
      this.orderForm.get('uploadOwnFile')?.setValue(true, { emitEvent: false });
      this.updatePricingPreview();
    } catch (error) {
      console.error('Error reading uploaded PDF files:', error);
      alert('We could not read the selected PDF files. Please try again.');
      input.value = '';
      this.uploadedFiles = [];
      this.uploadedFileNames = '';
      this.uploadedFilesSizeLabel = '';
      this.uploadedFileDataUrl = null;
    } finally {
      this.isFileUploading = false;
    }
  }

  private readPdfFile(file: File): Promise<{ name: string; sizeLabel: string; dataUrl: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, sizeLabel: this.formatFileSize(file.size), dataUrl: reader.result as string });
      };
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
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
  // PAYMENT MODAL FUNCTIONS
  // ==========================================

  openPaymentModal() {
    if (this.orderForm.invalid || !this.userId) {
      this.orderForm.markAllAsTouched();
      alert("Please fill all required details correctly before proceeding.");
      return;
    }
    this.showPaymentModal = true;
    this.paymentStep = 1;
    this.transactionRef = '';
    this.transactionUPIId = '';
  }

  closePaymentModal() {
    this.showPaymentModal = false;
    this.paymentStep = 1;
  }

  async submitFinalOrder() {
    if (!this.transactionRef || this.transactionRef.trim() === '') {
      alert('Please enter your Transaction Reference or UPI ID used for payment.');
      return;
    }

    this.isLoading = true;

    try {
      const formVals = this.orderForm.value;

      const selfUploaded = Boolean(formVals.uploadOwnFile) && !!this.uploadedFileDataUrl;
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
          specialInstructions: formVals.specialInstructions || 'None'
        },
        printSettings: {
          pagesLabel: this.currentSlabLabel || 'Standard Slabs',
          binding: formVals.bindingType || 'None',
          quantity: ['assignment', 'practical'].includes(formVals.fileType) ? Number(formVals.fileQuantity || 1) : 1
        },
        pricing: {
          printCost: this.currentPrintCost || 0,
          bindingCost: this.currentBindingCost || 0,
          uploadDiscount: this.selfUploadFeeDeduction || 0,
          totalAmount: this.totalEstimatedPrice || 0,
          advancePaid: (this.totalEstimatedPrice || 0) / 2
        },
        uploadDetails: {
          selfUploaded,
          files: selfUploaded ? this.uploadedFiles : null,
          fileName: selfUploaded ? this.uploadedFileNames : null,
          fileSize: this.uploadedFilesSizeLabel || (selfUploaded ? this.uploadedFiles[0]?.sizeLabel : null),
          uploadedFileDataUrl: selfUploaded ? this.uploadedFileDataUrl : null,
          note: selfUploaded
            ? 'Student uploaded PDF file(s) and a ₹50 discount was applied.'
            : 'No self-upload selected. Admin will prepare the file from scratch.'
        },
        paymentDetails: {
          transactionId: this.transactionRef,
          upiId: this.transactionUPIId,
          status: 'Pending Verification'
        },
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      const newOrderRef = push(ref(this.db, 'orders'));
      await set(newOrderRef, orderData);

      this.closePaymentModal();
      alert('Order Placed Successfully! 🎉 We will verify your payment and start processing.');
      this.router.navigate(['/dashboard/home']);

    } catch (error) {
      console.error('Error placing order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }
}
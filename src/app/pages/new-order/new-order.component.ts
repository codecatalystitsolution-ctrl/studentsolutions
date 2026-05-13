import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms'; // FormsModule added for [(ngModel)]
import { Router, RouterLink } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, push, set } from '@angular/fire/database';

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink], // Added FormsModule
  templateUrl: './new-order.component.html',
  styleUrls: ['./new-order.component.scss']
})
export class NewOrderComponent implements OnInit {
  orderForm!: FormGroup;
  
  private fb = inject(FormBuilder);
  private auth = inject(Auth);
  private db = inject(Database);
  private router = inject(Router);

  userId: string = '';
  
  // Live Pricing Variables
  currentFileTypeLabel: string = 'Select File Type';
  currentSlabLabel: string = '';
  currentPrintCost: number = 0;
  currentBindingCost: number = 0;
  totalEstimatedPrice: number = 0;

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
  // NAYE VARIABLES: PAYMENT MODAL KE LIYE
  // ==========================================
  showPaymentModal: boolean = false;
  paymentStep: number = 1;
  transactionRef: string = '';
  transactionUPIId: string = '';
  isLoading: boolean = false;

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        this.userId = user.uid;
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
      specialInstructions: ['']
    });

    this.orderForm.get('fileType')?.valueChanges.subscribe(type => {
      if (type) {
        this.availableSlabs = this.slabConfig[type as keyof typeof this.slabConfig];
        this.orderForm.get('pageSlab')?.setValue(this.availableSlabs[0].price);
      }
    });

    this.orderForm.valueChanges.subscribe(val => {
      if (val.fileType === 'assignment') this.currentFileTypeLabel = 'Assignment File';
      else if (val.fileType === 'practical') this.currentFileTypeLabel = 'Practical File';
      else if (val.fileType === 'project') this.currentFileTypeLabel = 'Project File';
      else this.currentFileTypeLabel = 'Select File Type';

      this.currentPrintCost = Number(val.pageSlab) || 0;
      let selectedSlabObj = this.availableSlabs?.find(s => s.price == this.currentPrintCost);
      this.currentSlabLabel = selectedSlabObj ? selectedSlabObj.label.split(' (')[0] : '';

      this.currentBindingCost = 0;
      if (val.fileType === 'project') {
        if (val.bindingType === 'spiral') this.currentBindingCost = 50;
        else if (val.bindingType === 'hardbound') this.currentBindingCost = 150;
        else if (val.bindingType === 'stick') this.currentBindingCost = 20;
      }

      this.totalEstimatedPrice = this.currentPrintCost + this.currentBindingCost;
    });
  }

  // ==========================================
  // PAYMENT MODAL FUNCTIONS
  // ==========================================

  // Ye function ab HTML Button se call hoga
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

  // Final Step 3 function
  async submitFinalOrder() {
    if (!this.transactionRef || this.transactionRef.trim() === '') {
      alert('Please enter your Transaction Reference or UPI ID used for payment.');
      return;
    }

    this.isLoading = true;

    try {
      const formVals = this.orderForm.value;

      const orderData = {
        userId: this.userId,
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
          binding: formVals.bindingType || 'None'
        },
        pricing: {
          printCost: this.currentPrintCost || 0,
          bindingCost: this.currentBindingCost || 0,
          totalAmount: this.totalEstimatedPrice || 0,
          advancePaid: (this.totalEstimatedPrice || 0) / 2
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
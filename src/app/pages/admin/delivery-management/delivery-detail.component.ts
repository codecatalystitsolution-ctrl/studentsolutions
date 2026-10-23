import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { PdfExportService, UserPdfReportData } from '../../../services/pdf-export.service';

@Component({
  selector: 'app-delivery-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delivery-detail.component.html',
  styleUrls: ['./delivery-detail.component.scss']
})
export class DeliveryDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private db = inject(Database);
  private pdfExport = inject(PdfExportService);

  delivery: any = null;
  isLoading = true;
  errorMessage = '';
  private deliveryRef: any;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const uid = params.get('uid');
      if (!uid) {
        this.errorMessage = 'Delivery Staff ID not found in the URL.';
        this.isLoading = false;
        return;
      }
      this.loadDelivery(uid);
    });
  }

  loadDelivery(uid: string) {
    this.deliveryRef = ref(this.db, `users/${uid}`);
    onValue(
      this.deliveryRef,
      snapshot => {
        const data = snapshot.val();
        if (!data) {
          this.errorMessage = 'Delivery Staff record not available. Please check the ID.';
          this.delivery = null;
        } else {
          this.delivery = { uid, ...data };
        }
        this.isLoading = false;
      },
      error => {
        console.error('Failed to load delivery staff detail', error);
        this.errorMessage = 'Unable to load delivery staff details at this time.';
        this.isLoading = false;
      }
    );
  }

  downloadPdf(): void {
    if (!this.delivery) return;

    const reportData: UserPdfReportData = {
      title: 'Delivery Personnel Profile & Service Record',
      referenceId: this.delivery.uid?.slice(0, 8) || 'N/A',
      generatedAt: new Date().toLocaleString(),
      profile: {
        fullName: this.delivery.fullName || 'N/A',
        email: this.delivery.email || 'N/A',
        role: 'Delivery Personnel',
        status: this.delivery.status || 'active',
        phone: this.delivery.phone,
        whatsapp: this.delivery.whatsapp,
        serviceArea: this.delivery.serviceArea || this.delivery.address,
        createdAt: this.delivery.createdAt
      },
      sections: [
        {
          title: 'Personnel & Logistics Profile',
          rows: [
            { label: 'Full Name', value: this.delivery.fullName || 'N/A' },
            { label: 'Role', value: 'Delivery Partner' },
            { label: 'Email', value: this.delivery.email || 'N/A' },
            { label: 'Phone', value: this.delivery.phone || 'N/A' },
            { label: 'WhatsApp', value: this.delivery.whatsapp || 'N/A' },
            { label: 'Assigned Service Area', value: this.delivery.serviceArea || this.delivery.address || 'N/A' },
            { label: 'Pincode', value: this.delivery.pincode || 'N/A' },
            { label: 'Account Status', value: (this.delivery.status || 'active').toUpperCase() }
          ]
        }
      ]
    };

    this.pdfExport.exportReport(reportData);
  }

  ngOnDestroy() {
    if (this.deliveryRef) {
      off(this.deliveryRef);
    }
  }

  goBack() {
    this.router.navigate(['/admin/delivery']);
  }
}

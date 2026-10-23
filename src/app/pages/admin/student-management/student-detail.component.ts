import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Database, ref, onValue, off } from '@angular/fire/database';
import { PdfExportService, UserPdfReportData } from '../../../services/pdf-export.service';

@Component({
  selector: 'app-student-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './student-detail.component.html',
  styleUrls: ['./student-detail.component.scss']
})
export class StudentDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private db = inject(Database);
  private pdfExport = inject(PdfExportService);

  student: any = null;
  orders: any[] = [];
  complaints: any[] = [];
  isLoading = true;
  errorMessage = '';
  private studentRef: any;
  private ordersRef: any;
  private complaintsRef: any;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const uid = params.get('uid');
      if (!uid) {
        this.errorMessage = 'Student ID not found in the URL.';
        this.isLoading = false;
        return;
      }
      this.loadStudent(uid);
    });
  }

  loadStudent(uid: string) {
    this.studentRef = ref(this.db, `users/${uid}`);
    onValue(
      this.studentRef,
      snapshot => {
        const data = snapshot.val();
        if (!data) {
          this.errorMessage = 'Student record not available. Please check the student ID.';
          this.student = null;
          this.orders = [];
          this.complaints = [];
        } else {
          this.student = { uid, ...data };
          this.loadRelatedData(uid, this.student.studentID);
        }
        this.isLoading = false;
      },
      error => {
        console.error('Failed to load student detail', error);
        this.errorMessage = 'Unable to load student details at this time.';
        this.isLoading = false;
      }
    );
  }

  loadRelatedData(uid: string, studentID?: string) {
    this.ordersRef = ref(this.db, 'orders');
    onValue(this.ordersRef, snapshot => {
      const ordersData = snapshot.val() || {};
      this.orders = Object.keys(ordersData)
        .map(key => ({ id: key, ...ordersData[key] }))
        .filter(order => order.uid === uid || (studentID && order.studentID === studentID))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    });

    this.complaintsRef = ref(this.db, 'complaints');
    onValue(this.complaintsRef, snapshot => {
      const complaintsData = snapshot.val() || {};
      this.complaints = Object.keys(complaintsData)
        .map(key => ({ id: key, ...complaintsData[key] }))
        .filter(ticket => ticket.uid === uid || (studentID && ticket.studentID === studentID))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    });
  }

  downloadPdf(): void {
    if (!this.student) return;

    const reportData: UserPdfReportData = {
      title: 'Student Academic Profile & Ledger Record',
      referenceId: this.student.studentID || this.student.uid?.slice(0, 8) || 'N/A',
      generatedAt: new Date().toLocaleString(),
      profile: {
        fullName: this.student.fullName || 'N/A',
        email: this.student.email || 'N/A',
        role: 'Student',
        status: this.student.status || 'active',
        phone: this.student.phone,
        whatsapp: this.student.whatsapp,
        institution: this.student.collegeName,
        course: this.student.courseName,
        studentId: this.student.studentID,
        createdAt: this.student.createdAt
      },
      sections: [
        {
          title: 'Student Profile & Academic Details',
          rows: [
            { label: 'Full Name', value: this.student.fullName || 'N/A' },
            { label: 'Student ID', value: this.student.studentID || 'N/A' },
            { label: 'Email Address', value: this.student.email || 'N/A' },
            { label: 'Contact Phone', value: this.student.phone || 'N/A' },
            { label: 'WhatsApp', value: this.student.whatsapp || 'N/A' },
            { label: 'Institution / College', value: this.student.collegeName || 'N/A' },
            { label: 'Academic Program / Course', value: this.student.courseName || 'N/A' },
            { label: 'Branch / Specialization', value: this.student.branch || 'N/A' },
            { label: 'Academic Year', value: this.student.academicYear || 'N/A' },
            { label: 'Account Status', value: (this.student.status || 'active').toUpperCase() }
          ]
        }
      ],
      tables: [
        {
          title: `Associated Academic Orders (${this.orders.length})`,
          headers: ['Order ID', 'Date', 'Subject', 'Topic', 'Total (INR)', 'Order Status'],
          rows: this.orders.map(o => [
            o.id?.slice(0, 8) || 'N/A',
            o.createdAt ? new Date(o.createdAt).toLocaleDateString() : 'N/A',
            o.projectDetails?.subject || 'N/A',
            o.projectDetails?.topic || o.fileType || 'N/A',
            'INR ' + (o.pricing?.totalAmount || 0),
            o.status || 'Pending'
          ])
        },
        {
          title: `Support Tickets & Complaints (${this.complaints.length})`,
          headers: ['Ticket ID', 'Date', 'Category', 'Subject', 'Status'],
          rows: this.complaints.map(c => [
            c.id?.slice(0, 8) || 'N/A',
            c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'N/A',
            c.category || 'General',
            c.subject || c.message?.slice(0, 30) || 'N/A',
            c.status || 'Pending'
          ])
        }
      ]
    };

    this.pdfExport.exportReport(reportData);
  }

  ngOnDestroy() {
    if (this.studentRef) {
      off(this.studentRef);
    }
    if (this.ordersRef) {
      off(this.ordersRef);
    }
    if (this.complaintsRef) {
      off(this.complaintsRef);
    }
  }

  goBack() {
    this.router.navigate(['/admin/students']);
  }
}

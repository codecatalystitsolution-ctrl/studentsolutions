import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router'; // Navigation ke liye
import { Auth, authState } from '@angular/fire/auth'; // Auth check ke liye
import { Database, ref, onValue, off } from '@angular/fire/database';

interface Ticket {
  id: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  createdAt: string;
  status: string;
  adminReply?: string;
  uid?: string;         // Filter karne ke liye Firebase ID
  studentID?: string;   // Custom FC-XXXXXX ID
}

@Component({
  selector: 'app-ticket-status',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './ticket-status.html',
  styleUrls: ['./ticket-status.scss']
})
export class TicketStatusComponent implements OnInit, OnDestroy {
  tickets: Ticket[] = [];
  isLoading = true;
  private complaintsRef: any;

  // Naye Angular injects (Orders ki tarah)
  private db = inject(Database);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  ngOnInit(): void {
    // 1. Pehle current login user ka pata lagayein
    authState(this.auth).subscribe(user => {
      if (user) {
        const uid = user.uid;

        // 2. Database se student ka 'FC-XXXXXX' id nikalein
        const userRef = ref(this.db, `users/${uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().studentID) {
            const studentID = snapshot.val().studentID;
            // Dono IDs ke sath complaints fetch karein
            this.fetchTicketsLive(uid, studentID);
          } else {
            this.fetchTicketsLive(uid, '');
          }
        }, { onlyOnce: true });

      } else {
        // Agar login nahi hai toh bahar nikal dein
        this.isLoading = false;
        this.router.navigate(['/login']);
      }
    });
  }

  fetchTicketsLive(userId: string, studentID: string): void {
    this.isLoading = true;
    this.complaintsRef = ref(this.db, 'complaints');

    // Live sync listener
    onValue(this.complaintsRef, (snapshot) => {
      this.ngZone.run(() => {
        const data = snapshot.val();
        this.tickets = [];

        if (data) {
          this.tickets = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            // === FILTER LOGIC === 
            // Wahi ticket dikhao jiska uid ya studentID login wale user se match ho
            .filter((ticket: Ticket) => 
              (ticket.uid === userId) || 
              (studentID !== '' && ticket.studentID === studentID)
            )
            .reverse(); // Naya ticket sabse upar
        }
        
        this.isLoading = false;
      });
      
      // UI ko force update karne ke liye
      this.cdr.detectChanges();

    }, (error) => {
      this.ngZone.run(() => {
        console.error("Error fetching tickets:", error);
        this.isLoading = false;
      });
    });
  }

  // Category values ko user friendly text me convert karne ke liye helper
  getCategoryLabel(cat: string): string {
    const labels: { [key: string]: string } = {
      'file-upload': '📁 File Upload Issue',
      'payment': '💳 Payment & Refund',
      'pro-access': '⭐ PRO Account Access',
      'other': '⚙️ Other Support'
    };
    return labels[cat] || cat;
  }

  ngOnDestroy(): void {
    if (this.complaintsRef) {
      off(this.complaintsRef);
    }
  }
}
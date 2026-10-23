import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router'; // Navigation ke liye
import { Auth, authState } from '@angular/fire/auth'; // Auth check ke liye
import { Database, ref, query, orderByChild, equalTo, limitToFirst, onValue, off } from '@angular/fire/database';
import { SupportReply, SupportReplyService } from '../../../../services/support-reply.service';
import { NotificationService } from '../../../../shared/notification/notification.service';

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
  replies?: Record<string, SupportReply>;
  uid?: string;         // Filter karne ke liye Firebase ID
  studentID?: string;   // Custom FC-XXXXXX ID
}

@Component({
  selector: 'app-ticket-status',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
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
  private supportReplies = inject(SupportReplyService);
  private notificationService = inject(NotificationService);
  private replySubscriptions = new Map<string, () => void>();
  replyDrafts: Record<string, string> = {};

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
    this.complaintsRef = query(ref(this.db, 'complaints'), orderByChild('uid'), equalTo(userId), limitToFirst(100));

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

        for (const ticket of this.tickets) this.watchReplies(ticket.id);

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

  private watchReplies(ticketId: string): void {
    if (this.replySubscriptions.has(ticketId)) return;
    const unsubscribe = this.supportReplies.watchTicket(ticketId, replies => {
      const ticket = this.tickets.find(item => item.id === ticketId);
      if (ticket) ticket.replies = replies;
      this.cdr.detectChanges();
    });
    this.replySubscriptions.set(ticketId, unsubscribe);
  }

  async sendReply(ticketId: string): Promise<void> {
    const message = this.replyDrafts[ticketId] || '';
    try {
      await this.supportReplies.addStudentReply(ticketId, message);
      this.replyDrafts[ticketId] = '';
      this.notificationService.show('success', 'Your follow-up was added to the support conversation.', 'Reply Added');
    } catch (error) {
      console.error('Could not add support follow-up:', error);
      this.notificationService.show('error', 'Your reply could not be added. Check that the ticket is yours and try again.', 'Reply Failed');
    }
  }

  // Category values ko user friendly text me convert karne ke liye helper
  getCategoryLabel(cat: string): string {
    const labels: { [key: string]: string } = { 'file-upload': 'File Upload Issue', 'payment': 'Payment and Refund', 'pro-access': 'Premium Account Access', 'other': 'Other Support' };
    return labels[cat] || 'General Support';
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  createTicket(): void {
    this.router.navigate(['/dashboard/help-support']);
  }

  ngOnDestroy(): void {
    if (this.complaintsRef) {
      off(this.complaintsRef);
    }
    this.replySubscriptions.forEach(unsubscribe => unsubscribe());
    this.replySubscriptions.clear();
  }
}

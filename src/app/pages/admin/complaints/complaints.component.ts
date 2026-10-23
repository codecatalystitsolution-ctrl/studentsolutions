import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ComplaintsService } from './complaints.service'; // Import ComplaintsService

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, UpperCasePipe],
  templateUrl: './complaints.component.html',
  styleUrls: ['./complaints.component.scss']
})
export class ComplaintsComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private complaintsService = inject(ComplaintsService); // Inject ComplaintsService

  tickets: any[] = [];
  filteredTickets: any[] = [];
  searchTerm: string = '';
  isLoading: boolean = true;
  private complaintSubscription: Subscription | null = null;
  private replySubscriptions = new Map<string, () => void>();

  // Reply Modal Variables
  showReplyModal: boolean = false;
  selectedTicket: any = null;
  adminReplyText: string = '';

  ngOnInit(): void {
    this.fetchComplaints();
  }

  fetchComplaints() {
    this.complaintSubscription?.unsubscribe();
    this.complaintSubscription = this.complaintsService.getComplaints().subscribe({
      next: (data) => {
        this.tickets = data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        for (const ticket of this.tickets) this.watchReplies(ticket);
        this.filterTickets();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error("Error fetching complaints:", error);
        this.isLoading = false;
        this.notificationService.show('error', 'Failed to fetch complaints.', 'Error');
      }
    });
  }

  private watchReplies(ticket: any): void {
    if (this.replySubscriptions.has(ticket.id)) return;
    const stop = this.complaintsService.watchReplies(ticket.id, replies => {
      const current = this.tickets.find(item => item.id === ticket.id);
      if (current) {
        current.replyHistory = replies;
        current.replyCount = Object.keys(replies).length;
      }
      this.cdr.detectChanges();
    });
    this.replySubscriptions.set(ticket.id, stop);
  }

  filterTickets() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredTickets = [...this.tickets];
      return;
    }

    this.filteredTickets = this.tickets.filter(ticket => {
      const studentId = (ticket.studentID || '').toLowerCase();
      const ticketId = (ticket.id || '').toLowerCase();
      const studentName = (ticket.name || '').toLowerCase();
      const ticketContent = [ticket.category, ticket.subject, ticket.message, ticket.status, ticket.email]
        .filter(Boolean).join(' ').toLowerCase();
      return studentId.includes(term) || ticketId.includes(term) || studentName.includes(term) || ticketContent.includes(term);
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredTickets = [...this.tickets];
  }

  async updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      await this.complaintsService.updateComplaintStatus(ticketId, newStatus);
      this.notificationService.show('success', 'Ticket status updated.', 'Updated');
    } catch (error) {
      console.error("Status update error:", error);
      this.notificationService.show('error', 'Failed to update status.', 'Update Failed');
    }
  }

  // === REPLY MODAL FUNCTIONS ===
  openReplyModal(ticket: any) {
    this.selectedTicket = ticket;
    this.adminReplyText = '';
    this.showReplyModal = true;
  }

  closeReplyModal() {
    this.showReplyModal = false;
    this.selectedTicket = null;
    this.adminReplyText = '';
  }

  async sendReply() {
    if (!this.adminReplyText.trim() || this.adminReplyText.trim().length > 4000) {
      this.notificationService.show('warning', 'Enter a reply between 1 and 4,000 characters.', 'Reply Required');
      return;
    }

    try {
      await this.complaintsService.sendReply(this.selectedTicket.id, this.adminReplyText);
      this.notificationService.show('success', 'Reply sent successfully.', 'Sent');
      this.closeReplyModal();
    } catch (error) {
      console.error("Reply error:", error);
      this.notificationService.show('error', 'Failed to send reply.', 'Send Failed');
    }
  }

  async deleteTicket(ticketId: string) {
    const confirmed = await this.confirmService.confirm({
      title: 'Delete Ticket',
      message: '⚠️ Permanently delete this ticket?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;
    try {
      await this.complaintsService.deleteComplaint(ticketId);
      this.notificationService.show('success', 'Ticket deleted.', 'Deleted');
      this.fetchComplaints(); // Re-fetch to update UI
    } catch (error) {
      console.error("Delete error:", error);
      this.notificationService.show('error', 'Failed to delete ticket.', 'Delete Failed');
    }
  }

  ngOnDestroy(): void {
    this.complaintSubscription?.unsubscribe();
    this.replySubscriptions.forEach(unsubscribe => unsubscribe());
    this.replySubscriptions.clear();
  }
}

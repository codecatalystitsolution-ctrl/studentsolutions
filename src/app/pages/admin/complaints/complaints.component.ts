import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, onValue, update, remove } from '@angular/fire/database';

@Component({
  selector: 'app-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, UpperCasePipe],
  templateUrl: './complaints.component.html',
  styleUrls: ['./complaints.component.scss']
})
export class ComplaintsComponent implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  tickets: any[] = [];
  filteredTickets: any[] = [];
  searchTerm: string = '';
  isLoading: boolean = true;

  // Reply Modal Variables
  showReplyModal: boolean = false;
  selectedTicket: any = null;
  adminReplyText: string = '';

  ngOnInit(): void {
    this.fetchComplaints();
  }

  fetchComplaints() {
    const complaintsRef = ref(this.db, 'complaints');
    
    onValue(complaintsRef, (snapshot) => {
      this.ngZone.run(() => {
        this.tickets = [];
        const data = snapshot.val();
        
        if (data) {
          Object.keys(data).forEach(key => {
            this.tickets.push({ id: key, ...data[key] });
          });
          
          // Latest ticket sabse upar
          this.tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        
        this.filterTickets();
        this.isLoading = false;
      });
      this.cdr.detectChanges();
    });
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
      
      return studentId.includes(term) || ticketId.includes(term) || studentName.includes(term);
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredTickets = [...this.tickets];
  }

  async updateTicketStatus(ticketId: string, newStatus: string) {
    try {
      await update(ref(this.db, `complaints/${ticketId}`), { status: newStatus });
    } catch (error) {
      console.error("Status update error:", error);
      alert("Failed to update status.");
    }
  }

  // === REPLY MODAL FUNCTIONS ===
  openReplyModal(ticket: any) {
    this.selectedTicket = ticket;
    // Agar pehle se koi reply hai toh usey load kar do
    this.adminReplyText = ticket.adminReply || ''; 
    this.showReplyModal = true;
  }

  closeReplyModal() {
    this.showReplyModal = false;
    this.selectedTicket = null;
    this.adminReplyText = '';
  }

  async sendReply() {
    if (!this.adminReplyText.trim()) {
      alert("Please write a reply before sending.");
      return;
    }

    try {
      const ticketRef = ref(this.db, `complaints/${this.selectedTicket.id}`);
      await update(ticketRef, { 
        adminReply: this.adminReplyText,
        status: 'Resolved' // Reply karte hi auto-resolve ho jayega
      });
      
      this.closeReplyModal();
      // Optional toast/alert here
    } catch (error) {
      console.error("Reply error:", error);
      alert("Failed to send reply.");
    }
  }

  async deleteTicket(ticketId: string) {
    const isConfirm = confirm("⚠️ Permanently delete this ticket?");
    if (isConfirm) {
      try {
        await remove(ref(this.db, `complaints/${ticketId}`));
      } catch (error) {
        console.error("Delete error:", error);
      }
    }
  }
}
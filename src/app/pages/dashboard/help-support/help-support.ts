import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Database, ref, push, set, onValue } from '@angular/fire/database';
import { Auth, authState } from '@angular/fire/auth'; // Auth imports
import { Router } from '@angular/router'; // Router for unauthenticated users

@Component({
  selector: 'app-help-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], 
  templateUrl: './help-support.html',
  styleUrls: ['./help-support.scss']
})
export class HelpSupportComponent implements OnInit {
  ticketForm!: FormGroup;
  isSubmitting = false;
  showCustomDialog = false;
  
  // 🚀 MAIN CONTROLLER: 'form' dikhana hai ya 'tickets' list
  activeTab: 'form' | 'tickets' = 'form'; 
  
  tickets: any[] = []; 

  // Injects
  private fb = inject(FormBuilder);
  private db = inject(Database);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private ngZone = inject(NgZone);

  // Firebase Auth UID aur Custom FC-ID
  userId: string = '';
  studentID: string = '';

  faqs = [
    { question: 'My payment was deducted but the order did not get activated, what should I do?', answer: 'Wait 15-20 minutes, if it still does not become active, then raise a ticket.', isOpen: false },
    { question: 'What file formats are supported for upload?', answer: 'You can upload your files in PDF, Word (.docx), or ZIP format.', isOpen: false }
  ];

  ngOnInit(): void {
    this.ticketForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      category: ['', Validators.required],
      subject: ['', Validators.required],
      message: ['', Validators.required]
    });

    // 1. Current user auth check aur ID fetch
    authState(this.auth).subscribe(user => {
      if (user) {
        this.userId = user.uid;
        
        // 2. Database se custom studentID fetch
        const userRef = ref(this.db, `users/${this.userId}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().studentID) {
            this.studentID = snapshot.val().studentID;
          }
          // ID milne ke baad hi tickets load karein
          this.loadTicketsLive();
        }, { onlyOnce: true });
        
      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  loadTicketsLive(): void {
    const complaintsRef = ref(this.db, 'complaints');
    onValue(complaintsRef, (snapshot) => {
      this.ngZone.run(() => {
        const data = snapshot.val();
        this.tickets = [];
        
        if (data) {
          this.tickets = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            // === FILTER: Sirf usi student ki tickets fetch karein ===
            .filter((ticket: any) => 
              (ticket.uid === this.userId) || 
              (this.studentID !== '' && ticket.studentID === this.studentID)
            )
            .reverse();
        }
      });
      
      this.cdr.detectChanges(); // UI force update
    });
  }

  toggleFaq(index: number): void {
    this.faqs[index].isOpen = !this.faqs[index].isOpen;
  }

  switchTab(tabName: 'form' | 'tickets'): void {
    this.activeTab = tabName;
  }

  async onSubmitTicket(): Promise<void> {
    if (this.ticketForm.valid) {
      this.isSubmitting = true;
      try {
        const complaintsRef = ref(this.db, 'complaints');
        const newComplaintRef = push(complaintsRef);
        
        // === PAYLOAD UPDATE: Naye tickets me UID aur studentID save ho raha hai ===
        const newTicketData = {
          ...this.ticketForm.value,
          uid: this.userId,
          studentID: this.studentID,
          createdAt: new Date().toISOString(),
          status: 'pending'
        };

        await set(newComplaintRef, newTicketData);

        this.isSubmitting = false;
        this.showCustomDialog = true; 
        this.ticketForm.reset();
      } catch (error) {
        this.isSubmitting = false;
        console.error(error);
        alert('Database sync fail! Please try again.');
      }
    } else {
      this.ticketForm.markAllAsTouched();
    }
  }

  closeModal(): void {
    this.router.navigate(['/dashboard/home']);
    this.showCustomDialog = false;
    this.activeTab = 'tickets'; 
  }
}
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Database, ref, push, set } from '@angular/fire/database';
import { NotificationService } from '../../shared/notification/notification.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-login-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login-support.component.html',
  styleUrls: ['./login-support.component.scss']
})
export class LoginSupportComponent implements OnInit {
  supportForm!: FormGroup;
  isSubmitting = false;
  submissionComplete = false;

  private fb = inject(FormBuilder);
  private db = inject(Database);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  ngOnInit(): void {
    this.supportForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      subject: ['Account Suspension / Login Help', Validators.required],
      message: ['', [Validators.required, Validators.minLength(20)]],
      issueType: ['Account Suspension', Validators.required]
    });
  }

  async submitSupportRequest(): Promise<void> {
    if (this.supportForm.invalid) {
      this.supportForm.markAllAsTouched();
      this.notificationService.show('warning', 'Please complete all required fields before submitting.', 'Incomplete Request');
      return;
    }

    this.isSubmitting = true;

    try {
      const requestRef = push(ref(this.db, 'complaints'));
      const payload = {
        ...this.supportForm.value,
        createdAt: new Date().toISOString(),
        status: 'pending',
        source: 'login-support'
      };

      await set(requestRef, payload);
      this.submissionComplete = true;
      this.notificationService.show('success', 'Support request submitted successfully. Admin will review it shortly.', 'Request Sent');
      this.supportForm.reset({
        subject: 'Account Suspension / Login Help',
        issueType: 'Account Suspension'
      });
    } catch (error) {
      console.error('Login support submit failed', error);
      this.notificationService.show('error', 'Unable to submit support request. Please try again later.', 'Submission Failed');
    } finally {
      this.isSubmitting = false;
    }
  }
}

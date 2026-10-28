import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../notification/notification.service';

export interface FeedbackData {
  name: string;
  email: string;
  category: string;
  rating: number;
  message: string;
  timestamp: number;
}

export const COOKIE_CONSENT_KEY = 'fc_cookie_consent';
export const FEEDBACK_STORAGE_KEY = 'fc_user_feedback_log';

@Component({
  selector: 'app-feedback-and-cookies',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-and-cookies.component.html',
  styleUrls: ['./feedback-and-cookies.component.scss']
})
export class FeedbackAndCookiesComponent implements OnInit {
  private notificationService = inject(NotificationService, { optional: true });

  // Cookie Banner State
  readonly showCookieBanner = signal<boolean>(false);
  readonly showPrivacyModal = signal<boolean>(false);

  // Feedback Dialog State
  readonly isFeedbackOpen = signal<boolean>(false);
  readonly feedbackSubmitted = signal<boolean>(false);
  readonly feedbackError = signal<string | null>(null);

  // Feedback Form Model
  feedbackForm = {
    name: '',
    email: '',
    category: 'General Feedback',
    rating: 5,
    message: ''
  };

  readonly feedbackCategories = [
    'General Feedback',
    'Feature Suggestion',
    'Report an Issue / Bug',
    'Project & Lab File Inquiry',
    'Documentation Quality'
  ];

  ngOnInit(): void {
    this.checkCookieConsent();
  }

  private checkCookieConsent(): void {
    try {
      const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!consent) {
        this.showCookieBanner.set(true);
      }
    } catch {
      // In restricted environments, do not block user
      this.showCookieBanner.set(false);
    }
  }

  acceptNecessaryOnly(): void {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'necessary');
    } catch {
      // Ignore storage restrictions
    }
    this.showCookieBanner.set(false);
  }

  acceptAllCookies(): void {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    } catch {
      // Ignore storage restrictions
    }
    this.showCookieBanner.set(false);
  }

  openPrivacyModal(): void {
    this.showPrivacyModal.set(true);
  }

  closePrivacyModal(): void {
    this.showPrivacyModal.set(false);
  }

  openFeedbackDialog(): void {
    this.feedbackError.set(null);
    this.feedbackSubmitted.set(false);
    this.isFeedbackOpen.set(true);
  }

  closeFeedbackDialog(): void {
    this.isFeedbackOpen.set(false);
    this.feedbackSubmitted.set(false);
    this.feedbackError.set(null);
  }

  setRating(stars: number): void {
    this.feedbackForm.rating = stars;
  }

  submitFeedback(): void {
    const trimmedMessage = this.feedbackForm.message.trim();
    if (!trimmedMessage) {
      this.feedbackError.set('Please enter your feedback comments before submitting.');
      return;
    }

    const submission: FeedbackData = {
      name: this.feedbackForm.name.trim() || 'Anonymous Student',
      email: this.feedbackForm.email.trim(),
      category: this.feedbackForm.category,
      rating: this.feedbackForm.rating,
      message: trimmedMessage,
      timestamp: Date.now()
    };

    try {
      const existing = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      const list: FeedbackData[] = existing ? JSON.parse(existing) : [];
      list.push(submission);
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(list));
    } catch {
      // Continue if local storage is restricted
    }

    this.feedbackSubmitted.set(true);
    this.feedbackError.set(null);

    if (this.notificationService) {
      this.notificationService.show(
        'success',
        'Thank you! Your feedback has been received and helps us improve the platform.',
        'Feedback Submitted'
      );
    }

    // Reset form after short delay
    setTimeout(() => {
      this.feedbackForm = {
        name: '',
        email: '',
        category: 'General Feedback',
        rating: 5,
        message: ''
      };
      this.closeFeedbackDialog();
    }, 2200);
  }
}

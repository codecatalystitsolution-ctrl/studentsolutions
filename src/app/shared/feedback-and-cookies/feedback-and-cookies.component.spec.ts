import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackAndCookiesComponent, COOKIE_CONSENT_KEY, FEEDBACK_STORAGE_KEY } from './feedback-and-cookies.component';
import { NotificationService } from '../notification/notification.service';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';

describe('FeedbackAndCookiesComponent', () => {
  let component: FeedbackAndCookiesComponent;
  let fixture: ComponentFixture<FeedbackAndCookiesComponent>;
  let notificationServiceMock: { show: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    notificationServiceMock = {
      show: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [FeedbackAndCookiesComponent],
      providers: [
        { provide: NotificationService, useValue: notificationServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackAndCookiesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('shows cookie banner if no consent stored', () => {
    component.ngOnInit();
    expect(component.showCookieBanner()).toBe(true);
  });

  it('hides cookie banner if consent already stored', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'necessary');
    component.ngOnInit();
    expect(component.showCookieBanner()).toBe(false);
  });

  it('accepts necessary only cookies and persists to storage', () => {
    component.ngOnInit();
    expect(component.showCookieBanner()).toBe(true);

    component.acceptNecessaryOnly();
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('necessary');
    expect(component.showCookieBanner()).toBe(false);
  });

  it('accepts all cookies and persists to storage', () => {
    component.ngOnInit();
    expect(component.showCookieBanner()).toBe(true);

    component.acceptAllCookies();
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('all');
    expect(component.showCookieBanner()).toBe(false);
  });

  it('opens and closes the privacy modal', () => {
    expect(component.showPrivacyModal()).toBe(false);
    component.openPrivacyModal();
    expect(component.showPrivacyModal()).toBe(true);
    component.closePrivacyModal();
    expect(component.showPrivacyModal()).toBe(false);
  });

  it('opens and closes the feedback dialog', () => {
    expect(component.isFeedbackOpen()).toBe(false);
    component.openFeedbackDialog();
    expect(component.isFeedbackOpen()).toBe(true);
    component.closeFeedbackDialog();
    expect(component.isFeedbackOpen()).toBe(false);
  });

  it('updates rating on setRating()', () => {
    component.setRating(3);
    expect(component.feedbackForm.rating).toBe(3);
    component.setRating(5);
    expect(component.feedbackForm.rating).toBe(5);
  });

  it('requires a message to submit feedback', () => {
    component.feedbackForm.message = '   ';
    component.submitFeedback();

    expect(component.feedbackError()).toContain('Please enter your feedback comments');
    expect(component.feedbackSubmitted()).toBe(false);
    expect(localStorage.getItem(FEEDBACK_STORAGE_KEY)).toBeNull();
  });

  it('submits feedback successfully with valid message and resets after timer', () => {
    component.feedbackForm.name = 'Priya Patel';
    component.feedbackForm.email = 'priya@example.com';
    component.feedbackForm.category = 'Feature Suggestion';
    component.feedbackForm.rating = 5;
    component.feedbackForm.message = 'Great lab file formats and fast support!';

    component.submitFeedback();

    expect(component.feedbackSubmitted()).toBe(true);
    expect(component.feedbackError()).toBeNull();
    expect(notificationServiceMock.show).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('Thank you!'),
      'Feedback Submitted'
    );

    const storedData = JSON.parse(localStorage.getItem(FEEDBACK_STORAGE_KEY) || '[]');
    expect(storedData.length).toBe(1);
    expect(storedData[0].name).toBe('Priya Patel');
    expect(storedData[0].rating).toBe(5);
    expect(storedData[0].message).toBe('Great lab file formats and fast support!');

    // Advance fake timer to test auto-reset and close
    vi.advanceTimersByTime(2300);
    expect(component.isFeedbackOpen()).toBe(false);
    expect(component.feedbackForm.message).toBe('');
  });
});

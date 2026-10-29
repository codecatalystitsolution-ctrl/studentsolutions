import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Database, get as getDatabaseValue } from '@angular/fire/database';
import { Storage } from '@angular/fire/storage';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { User } from 'firebase/auth';
import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { ThemeService } from './services/theme.service';
import { QuotationService } from './services/quotation.service';
import { PaymentLedgerService } from './services/payment-ledger.service';
import { DeliveryWorkflowService } from './services/delivery-workflow.service';
import { ReferralCommissionService } from './services/referral-commission.service';
import { NotificationInboxService } from './services/notification-inbox.service';
import { AuditTrailService } from './services/audit-trail.service';
import { ConfirmService } from './shared/confirmation/confirm.service';
import { NotificationService } from './shared/notification/notification.service';

import { VisitorCounterService } from './services/visitor-counter.service';

const routeChecks = [
  ['/', 'Engineering-Grade Projects'],
  ['/home', 'Engineering-Grade Projects'],
  ['/welcome', 'Student Solutions'],
  ['/splash', 'StudentSolutions Studio'],
  ['/login', 'Welcome Back'],
  ['/login-support', 'Account Suspension Support'],
  ['/register', 'Create an Account'],
  ['/dashboard', 'Get Your Assignments'],
  ['/dashboard/home', 'Get Your Assignments'],
  ['/dashboard/profile', 'Academic Details'],
  ['/dashboard/settings', 'Settings'],
  ['/dashboard/quizzes', 'General Knowledge'],
  ['/dashboard/quiz-player', 'Quiz'],
  ['/dashboard/my-orders', 'My Order History'],
  ['/dashboard/my-tickets', 'My Support Tickets'],
  ['/dashboard/help-support', 'Help & Support Hub'],
  ['/notifications', 'Notifications'],
  ['/new-order', 'Place a New Order'],
  ['/admin-login', 'Operations Center'],
  ['/admin', 'ADMIN OVERVIEW'],
  ['/admin/dashboard', 'ADMIN OVERVIEW'],
  ['/admin/orders', 'Manage Orders'],
  ['/admin/payments', 'Payment & Refund Management'],
  ['/admin/notifications', 'Notification Management'],
  ['/admin/students', 'Student Management'],
  ['/admin/students/test-student', 'Student Profile'],
  ['/admin/teachers', 'Teacher Management'],
  ['/admin/teachers/test-teacher', 'Teacher Profile'],
  ['/admin/delivery', 'Delivery Personnel Management'],
  ['/admin/delivery/test-delivery', 'Delivery Staff Profile'],
  ['/admin/order-details', 'Full Order Details'],
  ['/admin/complaints', 'Support Desk'],
  ['/admin/pricing', 'Pricing & Commission Settings'],
  ['/admin/audit', 'Audit history'],
] as const;

describe('application route rendering', () => {
  beforeEach(async () => {
    const testAdmin = { uid: 'test-admin', email: 'admin@filecrafters.in' } as User;
    localStorage.setItem('welcome_seen_test-admin', 'true');

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: Auth, useValue: { testUser: testAdmin } },
        { provide: Database, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: AuthService, useValue: { logout: vi.fn(async () => undefined), getUserProfile: vi.fn(async () => null) } },
        { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true) } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: QuotationService, useValue: { watch: vi.fn(() => () => undefined), watchDecision: vi.fn(() => () => undefined), decide: vi.fn(), createVersion: vi.fn() } },
        { provide: PaymentLedgerService, useValue: { watchStudentPayments: vi.fn(() => () => undefined), watchStudentRefunds: vi.fn(() => () => undefined), watchOrderPayments: vi.fn(() => () => undefined), watchRefund: vi.fn(() => () => undefined), watchPaymentHistory: vi.fn(() => () => undefined), watchRefundHistory: vi.fn(() => () => undefined), submitPayment: vi.fn(), requestRefund: vi.fn(), updatePaymentStatus: vi.fn(), decideRefund: vi.fn() } },
        { provide: DeliveryWorkflowService, useValue: { watchAssignment: vi.fn(() => () => undefined), watchAgentAssignments: vi.fn(() => () => undefined), watchHistory: vi.fn(() => () => undefined), assign: vi.fn(), updateStatus: vi.fn() } },
        { provide: ReferralCommissionService, useValue: { watchCodesForTeacher: vi.fn(() => () => undefined), watchStudentAttribution: vi.fn(() => () => undefined), watchMyAttributions: vi.fn(() => () => undefined), watchMyCommissions: vi.fn(() => () => undefined), watchOrderCommissions: vi.fn(() => () => undefined), watchCommissionHistory: vi.fn(() => () => undefined), createReferralCode: vi.fn(), createManualCommission: vi.fn(), setCommissionStatus: vi.fn() } },
        { provide: NotificationInboxService, useValue: { watchOwn: vi.fn(() => () => undefined), notifyUser: vi.fn(), markRead: vi.fn() } },
        { provide: AuditTrailService, useValue: { watchRecent: vi.fn(() => () => undefined), recordAdmin: vi.fn() } },
        { provide: VisitorCounterService, useValue: { visitorCount: () => 1420, recordUniqueVisit: vi.fn(async () => true) } },
      ],
    }).compileComponents();
  });

  it.each(routeChecks)('%s renders its route content', async (path, marker) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await harness.fixture.whenStable();

    const renderedText = harness.routeNativeElement?.textContent ?? '';
    expect(renderedText).toContain(marker);
  });

  it('keeps the selected theme across internal route changes', async () => {
    localStorage.setItem('student-solution-theme', 'dark');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');

    const toggle = harness.routeNativeElement?.querySelector('.auth-theme-toggle') as HTMLButtonElement;
    toggle.click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(ThemeService).theme()).toBe('light');
    expect(document.body.classList.contains('app-theme-light')).toBe(true);

    await harness.navigateByUrl('/register');
    expect(document.body.classList.contains('app-theme-light')).toBe(true);
    expect(localStorage.getItem('student-solution-theme')).toBe('light');
  });

  it.each(['/dashboard/home', '/new-order'])('%s redirects an unauthenticated user to login', async (path) => {
    TestBed.overrideProvider(Auth, { useValue: { testUser: null } });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('/admin/dashboard redirects an unauthenticated user to admin login', async () => {
    TestBed.overrideProvider(Auth, { useValue: { testUser: null } });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/dashboard');
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/admin-login');
  });

  it('routes an active teacher to the referral workspace and denies a student', async () => {
    TestBed.overrideProvider(Auth, { useValue: { testUser: { uid: 'test-teacher', email: 'teacher@example.test' } } });
    vi.mocked(getDatabaseValue).mockResolvedValue({ exists: () => true, val: () => ({ role: 'Teacher', status: 'active' }) } as never);
    const teacherHarness = await RouterTestingHarness.create();
    await teacherHarness.navigateByUrl('/teacher/referrals');
    expect(teacherHarness.routeNativeElement?.textContent).toContain('Referrals & commissions');

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: Auth, useValue: { testUser: { uid: 'test-student', email: 'student@example.test' } } }, { provide: Database, useValue: {} },
        { provide: Storage, useValue: {} }, { provide: AuthService, useValue: { logout: vi.fn(async () => undefined) } }, { provide: NotificationService, useValue: { show: vi.fn() } }]
    }).compileComponents();
    vi.mocked(getDatabaseValue).mockResolvedValue({ exists: () => true, val: () => ({ role: 'Student', status: 'active' }) } as never);
    const studentHarness = await RouterTestingHarness.create();
    await studentHarness.navigateByUrl('/teacher/referrals');
    expect(TestBed.inject(Router).url).toBe('/login');
    vi.mocked(getDatabaseValue).mockReset();
  });

  it.each(['/route-that-does-not-exist'])('%s resolves through the login fallback', async (path) => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path);
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.textContent).toContain('Welcome Back');
  });
});

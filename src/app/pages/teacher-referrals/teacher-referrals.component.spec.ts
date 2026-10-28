import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TeacherReferralsComponent } from './teacher-referrals.component';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReferralCommissionService } from '../../services/referral-commission.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { NotificationInboxService } from '../../services/notification-inbox.service';

describe('TeacherReferralsComponent', () => {
  let component: TeacherReferralsComponent;
  let fixture: ComponentFixture<TeacherReferralsComponent>;

  const mockReferralService = {
    watchCodesForTeacher: vi.fn((uid, callback) => {
      callback([
        { code: 'FC-PROF01', teacherUid: uid, active: true, createdBy: 'admin', createdAt: 1700000000000 }
      ]);
      return () => undefined;
    }),
    watchMyAttributions: vi.fn((uid, callback) => {
      callback([
        { studentUid: 'student-alpha', teacherUid: uid, referralCode: 'FC-PROF01', createdAt: 1700001000000 }
      ]);
      return () => undefined;
    }),
    watchMyCommissions: vi.fn((uid, callback) => {
      callback([
        {
          id: 'comm-1',
          teacherUid: uid,
          studentUid: 'student-alpha',
          orderId: 'ord-1001',
          paymentId: 'pay-1',
          amount: 150,
          calculationBaseAmount: 1500,
          calculationRatePercent: 10,
          proposedAmount: 150,
          calculationFormula: 'verified-payment-times-admin-rate-v1',
          roundingPolicy: 'half-up-to-0.01-INR',
          currency: 'INR',
          status: 'approved',
          memo: 'Mini project binding',
          createdBy: 'admin',
          createdAt: 1700002000000,
          creationHistoryId: 'hist-1'
        }
      ]);
      return () => undefined;
    }),
    watchCommissionHistory: vi.fn((_id, callback) => {
      callback({
        evt1: { status: 'approved', message: 'Commission reviewed', createdAt: 1700002500000 }
      });
      return () => undefined;
    }),
    createReferralCode: vi.fn(async (uid: string) => `FC-${uid.slice(-6).toUpperCase()}`),
    toggleCodeActive: vi.fn(async (_code: string, _active: boolean) => undefined)
  };

  const mockAuthService = {
    getUserProfile: vi.fn(async () => ({
      fullName: 'Prof. Test Teacher',
      collegeName: 'National Institute',
      department: 'Computer Science',
      teacherID: 'TEA-882201',
      commissionRate: 15
    })),
    logout: vi.fn(async () => undefined)
  };

  const mockThemeService = {
    theme: signal<'dark' | 'light'>('dark'),
    toggleTheme: vi.fn()
  };

  const mockInboxService = {
    watchOwn: vi.fn((_uid, callback) => {
      callback([]);
      return () => undefined;
    })
  };

  const mockRouter = {
    navigate: vi.fn(async () => true)
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [TeacherReferralsComponent],
      providers: [
        { provide: Auth, useValue: { currentUser: { uid: 'teacher-uid-1', email: 'teacher@test.com' } } },
        { provide: ReferralCommissionService, useValue: mockReferralService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: NotificationInboxService, useValue: mockInboxService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { queryParams: of({}) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TeacherReferralsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the teacher referrals component and loads profile with admin commission rate', async () => {
    expect(component).toBeTruthy();
    await fixture.whenStable();
    expect(component.teacherProfile?.fullName).toBe('Prof. Test Teacher');
    expect(component.teacherProfile?.teacherID).toBe('TEA-882201');
    expect(component.teacherProfile?.commissionRate).toBe(15);
  });

  it('renders required Playwright test selectors and Sign Out buttons', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.main-title')?.textContent).toContain('Referrals & commissions');
    expect(compiled.textContent).toContain('Sign Out');
    expect(compiled.textContent).toContain('TEACHER WORKSPACE');
  });

  it('computes accurate KPI totals for codes, students and commissions', () => {
    expect(component.primaryCode).toBe('FC-PROF01');
    expect(component.activeCodes.length).toBe(1);
    expect(component.activeStudents.length).toBe(1);
    expect(component.totalApprovedEarned).toBe(150);
    expect(component.totalPendingPayout).toBe(0);
  });

  it('filters students by search query', () => {
    component.searchQuery = 'alpha';
    expect(component.filteredStudents.length).toBe(1);

    component.searchQuery = 'nonexistent';
    expect(component.filteredStudents.length).toBe(0);
  });

  it('filters commissions by status filter and search query', () => {
    component.commissionStatusFilter = 'approved';
    expect(component.filteredCommissions.length).toBe(1);

    component.commissionStatusFilter = 'pending';
    expect(component.filteredCommissions.length).toBe(0);

    component.commissionStatusFilter = 'all';
    component.searchQuery = 'Mini project';
    expect(component.filteredCommissions.length).toBe(1);
  });

  it('toggles demo mode to provide instant preview for empty state teachers', () => {
    expect(component.demoMode).toBe(false);
    component.toggleDemoMode();
    expect(component.demoMode).toBe(true);
    expect(component.activeCodes.length).toBeGreaterThan(0);
    expect(component.activeStudents.length).toBeGreaterThan(0);
    expect(component.activeCommissions.length).toBeGreaterThan(0);
  });

  it('generates a unique referral code for the teacher', async () => {
    component.currentUid = 'teacher-uid-1';
    await component.generateMyCode();
    expect(mockReferralService.createReferralCode).toHaveBeenCalledWith('teacher-uid-1');
  });

  it('toggles code status between active and paused', async () => {
    const code = { code: 'FC-PROF01', teacherUid: 'teacher-uid-1', active: true, createdBy: 'admin', createdAt: 12345 };
    await component.toggleCodeStatus(code);
    expect(mockReferralService.toggleCodeActive).toHaveBeenCalledWith('FC-PROF01', false);
  });

  it('handles sign out properly and redirects to /login', async () => {
    await component.logout();
    expect(mockAuthService.logout).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('manages teacher revenue, available withdrawal balance, and payout requests', async () => {
    // Approved commission of 150 INR
    expect(component.totalApprovedEarned).toBe(150);
    expect(component.totalPaidPayout).toBe(0);
    expect(component.availableForWithdrawal).toBe(150);

    component.payoutDetails.method = 'upi';
    component.payoutDetails.upiId = 'prof.test@okaxis';
    (mockAuthService as any).savePayoutDetails = vi.fn().mockResolvedValue(undefined);
    (mockAuthService as any).submitPayoutRequest = vi.fn().mockResolvedValue({
      id: 'PR-999001',
      amount: 150,
      method: 'upi',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    await component.savePayoutDetails();
    expect(component.copyFeedback).toContain('saved');

    await component.requestPayout(150);
    expect(component.copyFeedback).toContain('submitted');
    expect(component.payoutRequests.length).toBe(1);
    expect(component.availableForWithdrawal).toBe(0); // 150 - 150 pending request = 0
  });
});

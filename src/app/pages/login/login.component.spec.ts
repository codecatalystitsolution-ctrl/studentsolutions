import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../../services/auth.service';
import { LoginComponent } from './login.component';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const authServiceMock = {
    login: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    getUserProfile: vi.fn()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('displays pending review modal and logs out when applicant status is pending_approval', async () => {
    authServiceMock.login.mockResolvedValue({ uid: 'usr-teacher-1', email: 'teacher@dtu.ac.in' });
    authServiceMock.getUserProfile.mockResolvedValue({
      role: 'Teacher',
      status: 'pending_approval',
      fullName: 'Prof. Ananya',
      email: 'teacher@dtu.ac.in',
      employeeID: 'TEA-78AB12'
    });

    component.loginForm.patchValue({
      email: 'teacher@dtu.ac.in',
      password: 'SecretPassword123'
    });

    await component.onSubmit();

    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(component.showPendingModal).toBe(true);
    expect(component.pendingApplicant?.fullName).toBe('Prof. Ananya');
  });

  it('displays rejected modal with admin reason when applicant status is rejected', async () => {
    authServiceMock.login.mockResolvedValue({ uid: 'usr-del-1', email: 'rider@logistics.in' });
    authServiceMock.getUserProfile.mockResolvedValue({
      role: 'Delivery',
      status: 'rejected',
      fullName: 'Rider Kumar',
      email: 'rider@logistics.in',
      rejectionReason: 'Driving license document expired.'
    });

    component.loginForm.patchValue({
      email: 'rider@logistics.in',
      password: 'SecretPassword123'
    });

    await component.onSubmit();

    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(component.showRejectedModal).toBe(true);
    expect(component.rejectedApplicant?.reason).toBe('Driving license document expired.');
  });
});

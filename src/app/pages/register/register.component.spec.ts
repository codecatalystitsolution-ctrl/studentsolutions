import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { RegisterComponent } from './register.component';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  const authServiceMock = {
    registerUser: vi.fn().mockResolvedValue({ user: { uid: 'u12345678' } }),
    logout: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: AuthService, useValue: authServiceMock },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('defaults to Student role with student validators enabled', () => {
    expect(component.selectedRole).toBe('Student');
    expect(component.registerForm.get('rollNumber')?.validator).toBeTruthy();
    expect(component.registerForm.get('department')?.validator).toBeNull();
    expect(component.registerForm.get('vehicleNumber')?.validator).toBeNull();
  });

  it('switches to Teacher role and applies teacher validators', () => {
    component.registerForm.get('role')?.setValue('Teacher');
    expect(component.selectedRole).toBe('Teacher');
    expect(component.registerForm.get('department')?.validator).toBeTruthy();
    expect(component.registerForm.get('collegeName')?.validator).toBeTruthy();
    expect(component.registerForm.get('rollNumber')?.validator).toBeNull();
    expect(component.registerForm.get('vehicleNumber')?.validator).toBeNull();
  });

  it('switches to Delivery role and applies delivery validators', () => {
    component.registerForm.get('role')?.setValue('Delivery');
    expect(component.selectedRole).toBe('Delivery');
    expect(component.registerForm.get('vehicleNumber')?.validator).toBeTruthy();
    expect(component.registerForm.get('serviceArea')?.validator).toBeTruthy();
    expect(component.registerForm.get('collegeName')?.validator).toBeNull();
    expect(component.registerForm.get('rollNumber')?.validator).toBeNull();
  });

  it('automatically normalizes referral code to uppercase', () => {
    component.registerForm.get('referralCode')?.setValue('fc-prof7729');
    expect(component.registerForm.get('referralCode')?.value).toBe('FC-PROF7729');
  });

  it('submits Teacher application for verification, signs out user and displays review modal', async () => {
    component.registerForm.patchValue({
      role: 'Teacher',
      fullName: 'Prof. Ananya Verma',
      email: 'ananya@faculty.edu',
      phone: '9876543210',
      address: 'Staff Quarters DTU Campus',
      pincode: '110042',
      collegeName: 'Delhi Technical University',
      department: 'Computer Science & Engineering',
      password: 'Password123',
      confirmPassword: 'Password123'
    });

    expect(component.registerForm.valid).toBe(true);
    await component.onSubmit();

    expect(authServiceMock.registerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'Teacher',
        fullName: 'Prof. Ananya Verma',
        department: 'Computer Science & Engineering'
      }),
      'Password123'
    );
    expect(authServiceMock.logout).toHaveBeenCalled();
    expect(component.showSubmissionModal).toBe(true);
    expect(component.registeredApplicant?.id).toBe('TEA-U12345');
  });
});

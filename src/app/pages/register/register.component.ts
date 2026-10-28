import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;
  isLoading = false;
  showSubmissionModal = false;
  registeredApplicant: { fullName: string; email: string; role: string; id: string } | null = null;
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute, { optional: true });
  private themeService = inject(ThemeService);
  private notificationService = inject(NotificationService, { optional: true });
  theme = this.themeService.theme();

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.theme = this.themeService.theme();
  }

  get selectedRole(): string {
    return this.registerForm?.get('role')?.value || 'Student';
  }

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      // Account role: Student, Teacher, or Delivery
      role: ['Student', Validators.required],
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      whatsapp: ['', Validators.pattern(/^[0-9]{10}$/)],
      address: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
      password: ['', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(20),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      ]],
      confirmPassword: ['', Validators.required],

      // Student academic details
      referralCode: ['', Validators.maxLength(30)],
      collegeName: ['', Validators.required],
      courseName: ['', Validators.required],
      branch: ['', Validators.required],
      year: ['', Validators.required],
      semester: ['', Validators.required],
      rollNumber: ['', [Validators.required, Validators.pattern(/^\d{6,12}$/)]],

      // Teacher specific details
      department: [''],
      qualification: [''],
      facultyIdProof: [''],

      // Delivery specific details
      vehicleNumber: [''],
      serviceArea: [''],
      vehicleType: ['Two-Wheeler / Bike'],
      drivingLicense: ['']
    }, { validators: this.passwordMatchValidator });

    // React dynamically to role change
    this.registerForm.get('role')?.valueChanges.subscribe(role => {
      this.onRoleChange(role);
    });

    // Automatically uppercase referral codes
    this.registerForm.get('referralCode')?.valueChanges.subscribe(val => {
      if (val && typeof val === 'string' && val !== val.toUpperCase()) {
        this.registerForm.get('referralCode')?.setValue(val.toUpperCase(), { emitEvent: false });
      }
    });

    // Pre-fill referral code from link query parameters (?ref=... or ?referral=...)
    this.route?.queryParams.subscribe(params => {
      const refCode = params['ref'] || params['referral'] || params['referralCode'];
      if (refCode) {
        this.registerForm.get('role')?.setValue('Student');
        this.registerForm.get('referralCode')?.setValue(String(refCode).trim().toUpperCase());
      }
    });
  }

  onRoleChange(newRole: string): void {
    const studentFields = ['courseName', 'branch', 'year', 'semester', 'rollNumber'];
    const teacherFields = ['department'];
    const deliveryFields = ['vehicleNumber', 'serviceArea'];

    if (newRole === 'Student') {
      // College name is required for Student
      const collegeCtrl = this.registerForm.get('collegeName');
      collegeCtrl?.setValidators([Validators.required]);
      collegeCtrl?.updateValueAndValidity();

      studentFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        if (f === 'rollNumber') {
          ctrl?.setValidators([Validators.required, Validators.pattern(/^\d{6,12}$/)]);
        } else {
          ctrl?.setValidators([Validators.required]);
        }
        ctrl?.updateValueAndValidity();
      });

      teacherFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      });

      deliveryFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      });

    } else if (newRole === 'Teacher') {
      // College/Institution is required for Teacher
      const collegeCtrl = this.registerForm.get('collegeName');
      collegeCtrl?.setValidators([Validators.required]);
      collegeCtrl?.updateValueAndValidity();

      // Department is required for Teacher
      const deptCtrl = this.registerForm.get('department');
      deptCtrl?.setValidators([Validators.required]);
      deptCtrl?.updateValueAndValidity();

      // Clear student & delivery specific fields
      studentFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      });
      deliveryFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      });

    } else if (newRole === 'Delivery') {
      // Delivery staff do not require collegeName or department
      const collegeCtrl = this.registerForm.get('collegeName');
      collegeCtrl?.clearValidators();
      collegeCtrl?.updateValueAndValidity();

      const deptCtrl = this.registerForm.get('department');
      deptCtrl?.clearValidators();
      deptCtrl?.updateValueAndValidity();

      studentFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.clearValidators();
        ctrl?.updateValueAndValidity();
      });

      deliveryFields.forEach(f => {
        const ctrl = this.registerForm.get(f);
        ctrl?.setValidators([Validators.required]);
        ctrl?.updateValueAndValidity();
      });
    }

    this.registerForm.updateValueAndValidity();
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    return password && confirmPassword && password.value === confirmPassword.value ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.invalid || this.isLoading) {
      this.registerForm.markAllAsTouched();
      if (this.registerForm.invalid) {
        this.notificationService?.show(
          'warning',
          'Please complete all required fields for your selected account type.',
          'Incomplete Form'
        );
      }
      return;
    }

    this.isLoading = true;

    const formValue = this.registerForm.getRawValue();
    const role = formValue.role;
    const { fullName, email, phone, whatsapp, address, pincode, password } = formValue;

    let userData: any = {
      role,
      fullName,
      email,
      phone,
      whatsapp: whatsapp || '',
      address,
      pincode
    };

    if (role === 'Student') {
      userData = {
        ...userData,
        referralCode: formValue.referralCode ? formValue.referralCode.trim().toUpperCase() : '',
        collegeName: formValue.collegeName,
        courseName: formValue.courseName,
        branch: formValue.branch,
        year: formValue.year,
        semester: formValue.semester,
        rollNumber: formValue.rollNumber
      };
    } else if (role === 'Teacher') {
      userData = {
        ...userData,
        collegeName: formValue.collegeName,
        department: formValue.department,
        qualification: formValue.qualification || '',
        facultyIdProof: formValue.facultyIdProof || ''
      };
    } else if (role === 'Delivery') {
      userData = {
        ...userData,
        vehicleNumber: formValue.vehicleNumber,
        serviceArea: formValue.serviceArea,
        vehicleType: formValue.vehicleType || 'Two-Wheeler / Bike',
        drivingLicense: formValue.drivingLicense || ''
      };
    }

    try {
      const result = await this.authService.registerUser(userData, password);

      if (role === 'Teacher' || role === 'Delivery') {
        // Teacher and Delivery do not get direct access.
        // Sign out immediately so pending user cannot access protected areas
        await this.authService.logout();

        const shortId = (result?.user?.uid || '').substring(0, 6).toUpperCase();
        this.registeredApplicant = {
          fullName,
          email,
          role,
          id: role === 'Teacher' ? `TEA-${shortId}` : `DEL-${shortId}`
        };
        this.showSubmissionModal = true;
        this.notificationService?.show(
          'info',
          `Application submitted! As a ${role}, your credentials have been forwarded for admin verification.`,
          'Application Under Review'
        );
      } else {
        this.notificationService?.show(
          'success',
          `Account created successfully as Student! Redirecting to your portal...`,
          'Registration Complete'
        );
        this.router.navigate(['/dashboard/home']);
      }
    } catch (error: any) {
      console.error('Registration Failed:', error.message);
      this.notificationService?.show(
        'error',
        'Registration Failed: ' + error.message,
        'Registration Error'
      );
    } finally {
      this.isLoading = false;
    }
  }

  goToLogin(): void {
    this.showSubmissionModal = false;
    this.router.navigate(['/login']);
  }

  goToHome(): void {
    this.showSubmissionModal = false;
    this.router.navigate(['/home']);
  }
}

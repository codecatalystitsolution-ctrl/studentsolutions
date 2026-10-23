import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

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
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private themeService = inject(ThemeService);
  theme = this.themeService.theme();

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.theme = this.themeService.theme();
  }

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      // Account role is fixed to Student for self-registration per PRD & RBAC rules
      role: ['Student', Validators.required],
      referralCode: ['', Validators.maxLength(30)],
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

      // Academic details
      collegeName: ['', Validators.required],
      courseName: ['', Validators.required],
      branch: ['', Validators.required],
      year: ['', Validators.required],
      semester: ['', Validators.required],
      rollNumber: ['', [Validators.required, Validators.pattern(/^\d{6,12}$/)]]
    }, { validators: this.passwordMatchValidator });
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
        console.error('Form is invalid. Please check the fields.');
      }
      return;
    }

    this.isLoading = true;

    const formValue = this.registerForm.getRawValue();
    const { referralCode, fullName, email, phone, whatsapp, address, pincode, password } = formValue;

    const userData: any = {
      role: 'Student',
      referralCode: referralCode ? referralCode.trim().toUpperCase() : '',
      fullName,
      email,
      phone,
      whatsapp: whatsapp || '',
      address,
      pincode,
      collegeName: formValue.collegeName,
      courseName: formValue.courseName,
      branch: formValue.branch,
      year: formValue.year,
      semester: formValue.semester,
      rollNumber: formValue.rollNumber
    };

    try {
      await this.authService.registerUser(userData, password);
      this.router.navigate(['/dashboard/home']);
    } catch (error: any) {
      console.error('Registration Failed:', error.message);
      alert('Registration Failed: ' + error.message);
    } finally {
      this.isLoading = false;
    }
  }
}

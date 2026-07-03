import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common'; 
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  registerForm!: FormGroup;

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  ngOnInit(): void {
    this.registerForm = this.fb.group({
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      whatsapp: ['', Validators.pattern('^[0-9]{10}$')],
      collegeName: ['', Validators.required],
      courseName: ['', Validators.required],
      branch: ['', Validators.required],
      year: ['', Validators.required],
      semester: ['', Validators.required],
      rollNumber: ['', Validators.required],
      address: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validator: this.passwordMatchValidator });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      try {
        const formData = this.registerForm.value;
        // Ye line seedha AuthService ko data bhej rahi hai 👇
        await this.authService.registerUser(formData, formData.password);
        
        console.log('Registration Successful!');
        this.router.navigate(['/dashboard/home']);
      } catch (error: any) {
          console.error('Registration Failed:', error.message);
          this.notificationService.show('error', 'Registration Failed: ' + error.message, 'Registration Failed');
      }
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
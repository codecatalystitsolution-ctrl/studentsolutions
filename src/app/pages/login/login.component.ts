import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  
  // Dependencies inject karein
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
if (this.loginForm.valid) {
    const { email, password } = this.loginForm.value;
    try {
      await this.authService.login(email, password);
      console.log('Login Successful!');
      
      // Admin emails ki list (Yahan apne actual admin emails zarur rakhein)
      const adminEmails = ['admin@filecrafters.in', 'wmohd2514@outlook.com'];

      // Smart Routing Logic: Admin ko Admin page, Student ko Student page
      if (adminEmails.includes(email)) {
        console.log('Admin detected. Redirecting to Operations Center...');
        this.router.navigate(['/admin/dashboard']);
      } else {
        console.log('Student detected. Redirecting to Student Dashboard...');
        this.router.navigate(['/dashboard/home']); 
      }
      
    } catch (error: any) {
      console.error('Login Failed:', error.message);
      alert('Login Failed: ' + error.message);
    }
  } else {
    alert('Please fill in all required fields with valid information.');
  }
}

  async loginWithGoogle() {
    try {
      await this.authService.loginWithGoogle();
      console.log('Google Login Successful!');
      this.router.navigate(['/dashboard/home']);
    } catch (error: any) {
      console.error('Google Login Failed:', error.message);
    }
  }
}
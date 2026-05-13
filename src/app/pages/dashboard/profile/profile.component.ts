import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, get, update } from '@angular/fire/database';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private auth = inject(Auth);
  private db = inject(Database);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  profileForm!: FormGroup;
  userData: any = null;
  userId: string = '';
  isEditMode: boolean = false;
  isLoading: boolean = true;

  ngOnInit(): void {
    // Form Setup
// Form Setup ke andar
    this.profileForm = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      whatsapp: ['', Validators.pattern('^[0-9]{10}$')],
      collegeName: ['', Validators.required],
      courseName: ['', Validators.required],
      branch: ['', Validators.required],
      
      // Yahan Semester add kiya gaya hai
      year: ['', Validators.required],
      semester: ['', Validators.required],
      
      rollNumber: ['', Validators.required],
      address: ['', Validators.required],
      pincode: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]]
    });

    // Fetch Data
    authState(this.auth).subscribe(async (user) => {
      if (user) {
        this.userId = user.uid;
        await this.loadUserProfile();
      }
    });
  }

async loadUserProfile() {
    try {
      const userRef = ref(this.db, 'users/' + this.userId);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        this.userData = snapshot.val();
        this.profileForm.patchValue(this.userData);
      } else {
        // Agar DB me data nahi hai (Purana login hai) toh empty rakhein
        console.log("No data found for this user in Database");
      }
      
      this.isLoading = false; 
      this.cdr.detectChanges(); // 3. Yahan UI update trigger karein!

    } catch (error) {
      console.error("Error fetching profile", error);
      this.isLoading = false;
      this.cdr.detectChanges(); // Error me bhi spinner hata dein
    }
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    if (!this.isEditMode) {
      // Agar cancel kiya, toh purana data wapas form me daal do
      this.profileForm.patchValue(this.userData);
    }
  }

  async saveProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    try {
      const userRef = ref(this.db, 'users/' + this.userId);
      // Update data in Firebase
      await update(userRef, this.profileForm.value);
      
      // Update local view data
      this.userData = { ...this.userData, ...this.profileForm.value };
      this.isEditMode = false;
      alert('Profile updated successfully! ✨');
    } catch (error) {
      console.error("Error updating profile", error);
      alert('Failed to update profile.');
    }
  }
}
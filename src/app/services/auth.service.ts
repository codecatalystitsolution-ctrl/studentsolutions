import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Database, ref, set, update, get } from '@angular/fire/database';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // Angular 17+ ka naya 'inject' method
    private auth = inject(Auth);
    private db = inject(Database);

    // === Email/Password Login ===
    async login(email: string, password: string) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }

    // === Register User with Custom ID ===
    async registerUser(formData: any, password: string) {
        try { // <-- YAHAN 'try' MISSING THA
            // 1. Firebase Auth create karo
            const userCredential = await createUserWithEmailAndPassword(this.auth, formData.email, password);
            const uid = userCredential.user.uid;

            // 2. ID Generate karo
            const shortId = uid.substring(0, 6).toUpperCase();
            const customUserID = `FC-${shortId}`;

            // 3. Password hatao
            const { password: _, confirmPassword: __, ...cleanUserData } = formData;

            // 4. Data set karo
            const finalDataToSave = {
                ...cleanUserData,
                studentID: customUserID,
                role: 'Student',
                status: 'active',
                createdAt: new Date().toISOString()
            };

            // 5. Database me save karo
            const userRef = ref(this.db, `users/${uid}`);
            await set(userRef, finalDataToSave);

            return userCredential;
        } catch (error) {
            throw error;
        }
    }

    async getUserProfile(uid: string) {
        try {
            const userRef = ref(this.db, `users/${uid}`);
            const snapshot = await get(userRef);
            return snapshot.exists() ? snapshot.val() : null;
        } catch (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
    }

    async setUserStatus(uid: string, status: 'active' | 'suspended') {
        try {
            const userRef = ref(this.db, `users/${uid}`);
            await update(userRef, {
                status,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating user status:', error);
            throw error;
        }
    }

    // === Logout Function (Ab class ke andar hai) ===
    async logout() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Logout Failed', error);
        }
    }
}
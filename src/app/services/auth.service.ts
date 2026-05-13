import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from '@angular/fire/auth';
import { Database, ref, set } from '@angular/fire/database';
import { createUserWithEmailAndPassword } from '@angular/fire/auth';

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    // Angular 17+ ka naya 'inject' method
    private auth = inject(Auth);
    private db = inject(Database);

    // Email/Password Login
    async login(email: string, password: string) {
        try {
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }

    // Google Login
    async loginWithGoogle() {
        try {
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(this.auth, provider);

            // Save basic user info to Realtime DB on first login
            const userRef = ref(this.db, 'users/' + userCredential.user.uid);
            await set(userRef, {
                email: userCredential.user.email,
                displayName: userCredential.user.displayName,
                lastLogin: new Date().toISOString()
            });

            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }


    async registerUser(userData: any, password: string) {
        try {
            // 1. Auth mein user create karein
            const userCredential = await createUserWithEmailAndPassword(this.auth, userData.email, password);
            const uid = userCredential.user.uid;

            // 2. Realtime DB mein baaki saari details save karein
            const userRef = ref(this.db, 'users/' + uid);

            // Password DB mein save nahi karte (Security risk)
            const { password: _, confirmPassword: __, ...dbData } = userData;

            await set(userRef, {
                ...dbData,
                role: 'student', // Default role
                createdAt: new Date().toISOString()
            });

            return userCredential.user;
        } catch (error) {
            throw error;
        }
    }

    // auth.service.ts ke andar add karein
    async logout() {
        try {
            await this.auth.signOut();
        } catch (error) {
            console.error('Logout Failed', error);
        }
    }

}

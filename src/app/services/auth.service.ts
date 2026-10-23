import { Injectable, inject } from '@angular/core';
import { Auth, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { Database, ref, set, update, get, serverTimestamp } from '@angular/fire/database';

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
            const requestedRole = String(formData?.role || 'Student').trim().toLowerCase();
            if (requestedRole !== 'student') {
                throw new Error('Self-registration is available for student accounts only. Contact an administrator for staff access.');
            }
            const referralCode = String(formData?.referralCode || '').trim().toUpperCase();
            let referralTeacherUid = '';
            if (referralCode) {
                const codeSnapshot = await get(ref(this.db, `referralCodes/${referralCode}`));
                const codeRecord = codeSnapshot.val();
                if (!codeRecord?.active || !codeRecord.teacherUid) throw new Error('This teacher referral code is invalid or inactive.');
                referralTeacherUid = codeRecord.teacherUid;
            }
            // 1. Firebase Auth create karo
            const userCredential = await createUserWithEmailAndPassword(this.auth, formData.email, password);
            const uid = userCredential.user.uid;

            // 2. ID Generate karo
            const shortId = uid.substring(0, 6).toUpperCase();
            const customUserID = `FC-${shortId}`;

            // 3. Password hatao
            const { password: _, confirmPassword: __, referralCode: ___, ...cleanUserData } = formData;


            const roleLower = 'student';
            let finalDataToSave: any = {
                ...cleanUserData,
                email: userCredential.user.email || cleanUserData.email,
                role: 'Student',
                status: 'active',
                createdAt: new Date().toISOString()
            };

            // Preserve existing studentID behaviour for students
            if (roleLower === 'student') {
                finalDataToSave.studentID = customUserID;
            } else if (roleLower === 'teacher') {
                // Teacher ID prefix TEA-
                finalDataToSave.employeeID = `TEA-${uid.substring(0,6).toUpperCase()}`;
            } else if (roleLower === 'delivery' || roleLower === 'deliveryboy' || roleLower === 'delivery-boy') {
                finalDataToSave.deliveryID = `DEL-${uid.substring(0,6).toUpperCase()}`;
            }

            // 5. Database me save karo
            const userRef = ref(this.db, `users/${uid}`);
            await set(userRef, finalDataToSave);

            if (referralCode && referralTeacherUid) {
                try {
                    await set(ref(this.db, `referralAttributions/${uid}`), {
                        studentUid: uid,
                        teacherUid: referralTeacherUid,
                        referralCode,
                        createdAt: serverTimestamp()
                    });
                } catch (attributionError) {
                    console.error('Student account was created but referral attribution could not be saved:', attributionError);
                    throw new Error('Your account was created, but the referral could not be recorded. Please contact support before placing an order.');
                }
            }

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

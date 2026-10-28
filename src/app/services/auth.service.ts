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
        try {
            const requestedRole = String(formData?.role || 'Student').trim().toLowerCase();
            const allowedRoles = ['student', 'teacher', 'delivery'];
            if (!allowedRoles.includes(requestedRole)) {
                throw new Error('Please select a valid account profile: Student, Teacher, or Delivery.');
            }

            const referralCode = String(formData?.referralCode || '').trim().toUpperCase();
            let referralTeacherUid = '';
            if (referralCode && requestedRole === 'student') {
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

            const role = requestedRole === 'teacher' ? 'Teacher' : requestedRole === 'delivery' ? 'Delivery' : 'Student';
            const initialStatus = role === 'Student' ? 'active' : 'pending_approval';
            let finalDataToSave: any = {
                ...cleanUserData,
                email: userCredential.user.email || cleanUserData.email,
                role,
                status: initialStatus,
                createdAt: new Date().toISOString()
            };

            // Custom IDs according to profile role
            if (role === 'Student') {
                finalDataToSave.studentID = customUserID;
                if (referralCode && referralTeacherUid) {
                    finalDataToSave.referralCode = referralCode;
                    finalDataToSave.referredByTeacherUid = referralTeacherUid;
                }
            } else if (role === 'Teacher') {
                finalDataToSave.employeeID = `TEA-${shortId}`;
                finalDataToSave.appliedAt = new Date().toISOString();
                finalDataToSave.status = 'pending_approval';
            } else if (role === 'Delivery') {
                finalDataToSave.deliveryID = `DEL-${shortId}`;
                finalDataToSave.appliedAt = new Date().toISOString();
                finalDataToSave.status = 'pending_approval';
            }

            // 5. Database me save karo
            const userRef = ref(this.db, `users/${uid}`);
            await set(userRef, finalDataToSave);

            if (referralCode && referralTeacherUid && role === 'Student') {
                try {
                    await set(ref(this.db, `referralAttributions/${uid}`), {
                        studentUid: uid,
                        teacherUid: referralTeacherUid,
                        referralCode,
                        studentName: formData.fullName || 'Student',
                        studentEmail: formData.email || '',
                        studentID: customUserID,
                        collegeName: formData.collegeName || '',
                        courseBranch: (formData.courseName || '') + (formData.branch ? ' - ' + formData.branch : ''),
                        createdAt: Date.now()
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

    async approveUserApplication(uid: string, role: string, adminNotes?: string) {
        try {
            const userRef = ref(this.db, `users/${uid}`);
            await update(userRef, {
                status: 'active',
                approvedAt: new Date().toISOString(),
                approvedBy: 'Admin',
                adminNotes: adminNotes || '',
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error approving user application:', error);
            throw error;
        }
    }

    async rejectUserApplication(uid: string, role: string, reason: string) {
        try {
            const userRef = ref(this.db, `users/${uid}`);
            await update(userRef, {
                status: 'rejected',
                rejectedAt: new Date().toISOString(),
                rejectedBy: 'Admin',
                rejectionReason: reason,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error rejecting user application:', error);
            throw error;
        }
    }

    async savePayoutDetails(uid: string, payoutDetails: any) {
        try {
            const userRef = ref(this.db, `users/${uid}`);
            await update(userRef, {
                payoutDetails,
                payoutUpdatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error saving payout details:', error);
            throw error;
        }
    }

    async submitPayoutRequest(uid: string, request: { amount: number; method: string; details: any; role: string; notes?: string }) {
        try {
            const requestId = `PR-${Date.now().toString().slice(-6)}`;
            const userRef = ref(this.db, `users/${uid}`);
            const profileSnap = await get(userRef);
            const profile = profileSnap.val() || {};
            const existingRequests = profile.payoutRequests || {};
            const newRequest = {
                id: requestId,
                uid,
                applicantName: profile.fullName || profile.displayName || (request.role === 'Teacher' ? 'Teacher Partner' : 'Delivery Partner'),
                applicantEmail: profile.email || '',
                phone: profile.phone || request.details?.phone || '',
                amount: request.amount,
                method: request.method,
                details: request.details,
                role: request.role,
                notes: request.notes || '',
                status: 'pending',
                createdAt: new Date().toISOString()
            };
            await update(userRef, {
                payoutRequests: {
                    ...existingRequests,
                    [requestId]: newRequest
                }
            });
            try {
                const topLevelRef = ref(this.db, `payoutRequests/${requestId}`);
                await set(topLevelRef, newRequest);
            } catch (mirrorErr) {
                console.warn('Could not mirror top-level payout request:', mirrorErr);
            }
            return newRequest;
        } catch (error) {
            console.error('Error submitting payout request:', error);
            throw error;
        }
    }

    async updatePayoutRequestStatus(
        requestId: string,
        uid: string,
        status: 'disbursed' | 'rejected',
        meta: { transactionRef?: string; note?: string; rejectionReason?: string }
    ) {
        try {
            const adminUser = this.auth.currentUser;
            const now = new Date().toISOString();
            const updates: Record<string, any> = {
                status,
                updatedAt: now,
                processedBy: adminUser?.email || adminUser?.uid || 'Admin'
            };
            if (status === 'disbursed') {
                updates['disbursedAt'] = now;
                updates['transactionRef'] = meta.transactionRef || '';
                updates['disbursedNote'] = meta.note || '';
            } else {
                updates['rejectedAt'] = now;
                updates['rejectionReason'] = meta.rejectionReason || meta.note || 'Rejected by Admin';
            }

            const userReqRef = ref(this.db, `users/${uid}/payoutRequests/${requestId}`);
            await update(userReqRef, updates);

            try {
                const topReqRef = ref(this.db, `payoutRequests/${requestId}`);
                await update(topReqRef, updates);
            } catch (topErr) {
                console.warn('Could not update top-level payout request status:', topErr);
            }
        } catch (error) {
            console.error('Error updating payout request status:', error);
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

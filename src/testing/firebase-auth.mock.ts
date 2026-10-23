import { of } from 'rxjs';

export interface VisualTestUser {
  uid: string;
  email: string;
}

export class Auth {
  constructor(public currentUser: VisualTestUser | null) {}

  async signOut(): Promise<void> {
    this.currentUser = null;
    localStorage.setItem('filecrafters-visual-test-auth', 'anonymous');
  }
}

export class GoogleAuthProvider {}

export function authState(auth: Auth) {
  return of(auth.currentUser);
}

export async function signInWithEmailAndPassword(auth: Auth, email: string, _password: string) {
  auth.currentUser = {
    uid: email === 'admin@filecrafters.in' ? 'visual-admin' : 'visual-student',
    email,
  };
  localStorage.setItem('filecrafters-visual-test-auth', email === 'admin@filecrafters.in' ? 'admin' : 'student');
  return { user: auth.currentUser };
}

export async function createUserWithEmailAndPassword(auth: Auth, email: string, _password: string) {
  auth.currentUser = { uid: 'visual-new-user', email };
  localStorage.setItem('filecrafters-visual-test-auth', 'student');
  return { user: auth.currentUser };
}

export async function signInWithPopup(auth: Auth) {
  auth.currentUser = { uid: 'visual-student', email: 'student@example.test' };
  return { user: auth.currentUser };
}

export async function signOut(auth: Auth): Promise<void> {
  await auth.signOut();
}

export async function sendPasswordResetEmail(_auth: Auth, _email: string): Promise<void> {}
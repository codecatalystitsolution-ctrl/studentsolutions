import { vi } from 'vitest';
import { of } from 'rxjs';

vi.mock('@angular/fire/auth', () => ({
  Auth: class Auth {},
  authState: vi.fn((auth: { testUser?: { uid: string; email: string } | null }) =>
    of(Object.prototype.hasOwnProperty.call(auth, 'testUser')
      ? auth.testUser
      : { uid: 'test-user', email: 'student@example.test' })),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  GoogleAuthProvider: class GoogleAuthProvider {},
  signInWithPopup: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
}));

vi.mock('@angular/fire/database', () => ({
  Database: class Database {},
  ref: vi.fn((_database: unknown, path: string) => ({ path })),
  onValue: vi.fn(() => () => undefined),
  off: vi.fn(),
  push: vi.fn(() => ({ key: 'test-key' })),
  set: vi.fn(async () => undefined),
  update: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  get: vi.fn(async () => ({
    exists: () => false,
    val: () => null,
  })),
}));
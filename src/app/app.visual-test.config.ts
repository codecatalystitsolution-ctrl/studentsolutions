import { ApplicationConfig } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { routes } from './app.routes';

function createVisualTestAuth(): Auth {
  const selectedUser = localStorage.getItem('filecrafters-visual-test-auth') || 'student';
  const user = selectedUser === 'anonymous'
    ? null
    : selectedUser === 'admin'
      ? { uid: 'visual-admin', email: 'admin@filecrafters.in' }
      : { uid: 'visual-student', email: 'student@example.test' };

  return new Auth(user);
}

export const visualTestAppConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
    { provide: Auth, useFactory: createVisualTestAuth },
    { provide: Database, useValue: new Database() },
  ],
};
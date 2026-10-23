import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'; // 1. Is updated animation layer ko import karein

// Firebase Imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { connectAuthEmulator, getAuth, provideAuth } from '@angular/fire/auth';
import { connectDatabaseEmulator, getDatabase, provideDatabase } from '@angular/fire/database';
import { connectStorageEmulator, getStorage, provideStorage } from '@angular/fire/storage';
import { environment } from '../environments/environments';

function useLocalFirebaseEmulators(): boolean {
  if (typeof window === 'undefined') return false;
  const localHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  try {
    return localHost && (window.localStorage.getItem('filecrafters-use-emulators') === 'true'
      || new URLSearchParams(window.location.search).get('emulators') === '1');
  } catch {
    return false;
  }
}

function firebaseConfigForCurrentHost() {
  return useLocalFirebaseEmulators()
    ? {
      ...environment.firebase,
      projectId: 'demo-filecrafters',
      databaseURL: 'https://demo-filecrafters-default-rtdb.firebaseio.com/',
      storageBucket: 'demo-filecrafters.appspot.com'
    }
    : environment.firebase;
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(), // 2. Async wrapper inject karein (Isse white screen turant chali jayegi)

    // Initialize Firebase
    provideFirebaseApp(() => initializeApp(firebaseConfigForCurrentHost())),
    provideAuth(() => {
      const auth = getAuth();
      if (useLocalFirebaseEmulators()) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      return auth;
    }),
    provideDatabase(() => {
      const database = getDatabase();
      if (useLocalFirebaseEmulators()) connectDatabaseEmulator(database, '127.0.0.1', 9000);
      return database;
    }),
    provideStorage(() => {
      const storage = getStorage();
      if (useLocalFirebaseEmulators()) connectStorageEmulator(storage, '127.0.0.1', 9199);
      return storage;
    })
  ]
};

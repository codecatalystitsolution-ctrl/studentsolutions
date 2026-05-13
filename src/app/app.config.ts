import { ApplicationConfig, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms'; // 1. Yahan import karein
import { App } from './app';
import { LoginComponent } from './pages/login/login.component'; // 3. Yahan import karein
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Firebase Imports
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getDatabase, provideDatabase } from '@angular/fire/database';
import { environment } from '../environments/environments';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Initialize Firebase
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    provideDatabase(() => getDatabase())
  ]
};

// @NgModule({
//   declarations: [
//     App,
//     LoginComponent
//   ],
//   imports: [
//     BrowserModule,
//     ReactiveFormsModule // 2. Yahan array mein add karein
//   ],
//   providers: [],
//   bootstrap: [App]
// })

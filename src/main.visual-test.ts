import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { visualTestAppConfig } from './app/app.visual-test.config';

bootstrapApplication(App, visualTestAppConfig).catch((error) => console.error(error));
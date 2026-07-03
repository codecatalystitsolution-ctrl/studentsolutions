import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NotificationComponent } from './shared/notification/notification.component';
import { ConfirmComponent } from './shared/confirmation/confirm.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, ConfirmComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('filecrafters-web');
}

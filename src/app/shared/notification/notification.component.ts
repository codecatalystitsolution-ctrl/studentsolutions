import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from './notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss']
})
export class NotificationComponent {
  private notificationService = inject(NotificationService);
  messages = this.notificationService.messages;

  dismiss(id: string) {
    this.notificationService.dismiss(id);
  }
}

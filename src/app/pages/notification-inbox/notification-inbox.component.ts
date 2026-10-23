import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import { Unsubscribe } from '@angular/fire/database';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationInboxService, UserNotification } from '../../services/notification-inbox.service';
import { NotificationService } from '../../shared/notification/notification.service';

@Component({
  selector: 'app-notification-inbox',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-inbox.component.html',
  styleUrl: './notification-inbox.component.scss'
})
export class NotificationInboxComponent implements OnInit, OnDestroy {
  private readonly auth = inject(Auth);
  private readonly inbox = inject(NotificationInboxService);
  private readonly router = inject(Router);
  private readonly toast = inject(NotificationService);
  userId = '';
  items: Array<UserNotification & { id: string }> = [];
  loading = true;
  private authSubscription?: Subscription;
  private stopInbox: Unsubscribe | null = null;

  get unreadCount(): number { return this.items.filter(item => !item.isRead).length; }

  ngOnInit(): void {
    this.authSubscription = authState(this.auth).subscribe(user => {
      this.stopInbox?.();
      this.userId = user?.uid || '';
      if (!user) {
        this.items = [];
        this.loading = false;
        return;
      }
      this.loading = true;
      this.stopInbox = this.inbox.watchOwn(user.uid, items => {
        this.items = items;
        this.loading = false;
      });
    });
  }

  async open(item: UserNotification & { id: string }): Promise<void> {
    try {
      if (!item.isRead) await this.inbox.markRead(this.userId, item.id);
      await this.router.navigateByUrl(item.route);
    } catch (error) {
      console.error('Could not open notification:', error);
      this.toast.show('error', 'This notification could not be opened. Please refresh and try again.', 'Notification Failed');
    }
  }

  async markRead(item: UserNotification & { id: string }): Promise<void> {
    try {
      await this.inbox.markRead(this.userId, item.id);
    } catch (error) {
      console.error('Could not mark notification read:', error);
      this.toast.show('error', 'This notification could not be updated.', 'Update Failed');
    }
  }

  async markAllRead(): Promise<void> {
    const unread = this.items.filter(item => !item.isRead);
    for (const item of unread) await this.markRead(item);
  }

  ngOnDestroy(): void {
    this.authSubscription?.unsubscribe();
    this.stopInbox?.();
  }
}

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, onValue, get } from '@angular/fire/database';
import { NotificationInboxService, NotificationType, UserNotification } from '../../../services/notification-inbox.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';

export interface NotificationLogItem extends UserNotification {
  id: string;
}

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-notifications.component.html',
  styleUrls: ['./admin-notifications.component.scss']
})
export class AdminNotificationsComponent implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private inbox = inject(NotificationInboxService);
  private notification = inject(NotificationService);
  private csvExport = inject(CsvExportService);
  private confirm = inject(ConfirmService);

  // Compose Model
  composeModel = {
    title: '',
    message: '',
    type: 'system' as NotificationType,
    audience: 'all_students' as 'all_students' | 'specific_student' | 'delivery_staff' | 'teachers',
    specificRecipientUid: '',
    route: '/dashboard/my-orders'
  };

  // User lists for recipient selection
  students: Array<{ uid: string; fullName: string; email: string }> = [];
  deliveryStaff: Array<{ uid: string; fullName: string; email: string }> = [];
  teachers: Array<{ uid: string; fullName: string; email: string }> = [];

  // Notification logs & history
  notificationLogs: NotificationLogItem[] = [];
  filteredLogs: NotificationLogItem[] = [];
  searchTerm = '';
  typeFilter = '';
  isLoading = true;
  isSending = false;
  isRefreshing = false;

  // Pagination (PRD 7.6)
  currentPage = 1;
  readonly pageSize = 15;

  // Preview Modal
  showPreviewModal = false;

  readonly allowedRoutes = [
    { label: 'Student Orders (/dashboard/my-orders)', value: '/dashboard/my-orders' },
    { label: 'Student Support Tickets (/dashboard/my-tickets)', value: '/dashboard/my-tickets' },
    { label: 'Delivery Portal (/delivery-portal)', value: '/delivery-portal' },
    { label: 'Teacher Referrals (/teacher/referrals)', value: '/teacher/referrals' },
    { label: 'Order Details (/admin/order-details)', value: '/admin/order-details' }
  ];

  ngOnInit(): void {
    this.loadUsers();
    this.loadNotificationLogs();
  }

  loadUsers(): void {
    const usersRef = ref(this.db, 'users');
    onValue(usersRef, snapshot => {
      const users = snapshot.val() || {};
      this.students = [];
      this.deliveryStaff = [];
      this.teachers = [];

      Object.keys(users).forEach(uid => {
        const u = users[uid];
        if (u.status !== 'active') return;
        const role = (u.role || '').toLowerCase();
        const item = { uid, fullName: u.fullName || u.name || 'User', email: u.email || '' };

        if (role === 'student') {
          this.students.push(item);
        } else if (role === 'teacher') {
          this.teachers.push(item);
        } else if (role === 'delivery' || role === 'deliveryboy' || role === 'delivery-boy') {
          this.deliveryStaff.push(item);
        }
      });
      this.cdr.detectChanges();
    });
  }

  loadNotificationLogs(): void {
    this.isLoading = true;
    const notifsRef = ref(this.db, 'notifications');

    onValue(
      notifsRef,
      snapshot => {
        const data = snapshot.val() || {};
        this.processLogs(data);
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error => {
        console.error('Failed to load notification history:', error);
        this.isLoading = false;
        this.isRefreshing = false;
      }
    );
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'notifications'));
      this.processLogs(snapshot.val() || {});
      this.notification.show('success', 'Notification history refreshed.', 'Refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      this.notification.show('error', 'Could not refresh notification history.', 'Error');
    } finally {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }
  }

  private processLogs(data: Record<string, any>): void {
    const allLogs: NotificationLogItem[] = [];
    Object.keys(data).forEach(recipientUid => {
      const userNotifs = data[recipientUid] || {};
      Object.keys(userNotifs).forEach(notifId => {
        allLogs.push({
          id: notifId,
          recipientUid,
          ...userNotifs[notifId]
        });
      });
    });

    allLogs.sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
    this.notificationLogs = allLogs;
    this.filterLogs();
  }

  filterLogs(): void {
    const term = this.searchTerm.toLowerCase().trim();
    const type = this.typeFilter.toLowerCase();

    this.filteredLogs = this.notificationLogs.filter(item => {
      const titleMatch = (item.title || '').toLowerCase().includes(term);
      const msgMatch = (item.message || '').toLowerCase().includes(term);
      const userMatch = (item.recipientUid || '').toLowerCase().includes(term);
      const matchesTerm = !term || titleMatch || msgMatch || userMatch;
      const matchesType = !type || (item.type || '').toLowerCase() === type;
      return matchesTerm && matchesType;
    });

    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredLogs.length / this.pageSize));
  }

  get paginatedLogs(): NotificationLogItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  exportCsv(): void {
    const today = new Date().toISOString().slice(0, 10);
    const columns = [
      { key: 'title', label: 'Title' },
      { key: 'message', label: 'Message Body' },
      { key: 'type', label: 'Type' },
      { key: 'recipientUid', label: 'Recipient UID' },
      { key: 'route', label: 'Target Route' },
      { key: 'isRead', label: 'Read Status', format: (r: boolean) => (r ? 'Read' : 'Unread') },
      { key: 'createdAt', label: 'Date', format: (d: any) => (d ? new Date(Number(d)).toLocaleString() : '') }
    ];

    const success = this.csvExport.exportToCsv(`notifications_${today}.csv`, columns, this.filteredLogs);
    if (success) {
      this.notification.show('success', `Exported ${this.filteredLogs.length} notifications to CSV.`, 'CSV Export');
    }
  }

  openPreview(): void {
    if (!this.composeModel.title.trim() || !this.composeModel.message.trim()) {
      this.notification.show('warning', 'Please provide both title and message body.', 'Incomplete Notification');
      return;
    }
    if (this.composeModel.audience === 'specific_student' && !this.composeModel.specificRecipientUid) {
      this.notification.show('warning', 'Please select a specific recipient student.', 'Recipient Required');
      return;
    }
    this.showPreviewModal = true;
  }

  closePreview(): void {
    this.showPreviewModal = false;
  }

  async confirmAndSend(): Promise<void> {
    this.closePreview();

    let targetUids: string[] = [];
    if (this.composeModel.audience === 'specific_student') {
      targetUids = [this.composeModel.specificRecipientUid];
    } else if (this.composeModel.audience === 'all_students') {
      targetUids = this.students.map(s => s.uid);
    } else if (this.composeModel.audience === 'delivery_staff') {
      targetUids = this.deliveryStaff.map(d => d.uid);
    } else if (this.composeModel.audience === 'teachers') {
      targetUids = this.teachers.map(t => t.uid);
    }

    if (targetUids.length === 0) {
      this.notification.show('warning', 'No active recipient accounts found for the chosen audience.', 'No Recipients');
      return;
    }

    const confirmed = await this.confirm.confirm({
      title: 'Confirm Send Broadcast',
      message: `Send this notification to ${targetUids.length} active recipient(s)?`,
      confirmText: 'Send Now',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    this.isSending = true;
    let sentCount = 0;

    for (const uid of targetUids) {
      try {
        await this.inbox.notifyUser(
          uid,
          this.composeModel.type,
          this.composeModel.title,
          this.composeModel.message,
          this.composeModel.route
        );
        sentCount++;
      } catch (err) {
        console.warn(`Could not dispatch notification to user ${uid}:`, err);
      }
    }

    this.isSending = false;
    this.notification.show('success', `Successfully delivered notification to ${sentCount} recipient(s).`, 'Broadcast Sent');

    // Reset compose model
    this.composeModel.title = '';
    this.composeModel.message = '';
    this.composeModel.specificRecipientUid = '';
    await this.refresh();
  }
}

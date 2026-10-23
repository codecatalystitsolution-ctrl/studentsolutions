import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Database } from '@angular/fire/database';
import { AdminNotificationsComponent } from './admin-notifications.component';
import { NotificationInboxService } from '../../../services/notification-inbox.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('AdminNotificationsComponent', () => {
  let component: AdminNotificationsComponent;
  let fixture: ComponentFixture<AdminNotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNotificationsComponent],
      providers: [
        { provide: Database, useValue: {} },
        {
          provide: NotificationInboxService,
          useValue: {
            notifyUser: vi.fn().mockResolvedValue(undefined)
          }
        },
        {
          provide: NotificationService,
          useValue: { show: vi.fn() }
        },
        {
          provide: CsvExportService,
          useValue: { exportToCsv: vi.fn().mockReturnValue(true) }
        },
        {
          provide: ConfirmService,
          useValue: { confirm: vi.fn().mockResolvedValue(true) }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNotificationsComponent);
    component = fixture.componentInstance;
  });

  it('creates the admin notifications component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('filters notification logs by title and type', () => {
    component.notificationLogs = [
      { id: 'n1', recipientUid: 'u1', type: 'quotation', title: 'Quotation Ready', message: 'Review quote #1', route: '/dashboard/my-orders', actorUid: 'a1', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', createdAt: 1000, isRead: false },
      { id: 'n2', recipientUid: 'u2', type: 'system', title: 'System Maintenance', message: 'Downtime tonight', route: '/dashboard/my-orders', actorUid: 'a1', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', createdAt: 2000, isRead: true }
    ];

    component.typeFilter = 'quotation';
    component.filterLogs();
    expect(component.filteredLogs.length).toBe(1);
    expect(component.filteredLogs[0].title).toBe('Quotation Ready');

    component.typeFilter = '';
    component.searchTerm = 'Maintenance';
    component.filterLogs();
    expect(component.filteredLogs.length).toBe(1);
    expect(component.filteredLogs[0].type).toBe('system');
  });

  it('paginates notification logs into pages of 15 records', () => {
    component.notificationLogs = Array.from({ length: 35 }, (_, i) => ({
      id: `n-${i}`,
      recipientUid: `uid-${i}`,
      type: 'system',
      title: `Notice ${i}`,
      message: `Body ${i}`,
      route: '/dashboard/my-orders',
      actorUid: 'admin-1',
      actorEmail: 'admin@filecrafters.in',
      actorRole: 'Admin',
      createdAt: 1000 + i,
      isRead: false
    }));

    component.filterLogs();
    expect(component.totalPages).toBe(3);
    expect(component.paginatedLogs.length).toBe(15);
    expect(component.paginatedLogs[0].id).toBe('n-0');

    component.nextPage();
    expect(component.currentPage).toBe(2);
    expect(component.paginatedLogs.length).toBe(15);
    expect(component.paginatedLogs[0].id).toBe('n-15');

    component.nextPage();
    expect(component.currentPage).toBe(3);
    expect(component.paginatedLogs.length).toBe(5);

    component.prevPage();
    expect(component.currentPage).toBe(2);
  });

  it('validates required fields before opening the preview modal', () => {
    component.composeModel.title = '';
    component.composeModel.message = '';
    component.openPreview();
    expect(component.showPreviewModal).toBe(false);

    component.composeModel.title = 'Announcement';
    component.composeModel.message = 'Service maintenance';
    component.openPreview();
    expect(component.showPreviewModal).toBe(true);

    component.closePreview();
    expect(component.showPreviewModal).toBe(false);
  });
});

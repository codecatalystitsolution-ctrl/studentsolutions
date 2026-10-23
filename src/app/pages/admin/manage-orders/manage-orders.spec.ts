import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { PrivateFileService } from '../../../services/private-file.service';
import { AuditTrailService } from '../../../services/audit-trail.service';
import { NotificationInboxService } from '../../../services/notification-inbox.service';
import { ManageOrdersComponent } from './manage-orders';

describe('ManageOrdersComponent', () => {
  let component: ManageOrdersComponent;
  let fixture: ComponentFixture<ManageOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageOrdersComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: PrivateFileService, useValue: { download: vi.fn(), downloadLegacyDataUrl: vi.fn() } },
        { provide: AuditTrailService, useValue: { recordAdmin: vi.fn() } },
        { provide: NotificationInboxService, useValue: { notifyUser: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageOrdersComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { SupportReplyService } from '../../../../services/support-reply.service';
import { NotificationService } from '../../../../shared/notification/notification.service';
import { TicketStatusComponent } from './ticket-status';

describe('TicketStatusComponent', () => {
  let component: TicketStatusComponent;
  let fixture: ComponentFixture<TicketStatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketStatusComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: SupportReplyService, useValue: { watchTicket: vi.fn(() => () => undefined) } },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketStatusComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

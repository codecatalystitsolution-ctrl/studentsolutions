import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { SupportReplyService } from '../../../services/support-reply.service';
import { ComplaintsComponent } from './complaints.component';

describe('ComplaintsComponent', () => {
  let component: ComplaintsComponent;
  let fixture: ComponentFixture<ComplaintsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplaintsComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: SupportReplyService, useValue: { watchTicket: vi.fn(() => () => undefined), addAdminReply: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComplaintsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

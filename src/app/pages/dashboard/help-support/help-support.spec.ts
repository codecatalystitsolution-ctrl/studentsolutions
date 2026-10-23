import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { NotificationService } from '../../../shared/notification/notification.service';
import { HelpSupportComponent } from './help-support';

describe('HelpSupportComponent', () => {
  let component: HelpSupportComponent;
  let fixture: ComponentFixture<HelpSupportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpSupportComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpSupportComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

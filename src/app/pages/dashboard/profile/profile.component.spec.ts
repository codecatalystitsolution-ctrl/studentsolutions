import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { NotificationService } from '../../../shared/notification/notification.service';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { NotificationService } from '../../../shared/notification/notification.service';
import { AdminDashboardComponent } from './admin-dashboard';

describe('AdminDashboardComponent', () => {
  let component: AdminDashboardComponent;
  let fixture: ComponentFixture<AdminDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('counts revenue only from manually verified payment ledger records', () => {
    expect(component.verifiedAmount({ status: 'verified', amount: 725 })).toBe(725);
    expect(component.verifiedAmount({ status: 'pending', amount: 725 })).toBe(0);
    expect(component.verifiedAmount({ paymentDetails: { status: 'verified' }, pricing: { totalAmount: 725 } })).toBe(0);
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AuthService } from '../../../services/auth.service';
import { AdminLayoutComponent } from './admin-layout';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: AuthService, useValue: { logout: vi.fn(async () => undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

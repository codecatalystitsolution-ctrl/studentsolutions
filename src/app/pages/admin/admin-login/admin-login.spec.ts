import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { AdminLoginComponent } from './admin-login';

describe('AdminLoginComponent', () => {
  let component: AdminLoginComponent;
  let fixture: ComponentFixture<AdminLoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLoginComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { QuizPlayerComponent } from './quiz-player.component';

describe('QuizPlayerComponent', () => {
  let component: QuizPlayerComponent;
  let fixture: ComponentFixture<QuizPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizPlayerComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: of({ time: 5 }) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizPlayerComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

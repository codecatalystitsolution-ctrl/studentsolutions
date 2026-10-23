import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { QuizzesComponent } from './quizzes.component';

describe('QuizzesComponent', () => {
  let component: QuizzesComponent;
  let fixture: ComponentFixture<QuizzesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuizzesComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(QuizzesComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

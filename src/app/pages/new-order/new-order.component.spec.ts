import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewOrderComponent } from './new-order.component';

describe('NewOrderComponent', () => {
  let component: NewOrderComponent;
  let fixture: ComponentFixture<NewOrderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewOrderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NewOrderComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

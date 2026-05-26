import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelpSupport } from './help-support';

describe('HelpSupport', () => {
  let component: HelpSupport;
  let fixture: ComponentFixture<HelpSupport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpSupport],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpSupport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

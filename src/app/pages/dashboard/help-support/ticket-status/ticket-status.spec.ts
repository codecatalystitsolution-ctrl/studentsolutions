import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TicketModal } from './ticket-status';

describe('TicketModal', () => {
  let component: TicketModal;
  let fixture: ComponentFixture<TicketModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TicketModal],
    }).compileComponents();

    fixture = TestBed.createComponent(TicketModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

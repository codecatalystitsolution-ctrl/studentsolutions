import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';

import { NewOrderComponent } from './new-order.component';

describe('NewOrderComponent', () => {
  let component: NewOrderComponent;
  let fixture: ComponentFixture<NewOrderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewOrderComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewOrderComponent);
    component = fixture.componentInstance;
    component.orderForm = component['fb'].group({
      fileType: ['assignment'],
      course: ['B.Tech'],
      subject: ['Math'],
      rollNumber: ['101'],
      submittedTo: ['Teacher'],
      submittedBy: ['Student'],
      topic: ['Test topic'],
      experimentDetails: [''],
      pageSlab: [100],
      bindingType: ['spiral'],
      specialInstructions: [''],
      uploadOwnFile: [true]
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply a ₹50 discount when a student uploads their own PDF', () => {
    component.updatePricingPreview();

    expect(component.selfUploadFeeDeduction).toBe(50);
    expect(component.totalEstimatedPrice).toBe(50);
  });
});

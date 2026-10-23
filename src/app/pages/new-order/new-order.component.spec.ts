import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { Storage } from '@angular/fire/storage';
import { NotificationService } from '../../shared/notification/notification.service';
import { ConfirmService } from '../../shared/confirmation/confirm.service';
import { NewOrderComponent } from './new-order.component';

describe('NewOrderComponent', () => {
  let component: NewOrderComponent;
  let fixture: ComponentFixture<NewOrderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewOrderComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: {} },
        { provide: Database, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: NotificationService, useValue: { show: vi.fn() } },
        { provide: ConfirmService, useValue: { confirm: vi.fn(async () => true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewOrderComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps validated PDF files as File objects instead of encoding them into RTDB data URLs', async () => {
    const pdf = new File(['%PDF-1.7\ncontent'], 'assignment.pdf', { type: 'application/pdf' });
    const input = { files: [pdf], value: '' } as unknown as HTMLInputElement;
    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.uploadedFiles).toHaveLength(1);
    expect(component.uploadedFiles[0].file).toBe(pdf);
    expect('uploadedFileDataUrl' in component).toBe(false);
  });

  it('rejects a PDF extension when the file signature is not a PDF', async () => {
    const fakePdf = new File(['not a PDF'], 'assignment.pdf', { type: 'application/pdf' });
    const input = { files: [fakePdf], value: '' } as unknown as HTMLInputElement;
    await component.onFileSelected({ target: input } as unknown as Event);

    expect(component.uploadedFiles).toHaveLength(0);
    expect(component.fileUploadError).toContain('not a valid PDF');
  });
});

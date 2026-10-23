import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicPreviewComponent } from './public-preview.component';
import { VisitorCounterService } from '../../services/visitor-counter.service';
import { ThemeService } from '../../services/theme.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('PublicPreviewComponent', () => {
  let component: PublicPreviewComponent;
  let fixture: ComponentFixture<PublicPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicPreviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: VisitorCounterService,
          useValue: {
            visitorCount: () => 1420,
            recordUniqueVisit: vi.fn().mockResolvedValue(true)
          }
        },
        {
          provide: ThemeService,
          useValue: {
            theme: () => 'dark',
            toggleTheme: vi.fn()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PublicPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the public preview component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('filters project portfolio by category', () => {
    expect(component.filteredProjects.length).toBe(6);
    component.filterCategory('web');
    expect(component.filteredProjects.length).toBe(2);
    expect(component.filteredProjects.every(p => p.category === 'web')).toBe(true);

    component.filterCategory('all');
    expect(component.filteredProjects.length).toBe(6);
  });

  it('opens and closes project details modal', () => {
    expect(component.selectedProject()).toBeNull();
    const sample = component.projects[0];
    component.openProjectDetails(sample);
    expect(component.selectedProject()).toBe(sample);

    component.closeProjectDetails();
    expect(component.selectedProject()).toBeNull();
  });

  it('toggles FAQ item expansion', () => {
    expect(component.activeFaq()).toBe(0);
    component.toggleFaq(1);
    expect(component.activeFaq()).toBe(1);
    component.toggleFaq(1);
    expect(component.activeFaq()).toBeNull();
  });
});

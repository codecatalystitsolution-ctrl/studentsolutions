import { Component, OnInit, OnDestroy, inject, signal, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SplashScreenService } from '../../services/splash-screen.service';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.scss']
})
export class SplashScreenComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  protected splashService = inject(SplashScreenService);

  @Input() standaloneMode = false;
  @Input() targetRoute = '/home';
  @Output() splashCompleted = new EventEmitter<void>();

  // Animation Timeline: Phases 1 to 8 (0.0s to 6.0s)
  phase = signal<number>(1);
  progress = signal<number>(0);
  isLightMode = signal<boolean>(false);
  isDissolving = signal<boolean>(false);

  private timelineTimer: any = null;
  private progressTimer: any = null;

  ngOnInit(): void {
    if (this.router.url.includes('/splash')) {
      this.standaloneMode = true;
    }
    this.startSplashSequence();
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  private clearAllTimers(): void {
    if (this.timelineTimer) clearTimeout(this.timelineTimer);
    if (this.progressTimer) clearInterval(this.progressTimer);
  }

  /**
   * Starts the 6.0-second storyboard animation sequence
   */
  startSplashSequence(): void {
    this.clearAllTimers();
    this.phase.set(1);
    this.progress.set(5);
    this.isLightMode.set(false);
    this.isDissolving.set(false);

    // Timeline Progression corresponding to user storyboard:
    // 0.0s - 0.8s: Phase 1 (Closed folder)
    this.timelineTimer = setTimeout(() => {
      // 0.8s - 1.6s: Phase 2 (Folder starts opening, cap & doc badge float, neon swirl)
      this.phase.set(2);
      this.progress.set(20);

      this.timelineTimer = setTimeout(() => {
        // 1.6s - 2.4s: Phase 3 (Sheets rise, cloud badge, multiple orbit rings)
        this.phase.set(3);
        this.progress.set(38);

        this.timelineTimer = setTimeout(() => {
          // 2.4s - 3.2s: Phase 4 (Burst of flying sheets, 'S' with cap logo emerges)
          this.phase.set(4);
          this.progress.set(55);

          this.timelineTimer = setTimeout(() => {
            // 3.2s - 4.0s: Phase 5 (Logo centers, "StudentSolutions" text appears)
            this.phase.set(5);
            this.progress.set(72);

            this.timelineTimer = setTimeout(() => {
              // 4.0s - 4.8s: Phase 6 (Pulsing neon ring, loading bar charges)
              this.phase.set(6);
              this.startChargingBar();

              this.timelineTimer = setTimeout(() => {
                // 4.8s - 5.6s: Phase 7 (Dynamic transition to clean light theme)
                this.phase.set(7);
                this.isLightMode.set(true);

                this.timelineTimer = setTimeout(() => {
                  // 5.6s - 6.0s: Phase 8 (Tagline "Your Academic Journey, Simplified")
                  this.phase.set(8);

                  this.timelineTimer = setTimeout(() => {
                    // 6.0s: Dissolve into website dashboard
                    this.completeSplash();
                  }, 700);
                }, 800);
              }, 800);
            }, 800);
          }, 800);
        }, 800);
      }, 800);
    }, 800);
  }

  private startChargingBar(): void {
    let current = 72;
    this.progressTimer = setInterval(() => {
      if (current < 100) {
        current += 7;
        this.progress.set(Math.min(current, 100));
      } else {
        if (this.progressTimer) clearInterval(this.progressTimer);
      }
    }, 60);
  }

  /**
   * Completes the animation and performs transition to target
   */
  completeSplash(): void {
    this.clearAllTimers();
    this.isDissolving.set(true);

    setTimeout(() => {
      this.splashCompleted.emit();
      this.splashService.completeSplash();

      if (this.standaloneMode || this.router.url === '/splash') {
        this.router.navigate([this.targetRoute]);
      }
    }, 450);
  }

  /**
   * Skip button action
   */
  skip(): void {
    this.completeSplash();
  }

  /**
   * Replay animation (available on /splash page)
   */
  replay(): void {
    this.startSplashSequence();
  }
}

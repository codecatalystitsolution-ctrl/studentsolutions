import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export type WelcomeStage = 'crafting' | 'inspecting' | 'completed';

export interface BookPage {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  leftContent: {
    heading: string;
    subheading?: string;
    items?: string[];
    diagramType?: 'seal' | 'certificate' | 'architecture' | 'materials';
    tags?: string[];
    specs?: { label: string; value: string }[];
  };
  rightContent: {
    heading: string;
    subheading?: string;
    codeSnippet?: string;
    tableOfContents?: { title: string; page: string }[];
    specs?: { label: string; value: string }[];
    deliverySteps?: { icon: string; title: string; desc: string }[];
  };
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, OnDestroy {
  private router = inject(Router);

  // Animation Stage Management
  stage = signal<WelcomeStage>('crafting');
  craftingStep = signal<number>(1); // 1: Paper stacking, 2: Laser print, 3: Binding clamp, 4: Hardcover wrap
  craftingProgress = signal<number>(15);

  // 3D Book State
  currentPageIndex = signal<number>(0);
  isAutoPlay = signal<boolean>(true);
  isBookOpen = signal<boolean>(false);
  isFlipping = signal<boolean>(false);
  pageFlipDirection = signal<'next' | 'prev'>('next');

  // Redirection Countdown
  countdownSeconds = signal<number>(5);
  isCountdownPaused = signal<boolean>(false);

  private craftingTimer: any = null;
  private autoPlayTimer: any = null;
  private redirectTimer: any = null;
  private flipTimer: any = null;

  // Pages Data representing the platform logic
  readonly pages: BookPage[] = [
    {
      id: 0,
      title: 'Cover & Affiliation',
      subtitle: 'Engineering Project Dossier',
      badge: 'IEEE STANDARD FORMAT',
      leftContent: {
        heading: 'NORTHBRIDGE INSTITUTE OF TECHNOLOGY',
        subheading: 'Department of Computer Science & Engineering',
        diagramType: 'seal',
        items: [
          'Affiliated with State Technical University',
          'Accredited by NBA & NAAC A+ Grade',
          'Academic Session: 2026 – 2027'
        ],
        tags: ['Final Year Major Project', 'B.Tech CSE', 'UGC/IEEE Guidelines']
      },
      rightContent: {
        heading: 'AI-POWERED ACADEMIC INTELLIGENCE & DOCUMENTATION PLATFORM',
        subheading: 'A Major Project Dissertation submitted in partial fulfillment for the award of Bachelor of Technology in Computer Science & Engineering',
        specs: [
          { label: 'Submitted By', value: 'Morgan Lee (Roll: 24001001)' },
          { label: 'Project Partner', value: 'Jamie Patel (Roll: 24001002)' },
          { label: 'Project Guide', value: 'Dr. A. K. Sharma (Prof. & HOD)' },
          { label: 'Platform Engine', value: 'Student Solutions Automated Solution' }
        ]
      }
    },
    {
      id: 1,
      title: 'Smart Formatting & Indexing',
      subtitle: 'Plagiarism & Standard Alignment',
      badge: 'VERIFIED 0% PLAGIARISM',
      leftContent: {
        heading: 'Certificate of Originality',
        subheading: 'Anti-Plagiarism & Turnitin Inspection Passed',
        diagramType: 'certificate',
        items: [
          'Similarity Index: 0% (Exclusive Content)',
          'Automated Margin Alignment: 1.5" Left, 1.0" Right',
          'Standard IEEE Font Hierarchy (Times New Roman / Calibri)'
        ]
      },
      rightContent: {
        heading: 'Table of Contents (Auto-Generated)',
        subheading: 'Synthesized with Exact Heading Hierarchy & Dot Leaders',
        tableOfContents: [
          { title: '1. Executive Summary & Problem Scope', page: '01' },
          { title: '2. Literature Survey & IEEE Standards', page: '08' },
          { title: '3. System Architecture & Entity Flow', page: '19' },
          { title: '4. Mathematical Modeling & Algorithms', page: '34' },
          { title: '5. Automated Testing & Viva Defense', page: '48' }
        ]
      }
    },
    {
      id: 2,
      title: 'Engineering Logic & Code Verification',
      subtitle: 'Verified Execution & System Blueprint',
      badge: '100% BUILD VERIFIED',
      leftContent: {
        heading: 'System Architecture Blueprint',
        subheading: 'Client-Side Security & Cloud Synchronization Flow',
        diagramType: 'architecture',
        items: [
          'Frontend: Angular 21 Reactive Standalone Architecture',
          'Database: Realtime DB with Granular Security RBAC',
          'File Storage: Private PDF Vault with Ownership Hashes',
          'Quality Control: Automated Pre-Flight PDF Inspection'
        ]
      },
      rightContent: {
        heading: 'Core Verification Engine',
        subheading: 'Deterministic Verification & Mathematical Integrity',
        codeSnippet: `// Student Solutions Automated Verification Engine
export function verifyAcademicReport(order: AcademicOrder): QAValidation {
  const isPlagiarismFree = runSimilarityCheck(order.fileBuffer) < 0.05;
  const marginCheck = inspectIEEEMargins(order.pdfDoc);
  const codeIntegrity = testCodeExecution(order.sourceRepo);

  return {
    isVivaReady: isPlagiarismFree && marginCheck && codeIntegrity,
    certifiedTimestamp: new Date().toISOString(),
    paperStandard: '80 GSM Royal Bond Sheet'
  };
}`
      }
    },
    {
      id: 3,
      title: 'Fabrication & Doorstep Delivery',
      subtitle: 'From Digital PDF to Handheld Masterpiece',
      badge: 'VIVA READY DELIVERY',
      leftContent: {
        heading: 'Material Specifications',
        subheading: 'Crafted with Industrial Grade Finishing',
        diagramType: 'materials',
        specs: [
          { label: 'Paper Quality', value: '80 GSM Ultra-White Bond' },
          { label: 'Print Engine', value: 'High-Res Laser Pigment (Waterproof)' },
          { label: 'Binding Style', value: 'Spiral Comb or Golden Embossed Hardcover' },
          { label: 'Corner Protection', value: 'Metallic Brass Gold Caps' }
        ]
      },
      rightContent: {
        heading: 'Direct-to-Campus Logistics',
        subheading: 'Carefully Packaged & Monitored in Real-Time',
        deliverySteps: [
          { icon: '🖨️', title: 'Precision Print', desc: 'Dual-sided color calibration with zero smudging.' },
          { icon: '✨', title: 'Hot Foil Emboss', desc: 'Title stamped in radiant gold or silver foil.' },
          { icon: '📦', title: 'Moisture-Proof Pack', desc: 'Multi-layer bubble wrap & tamper-proof box.' },
          { icon: '🚚', title: 'Campus Delivery', desc: 'Delivered directly to student hostels or campus gates.' }
        ]
      }
    }
  ];

  ngOnInit(): void {
    this.startCraftingSequence();
  }

  ngOnDestroy(): void {
    this.clearAllTimers();
  }

  private clearAllTimers(): void {
    if (this.craftingTimer) clearTimeout(this.craftingTimer);
    if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);
    if (this.redirectTimer) clearInterval(this.redirectTimer);
    if (this.flipTimer) clearTimeout(this.flipTimer);
  }

  // --- Step 1: Crafting Sequence ---
  private startCraftingSequence(): void {
    this.stage.set('crafting');
    this.craftingStep.set(1);
    this.craftingProgress.set(20);

    // Step 1: Laser Print Pass
    this.craftingTimer = setTimeout(() => {
      this.craftingStep.set(2);
      this.craftingProgress.set(50);

      // Step 2: Spine Alignment & Binding Clamp
      this.craftingTimer = setTimeout(() => {
        this.craftingStep.set(3);
        this.craftingProgress.set(80);

        // Step 3: Hardcover Wrap & Gold Seal
        this.craftingTimer = setTimeout(() => {
          this.craftingStep.set(4);
          this.craftingProgress.set(100);

          // Transition to Page Inspection
          this.craftingTimer = setTimeout(() => {
            this.transitionToBookInspection();
          }, 1400);
        }, 1200);
      }, 1200);
    }, 1200);
  }

  // --- Step 2: Book Inspection Sequence ---
  transitionToBookInspection(): void {
    this.clearAllTimers();
    this.stage.set('inspecting');
    this.isBookOpen.set(true);
    this.currentPageIndex.set(0);

    if (this.isAutoPlay()) {
      this.startAutoPlay();
    }
  }

  private startAutoPlay(): void {
    if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);

    this.autoPlayTimer = setInterval(() => {
      if (this.currentPageIndex() < this.pages.length - 1) {
        this.nextPage();
      } else {
        // Showcase finished, transition to completion
        this.finishShowcase();
      }
    }, 3800);
  }

  toggleAutoPlay(): void {
    const nextState = !this.isAutoPlay();
    this.isAutoPlay.set(nextState);
    if (nextState) {
      this.startAutoPlay();
    } else {
      if (this.autoPlayTimer) clearInterval(this.autoPlayTimer);
    }
  }

  nextPage(): void {
    if (this.currentPageIndex() < this.pages.length - 1) {
      this.triggerFlipEffect('next');
      this.currentPageIndex.update(idx => idx + 1);
    } else {
      this.finishShowcase();
    }
  }

  prevPage(): void {
    if (this.currentPageIndex() > 0) {
      this.triggerFlipEffect('prev');
      this.currentPageIndex.update(idx => idx - 1);
    }
  }

  goToPage(index: number): void {
    if (index >= 0 && index < this.pages.length) {
      if (index !== this.currentPageIndex()) {
        this.triggerFlipEffect(index > this.currentPageIndex() ? 'next' : 'prev');
      }
      this.currentPageIndex.set(index);
    }
  }

  private triggerFlipEffect(direction: 'next' | 'prev'): void {
    this.pageFlipDirection.set(direction);
    this.isFlipping.set(true);
    if (this.flipTimer) clearTimeout(this.flipTimer);
    this.flipTimer = setTimeout(() => {
      this.isFlipping.set(false);
    }, 500);
  }

  // --- Step 3: Finish & Redirection ---
  finishShowcase(): void {
    this.clearAllTimers();
    this.stage.set('completed');
    this.startRedirectCountdown();
  }

  private startRedirectCountdown(): void {
    this.countdownSeconds.set(5);
    this.redirectTimer = setInterval(() => {
      if (this.isCountdownPaused()) return;

      this.countdownSeconds.update(sec => {
        if (sec <= 1) {
          this.proceedToPlatform();
          return 0;
        }
        return sec - 1;
      });
    }, 1000);
  }

  toggleCountdownPause(): void {
    this.isCountdownPaused.update(val => !val);
  }

  replayAnimation(): void {
    this.clearAllTimers();
    this.isCountdownPaused.set(false);
    this.startCraftingSequence();
  }

  proceedToPlatform(targetRoute: string = '/'): void {
    this.clearAllTimers();
    this.router.navigate([targetRoute]);
  }

  skipToOrder(): void {
    this.clearAllTimers();
    this.router.navigate(['/new-order']);
  }
}

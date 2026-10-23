import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../services/theme.service';
import { VisitorCounterService } from '../../services/visitor-counter.service';

export interface SampleProject {
  id: string;
  title: string;
  category: 'web' | 'mobile' | 'ai' | 'design' | 'doc';
  categoryLabel: string;
  level: string;
  description: string;
  technologies: string[];
  deliverables: string[];
  architectureOverview: string;
  vivaTopics: string[];
}

@Component({
  selector: 'app-public-preview',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './public-preview.component.html',
  styleUrls: ['./public-preview.component.scss']
})
export class PublicPreviewComponent implements OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly visitorCounter = inject(VisitorCounterService);

  readonly isMobileMenuOpen = signal<boolean>(false);
  readonly selectedCategory = signal<string>('all');
  readonly selectedProject = signal<SampleProject | null>(null);
  readonly activeFaq = signal<number | null>(0);
  readonly contactSuccess = signal<boolean>(false);

  // Form model
  contactForm = {
    name: '',
    email: '',
    college: '',
    service: 'University Project',
    message: ''
  };

  // Unique visitor counter from service
  readonly visitorCount = this.visitorCounter.visitorCount;

  // Project Portfolio Samples
  readonly projects: SampleProject[] = [
    {
      id: 'p1',
      title: 'HealthSync - AI-Assisted Clinical EHR & Telemedicine System',
      category: 'web',
      categoryLabel: 'Web & Cloud',
      level: 'B.Tech / MCA Final Year',
      description: 'End-to-end medical records system with encrypted patient records, doctor scheduling, and symptom-based triage assistant.',
      technologies: ['Angular 21', 'Node.js', 'PostgreSQL', 'WebRTC', 'Docker'],
      deliverables: ['Full Source Code & Database Script', 'IEEE Format Project Report (60+ pages)', 'UML & ER Diagrams', 'Viva Q&A Notes', 'PPT Presentation'],
      architectureOverview: 'Three-tier architecture with JWT-based role separation, RESTful microservices, and WebSockets for real-time consultation triage.',
      vivaTopics: ['Role-based authorization', 'Database normalization', 'State management', 'REST vs WebSockets']
    },
    {
      id: 'p2',
      title: 'CampusCart - Smart University Canteen & Pre-Order Hub',
      category: 'mobile',
      categoryLabel: 'Mobile Apps',
      level: 'BCA / B.Tech Major Project',
      description: 'Cross-platform mobile application allowing university students to browse cafeteria menus, pre-order meals, and avoid meal-time queues.',
      technologies: ['Flutter', 'Firebase Auth', 'Cloud Firestore', 'Razorpay Test Sandbox'],
      deliverables: ['Android APK & Flutter Source Code', 'System Requirement Specification (SRS)', 'Data Flow Diagrams (Level 0, 1, 2)', 'Project Synopsis'],
      architectureOverview: 'Mobile client communicating with real-time Firebase services, integrated with an admin management console for canteen inventory.',
      vivaTopics: ['Stateful vs Stateless widgets', 'Real-time database sync', 'Tokenized payment integration']
    },
    {
      id: 'p3',
      title: 'AutoGrade - Intelligent Code Plagiarism & Assessment Engine',
      category: 'ai',
      categoryLabel: 'AI & Machine Learning',
      level: 'M.Tech / B.Tech Capstone',
      description: 'Automated evaluation platform executing student code in isolated sandbox containers and measuring AST-based structural similarity.',
      technologies: ['Python 3.11', 'FastAPI', 'CodeBERT NLP', 'Docker Sandboxing', 'SQLite'],
      deliverables: ['Full Python Backend Code', 'Model Evaluation & Benchmark Notebook', 'IEEE Research Paper Format Report', 'Viva Preparation Deck'],
      architectureOverview: 'FastAPI orchestrator dispatching code executions into isolated Docker containers with memory and CPU limiters for safe student grading.',
      vivaTopics: ['AST parsing vs text diffing', 'Container security & isolation', 'Vector embeddings with CodeBERT']
    },
    {
      id: 'p4',
      title: 'EduSphere - Virtual Classroom with Interactive Collaborative Board',
      category: 'web',
      categoryLabel: 'Web & Cloud',
      level: 'B.Tech / MCA Project',
      description: 'Modern distance learning platform with multi-user SVG whiteboard, screen sharing, attendance logger, and automated quiz manager.',
      technologies: ['React 18', 'Node.js', 'Socket.IO', 'Express', 'MongoDB'],
      deliverables: ['Source Code (Client & Server)', 'Complete Software Documentation', 'Hardware & Software Sizing Guide', 'Viva FAQ Deck'],
      architectureOverview: 'Event-driven real-time canvas coordination using Socket.IO rooms with optimistic UI updates and server-side canvas state persistence.',
      vivaTopics: ['Event-driven architecture', 'WebSocket connection pooling', 'Optimistic rendering']
    },
    {
      id: 'p5',
      title: 'FinTrack - Micro-Finance Ledger & Credit Risk Analyzer',
      category: 'design',
      categoryLabel: 'UI/UX Design',
      level: 'Design & B.Sc CS',
      description: 'High-fidelity Figma design system and interactive prototype for micro-lending agencies, featuring accessibility-first data tables and loan calculators.',
      technologies: ['Figma Pro', 'WCAG 2.1 AA', 'Tailwind Design Tokens', 'Interactive Component Sets'],
      deliverables: ['Interactive Figma File with Component Library', 'UI Style Guide & Design Token Matrix', 'User Journey Maps', 'Usability Evaluation Report'],
      architectureOverview: 'Atomic design hierarchy with customizable light/dark color variables, 8pt spatial grid, and WCAG AA contrast compliance.',
      vivaTopics: ['Design systems & tokenization', 'Accessibility compliance', 'Information architecture for finance']
    },
    {
      id: 'p6',
      title: 'Autonomous Drone Navigation Using Computer Vision & Pathfinding',
      category: 'doc',
      categoryLabel: 'Academic Documentation',
      level: 'M.Tech / B.Tech Research',
      description: 'Comprehensive 85-page thesis and IEEE journal-ready documentation analyzing A* search versus reinforcement learning for indoor drone obstacle avoidance.',
      technologies: ['LaTeX', 'Overleaf', 'IEEE Standard Format', 'Matplotlib Analysis'],
      deliverables: ['Complete LaTeX Source & Compiled PDF', 'Plagiarism Scan Certification', 'Experimental Results & High-Res Charts', 'Full Bibliography BibTeX'],
      architectureOverview: 'Rigorous comparative study with mathematical proofs, algorithm benchmarks, simulated trajectory datasets, and formal conclusion.',
      vivaTopics: ['A* heuristic optimality', 'Reinforcement learning convergence', 'Academic citation standards']
    }
  ];

  // FAQs
  readonly faqs = [
    {
      question: 'How do I place an order for an academic project or practical file?',
      answer: 'Simply click "Get Started" to create a free student account. From your student dashboard, navigate to "New Order", select your project type (Major Project, Minor Project, Practical File, or Documentation), enter your requirements or upload your problem statement, and submit. You will receive a transparent quotation to review and approve.'
    },
    {
      question: 'What deliverables are included with a project package?',
      answer: 'All projects include fully functional source code, an IEEE or university-standard formatted project report (SRS, Architecture diagrams, Test cases, Conclusion), powerpoint presentation slides (PPT), setup and installation instructions, and a curated viva question-and-answer preparation guide.'
    },
    {
      question: 'Can I get physical spiral or hardcover printed copies delivered to my campus or home?',
      answer: 'Yes! FileCrafters provides an integrated print and doorstep delivery service. You can choose glossy photo-paper color printing, black & white printing, standard spiral binding, or formal university-embossed hardcover binding with golden foil stamping.'
    },
    {
      question: 'Is my student identity and code submission kept confidential?',
      answer: 'Absolutely. We operate under strict privacy standards. Your personal information, academic institution, and project source code are strictly private and never shared, published, or re-sold. Deliverables are stored securely under authorized access controls.'
    },
    {
      question: 'Do you offer assistance with software installation and viva preparation?',
      answer: 'Yes. Every project includes step-by-step setup documentation. If you need assistance running the project on your laptop, our technical mentors can guide you through environment configuration, database seeding, and execution, along with a mock viva walkthrough.'
    },
    {
      question: 'What if my professor or department requests modifications?',
      answer: 'All standard orders include support for minor revisions, formatting updates, and faculty review feedback to ensure your project meets your institution’s requirements.'
    }
  ];

  ngOnInit(): void {
    // Record unique visit per 24-hour counting policy
    void this.visitorCounter.recordUniqueVisit();
  }

  get currentTheme(): string {
    return this.themeService.theme();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }

  filterCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  get filteredProjects(): SampleProject[] {
    const cat = this.selectedCategory();
    if (cat === 'all') return this.projects;
    return this.projects.filter(p => p.category === cat);
  }

  openProjectDetails(project: SampleProject): void {
    this.selectedProject.set(project);
  }

  closeProjectDetails(): void {
    this.selectedProject.set(null);
  }

  toggleFaq(index: number): void {
    if (this.activeFaq() === index) {
      this.activeFaq.set(null);
    } else {
      this.activeFaq.set(index);
    }
  }

  submitContactForm(): void {
    if (!this.contactForm.name || !this.contactForm.email || !this.contactForm.message) return;
    this.contactSuccess.set(true);
    setTimeout(() => {
      this.contactSuccess.set(false);
      this.contactForm = {
        name: '',
        email: '',
        college: '',
        service: 'University Project',
        message: ''
      };
    }, 4000);
  }

  scrollToSection(sectionId: string): void {
    this.closeMobileMenu();
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

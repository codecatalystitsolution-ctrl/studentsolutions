import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: string;
}

@Component({
  selector: 'app-quiz-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quiz-player.component.html',
  styleUrls: ['./quiz-player.component.scss']
})
export class QuizPlayerComponent implements OnInit, OnDestroy {
  // Dummy Questions (Baad mein ye ID ke base par database se aayenge)
  questions: Question[] = [
    { id: 1, text: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], correctAnswer: "New Delhi" },
    { id: 2, text: "Which planet is known as the Red Planet?", options: ["Earth", "Mars", "Jupiter", "Venus"], correctAnswer: "Mars" },
    { id: 3, text: "Who wrote the national anthem of India?", options: ["Rabindranath Tagore", "Bankim Chandra Chatterjee", "Mahatma Gandhi", "Subhas Chandra Bose"], correctAnswer: "Rabindranath Tagore" },
    { id: 4, text: "What is the largest ocean on Earth?", options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"], correctAnswer: "Pacific Ocean" },
    { id: 5, text: "What is the square root of 144?", options: ["10", "12", "14", "16"], correctAnswer: "12" }
  ];

  currentQuestionIndex: number = 0;
  userAnswers: { [key: number]: string } = {}; // Store selected options
  
  // Timer variables
  timeLeftSeconds: number = 0; // Isko ab 0 rakhein, default 300 hata dein
  timerInterval: any;
  
  // Result variables
  isSubmitted: boolean = false;
  score: number = 0;

  constructor(
    private router: Router, 
    private route: ActivatedRoute,
  private cdr: ChangeDetectorRef
) {}

  ngOnInit(): void {
    // Quiz ID aur time query params se le rahe hain
    this.route.queryParams.subscribe((params: any) => {
      const timeInMins = params['time'];
      
      if (timeInMins) {
        this.timeLeftSeconds = timeInMins * 60; 
      } else {
        this.timeLeftSeconds = 5 * 60; 
      }
      
      this.startTimer();
    });      
  }

  ngOnDestroy(): void {
    this.clearTimer(); // Component close hone par timer rok do
  }

  // --- Timer Logic ---
 startTimer() {
  this.timerInterval = setInterval(() => {
    if (this.timeLeftSeconds > 0) {
      this.timeLeftSeconds--;
      
      // Ye line Angular ko force karegi ki wo har second UI ko update kare
      this.cdr.detectChanges(); 
      
    } else {
      this.submitQuiz(); // Time up hone par auto-submit
    }
  }, 1000);
}

  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  get formattedTime(): string {
    const minutes: number = Math.floor(this.timeLeftSeconds / 60);
    const seconds: number = this.timeLeftSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  // --- Quiz Interactions ---
  selectOption(option: string) {
    if (this.isSubmitted) return;
    this.userAnswers[this.currentQuestionIndex] = option;
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
    }
  }

  prevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
    }
  }

  submitQuiz() {
    this.clearTimer();
    this.isSubmitted = true;
    
    // Calculate Score
    this.score = 0;
    this.questions.forEach((q, index) => {
      if (this.userAnswers[index] === q.correctAnswer) {
        this.score++;
      }
    });
  }

  goBackToQuizzes() {
    this.router.navigate(['/dashboard/quizzes']);
  }
}
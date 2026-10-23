import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

interface Quiz {
  id: string;
  title: string;
  subject: string;
  questionsCount: number;
  durationMins: number;
  level: 'Easy' | 'Medium' | 'Hard';
}

@Component({
  selector: 'app-quizzes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quizzes.component.html',
  styleUrls: ['./quizzes.component.scss']
})
export class QuizzesComponent implements OnInit {
  categories = ['All', 'Mathematics', 'General Knowledge', 'Reasoning', 'English'];
  selectedCategory = 'All';
  learningMode: 'quiz' | 'mock' | 'papers' = 'quiz';
  allQuizzes: Quiz[] = [
    { id: 'q1', title: 'Algebra Fundamentals', subject: 'Mathematics', questionsCount: 15, durationMins: 20, level: 'Easy' },
    { id: 'q2', title: 'Indian History & Politics', subject: 'General Knowledge', questionsCount: 25, durationMins: 30, level: 'Medium' },
    { id: 'q3', title: 'Logical Reasoning Test 1', subject: 'Reasoning', questionsCount: 20, durationMins: 25, level: 'Hard' },
    { id: 'q4', title: 'Basic Grammar & Vocabulary', subject: 'English', questionsCount: 30, durationMins: 25, level: 'Easy' },
    { id: 'q5', title: 'Calculus Advanced', subject: 'Mathematics', questionsCount: 10, durationMins: 30, level: 'Hard' },
    { id: 'q6', title: 'Current Affairs (May 2026)', subject: 'General Knowledge', questionsCount: 20, durationMins: 15, level: 'Medium' },
  ];
  filteredQuizzes: Quiz[] = [];

  constructor(private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const mode = params.get('mode');
      this.learningMode = mode === 'mock' || mode === 'papers' ? mode : 'quiz';
      this.filterQuizzes(this.selectedCategory);
    });
  }

  filterQuizzes(category: string): void {
    this.selectedCategory = category;
    if (this.learningMode === 'papers') {
      this.filteredQuizzes = [];
    } else if (category === 'All') {
      this.filteredQuizzes = this.allQuizzes;
    } else {
      this.filteredQuizzes = this.allQuizzes.filter(quiz => quiz.subject === category);
    }
  }

  startQuiz(quizId: string, durationMins: number): void {
    this.router.navigate(['/dashboard/quiz-player'], { queryParams: { id: quizId, time: durationMins } });
  }
}

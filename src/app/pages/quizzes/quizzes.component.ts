import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// Quiz ka structure define kar rahe hain
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
  // Categories filter karne ke liye
  categories: string[] = ['All', 'Mathematics', 'General Knowledge', 'Reasoning', 'English'];
  selectedCategory: string = 'All';

  // Dummy Quiz Data (Baad me Firebase se aayega)
  allQuizzes: Quiz[] = [
    { id: 'q1', title: 'Algebra Fundamentals', subject: 'Mathematics', questionsCount: 15, durationMins: 20, level: 'Easy' },
    { id: 'q2', title: 'Indian History & Politics', subject: 'General Knowledge', questionsCount: 25, durationMins: 30, level: 'Medium' },
    { id: 'q3', title: 'Logical Reasoning Test 1', subject: 'Reasoning', questionsCount: 20, durationMins: 25, level: 'Hard' },
    { id: 'q4', title: 'Basic Grammar & Vocabulary', subject: 'English', questionsCount: 30, durationMins: 25, level: 'Easy' },
    { id: 'q5', title: 'Calculus Advance', subject: 'Mathematics', questionsCount: 10, durationMins: 30, level: 'Hard' },
    { id: 'q6', title: 'Current Affairs (May 2026)', subject: 'General Knowledge', questionsCount: 20, durationMins: 15, level: 'Medium' },
  ];

  filteredQuizzes: Quiz[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.filterQuizzes('All');
  }

  // Category filter karne ka function
  filterQuizzes(category: string) {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredQuizzes = this.allQuizzes;
    } else {
      this.filteredQuizzes = this.allQuizzes.filter(q => q.subject === category);
    }
  }

  // quizzes.component.ts ke andar
startQuiz(quizId: string, durationMins: number) {
  // id aur duration dono URL ke sath quiz-player par bhejenge
  this.router.navigate(['/dashboard/quiz-player'], { 
    queryParams: { 
      id: quizId, 
      time: durationMins // Time minute mein bhej rahe hain
    } 
  });
}
}
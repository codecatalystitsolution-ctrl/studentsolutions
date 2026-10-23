import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Database, ref, onValue, update, get } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './student-management.html',
  styleUrls: ['./student-management.scss']
})
export class StudentManagementComponent implements OnInit {
  private db = inject(Database);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private csvExportService = inject(CsvExportService);

  students: any[] = [];
  filteredStudents: any[] = [];
  searchTerm: string = '';
  isLoading = true;
  isRefreshing = false;

  totalStudents = 0;
  activeStudents = 0;
  suspendedStudents = 0;

  // Pagination (Default: 15 per page)
  currentPage = 1;
  readonly pageSize = 15;

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    const usersRef = ref(this.db, 'users');
    onValue(usersRef, snapshot => {
      const users = snapshot.val();
      this.processUsers(users);
      this.isLoading = false;
      this.isRefreshing = false;
    });
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'users'));
      this.processUsers(snapshot.val());
      this.notificationService.show('success', 'Student roster refreshed successfully.', 'Refreshed');
    } catch (err) {
      console.error('Failed to refresh students:', err);
      this.notificationService.show('error', 'Could not refresh student roster.', 'Error');
    } finally {
      this.isRefreshing = false;
    }
  }

  private processUsers(users: any): void {
    this.students = [];
    this.totalStudents = 0;
    this.activeStudents = 0;
    this.suspendedStudents = 0;

    if (users) {
      Object.keys(users).forEach(uid => {
        const user = users[uid];
        if (user.role?.toLowerCase() === 'student') {
          this.totalStudents += 1;
          if (user.status === 'suspended') {
            this.suspendedStudents += 1;
          } else {
            this.activeStudents += 1;
          }
          this.students.push({ uid, ...user });
        }
      });
    }

    this.students.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    this.filterStudents();
  }

  filterStudents() {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      this.filteredStudents = [...this.students];
    } else {
      this.filteredStudents = this.students.filter(student => {
        const email = (student.email || '').toLowerCase();
        const name = (student.fullName || '').toLowerCase();
        const college = (student.collegeName || '').toLowerCase();
        const studentId = (student.studentID || '').toLowerCase();
        const status = (student.status || '').toLowerCase();
        return (
          email.includes(query) ||
          name.includes(query) ||
          college.includes(query) ||
          studentId.includes(query) ||
          status.includes(query)
        );
      });
    }
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
  }

  get paginatedStudents(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredStudents.slice(start, start + this.pageSize);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  exportCsv(): void {
    const today = new Date().toISOString().slice(0, 10);
    const columns = [
      { key: 'studentID', label: 'Student ID', format: (id: string) => id || 'N/A' },
      { key: 'fullName', label: 'Full Name', format: (name: string) => name || 'N/A' },
      { key: 'email', label: 'Email Address' },
      { key: 'phone', label: 'Phone', format: (p: string) => p || 'N/A' },
      { key: 'collegeName', label: 'Institution', format: (c: string) => c || 'N/A' },
      { key: 'courseName', label: 'Course', format: (c: string) => c || 'N/A' },
      { key: 'status', label: 'Account Status', format: (s: string) => s || 'active' },
      { key: 'createdAt', label: 'Registration Date', format: (d: string) => (d ? new Date(d).toLocaleDateString() : '') }
    ];

    const success = this.csvExportService.exportToCsv(`students_${today}.csv`, columns, this.filteredStudents);
    if (success) {
      this.notificationService.show('success', `Exported ${this.filteredStudents.length} students to CSV.`, 'CSV Export');
    }
  }

  async toggleStudentStatus(student: any) {
    const newStatus = student.status === 'suspended' ? 'active' : 'suspended';

    const confirmed = await this.confirmService.confirm({
      title: newStatus === 'suspended' ? 'Suspend Account' : 'Activate Account',
      message: `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this account?`,
      confirmText: newStatus === 'suspended' ? 'Suspend' : 'Activate',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      const studentRef = ref(this.db, `users/${student.uid}`);
      await update(studentRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      this.notificationService.show(
        'success',
        `Account ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully.`,
        'Success'
      );
    } catch (error) {
      console.error('Failed to update status', error);
      this.notificationService.show('error', 'Unable to change student status. Please try again.', 'Update Failed');
    }
  }

  statusBadgeClass(status: string) {
    return status === 'suspended' ? 'badge-suspended' : 'badge-active';
  }
}

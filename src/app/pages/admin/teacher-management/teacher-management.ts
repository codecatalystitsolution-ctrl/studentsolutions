import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Database, ref, onValue, update, get } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';

@Component({
  selector: 'app-teacher-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './teacher-management.html',
  styleUrls: ['./teacher-management.scss']
})
export class TeacherManagementComponent implements OnInit {
  private db = inject(Database);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private csvExportService = inject(CsvExportService);

  teachers: any[] = [];
  filteredTeachers: any[] = [];
  searchTerm: string = '';
  isLoading = true;
  isRefreshing = false;

  totalTeachers = 0;
  activeTeachers = 0;
  suspendedTeachers = 0;

  // Pagination (Default: 15 per page)
  currentPage = 1;
  readonly pageSize = 15;

  ngOnInit() {
    this.loadTeachers();
  }

  loadTeachers() {
    const usersRef = ref(this.db, 'users');
    onValue(usersRef, snapshot => {
      const users = snapshot.val();
      this.processTeachers(users);
      this.isLoading = false;
      this.isRefreshing = false;
    });
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'users'));
      this.processTeachers(snapshot.val());
      this.notificationService.show('success', 'Teacher roster refreshed.', 'Refreshed');
    } catch (err) {
      console.error('Failed to refresh teachers:', err);
      this.notificationService.show('error', 'Could not refresh teacher roster.', 'Error');
    } finally {
      this.isRefreshing = false;
    }
  }

  private processTeachers(users: any): void {
    this.teachers = [];
    this.totalTeachers = 0;
    this.activeTeachers = 0;
    this.suspendedTeachers = 0;

    if (users) {
      Object.keys(users).forEach(uid => {
        const user = users[uid];
        if (user.role?.toLowerCase() === 'teacher') {
          this.totalTeachers += 1;
          if (user.status === 'suspended') {
            this.suspendedTeachers += 1;
          } else {
            this.activeTeachers += 1;
          }
          this.teachers.push({ uid, ...user });
        }
      });
    }

    this.teachers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    this.filterTeachers();
  }

  filterTeachers() {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      this.filteredTeachers = [...this.teachers];
    } else {
      this.filteredTeachers = this.teachers.filter(teacher => {
        const email = (teacher.email || '').toLowerCase();
        const name = (teacher.fullName || '').toLowerCase();
        const college = (teacher.collegeName || '').toLowerCase();
        const department = (teacher.department || '').toLowerCase();
        const employeeID = (teacher.employeeID || '').toLowerCase();
        const phone = (teacher.phone || '').toLowerCase();
        const status = (teacher.status || '').toLowerCase();
        return (
          email.includes(query) ||
          name.includes(query) ||
          college.includes(query) ||
          employeeID.includes(query) ||
          status.includes(query) ||
          department.includes(query) ||
          phone.includes(query)
        );
      });
    }
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTeachers.length / this.pageSize));
  }

  get paginatedTeachers(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredTeachers.slice(start, start + this.pageSize);
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
      { key: 'fullName', label: 'Faculty Name', format: (n: string) => n || 'N/A' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone', format: (p: string) => p || 'N/A' },
      { key: 'collegeName', label: 'Institution', format: (c: string) => c || 'N/A' },
      { key: 'department', label: 'Department', format: (d: string) => d || 'N/A' },
      { key: 'status', label: 'Account Status', format: (s: string) => s || 'active' },
      { key: 'createdAt', label: 'Registration Date', format: (d: string) => (d ? new Date(d).toLocaleDateString() : '') }
    ];

    const success = this.csvExportService.exportToCsv(`teachers_${today}.csv`, columns, this.filteredTeachers);
    if (success) {
      this.notificationService.show('success', `Exported ${this.filteredTeachers.length} teachers to CSV.`, 'CSV Export');
    }
  }

  async toggleTeacherStatus(teacher: any) {
    const newStatus = teacher.status === 'suspended' ? 'active' : 'suspended';

    const confirmed = await this.confirmService.confirm({
      title: newStatus === 'suspended' ? 'Suspend Account' : 'Activate Account',
      message: `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this account?`,
      confirmText: newStatus === 'suspended' ? 'Suspend' : 'Activate',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      const teacherRef = ref(this.db, `users/${teacher.uid}`);
      await update(teacherRef, {
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
      this.notificationService.show('error', 'Unable to change teacher status. Please try again.', 'Update Failed');
    }
  }

  statusBadgeClass(status: string) {
    return status === 'suspended' ? 'badge-suspended' : 'badge-active';
  }
}

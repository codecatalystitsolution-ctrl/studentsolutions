import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, onValue, update } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';

@Component({
  selector: 'app-student-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './student-management.html',
  styleUrls: ['./student-management.scss']
})
export class StudentManagementComponent implements OnInit {
  private db = inject(Database);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);

  students: any[] = [];
  filteredStudents: any[] = [];
  searchTerm: string = '';
  isLoading = true;

  totalStudents = 0;
  activeStudents = 0;
  suspendedStudents = 0;

  ngOnInit() {
    this.loadStudents();
  }

  loadStudents() {
    const usersRef = ref(this.db, 'users');
    onValue(usersRef, (snapshot) => {
      const users = snapshot.val();
      this.students = [];
      this.totalStudents = 0;
      this.activeStudents = 0;
      this.suspendedStudents = 0;

      if (users) {
        Object.keys(users).forEach((uid) => {
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
      this.filteredStudents = [...this.students];
      this.isLoading = false;
    });
  }

  filterStudents() {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      this.filteredStudents = [...this.students];
      return;
    }

    this.filteredStudents = this.students.filter((student) => {
      const email = (student.email || '').toLowerCase();
      const name = (student.fullName || '').toLowerCase();
      const college = (student.collegeName || '').toLowerCase();
      const studentId = (student.studentID || '').toLowerCase();
      const status = (student.status || '').toLowerCase();
      return email.includes(query) || name.includes(query) || college.includes(query) || studentId.includes(query) || status.includes(query);
    });
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
      this.notificationService.show('success', `Account ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully.`, 'Success');
    } catch (error) {
      console.error('Failed to update status', error);
      this.notificationService.show('error', 'Unable to change student status. Please try again.', 'Update Failed');
    }
  }

  statusBadgeClass(status: string) {
    return status === 'suspended' ? 'badge-suspended' : 'badge-active';
  }
}

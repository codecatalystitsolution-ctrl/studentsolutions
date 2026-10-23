import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Database, ref, onValue, update, get } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { CsvExportService } from '../../../services/csv-export.service';

@Component({
  selector: 'app-delivery-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './delivery-management.html',
  styleUrls: ['./delivery-management.scss']
})
export class DeliveryManagementComponent implements OnInit {
  private db = inject(Database);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private csvExportService = inject(CsvExportService);

  deliveryStaff: any[] = [];
  filteredDelivery: any[] = [];
  searchTerm: string = '';
  isLoading = true;
  isRefreshing = false;

  totalDelivery = 0;
  activeDelivery = 0;
  suspendedDelivery = 0;

  // Pagination (Default: 15 per page)
  currentPage = 1;
  readonly pageSize = 15;

  ngOnInit() {
    this.loadDeliveryStaff();
  }

  loadDeliveryStaff() {
    const usersRef = ref(this.db, 'users');
    onValue(usersRef, snapshot => {
      const users = snapshot.val();
      this.processDeliveryStaff(users);
      this.isLoading = false;
      this.isRefreshing = false;
    });
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'users'));
      this.processDeliveryStaff(snapshot.val());
      this.notificationService.show('success', 'Delivery roster refreshed.', 'Refreshed');
    } catch (err) {
      console.error('Failed to refresh delivery staff:', err);
      this.notificationService.show('error', 'Could not refresh delivery roster.', 'Error');
    } finally {
      this.isRefreshing = false;
    }
  }

  private processDeliveryStaff(users: any): void {
    this.deliveryStaff = [];
    this.totalDelivery = 0;
    this.activeDelivery = 0;
    this.suspendedDelivery = 0;

    if (users) {
      Object.keys(users).forEach(uid => {
        const user = users[uid];
        const role = user.role?.toLowerCase();
        if (role === 'delivery' || role === 'deliveryboy' || role === 'delivery-boy') {
          this.totalDelivery += 1;
          if (user.status === 'suspended') {
            this.suspendedDelivery += 1;
          } else {
            this.activeDelivery += 1;
          }
          this.deliveryStaff.push({ uid, ...user });
        }
      });
    }

    this.deliveryStaff.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    this.filterDelivery();
  }

  filterDelivery() {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      this.filteredDelivery = [...this.deliveryStaff];
    } else {
      this.filteredDelivery = this.deliveryStaff.filter(d => {
        const email = (d.email || '').toLowerCase();
        const name = (d.fullName || '').toLowerCase();
        const vehicle = (d.vehicleNumber || '').toLowerCase();
        const delId = (d.deliveryID || '').toLowerCase();
        const status = (d.status || '').toLowerCase();
        const area = (d.serviceArea || d.address || '').toLowerCase();
        return (
          email.includes(query) ||
          name.includes(query) ||
          vehicle.includes(query) ||
          delId.includes(query) ||
          status.includes(query) ||
          area.includes(query)
        );
      });
    }
    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredDelivery.length / this.pageSize));
  }

  get paginatedDelivery(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredDelivery.slice(start, start + this.pageSize);
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
      { key: 'deliveryID', label: 'Delivery ID', format: (id: string) => id || 'N/A' },
      { key: 'fullName', label: 'Staff Name', format: (n: string) => n || 'N/A' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone', format: (p: string) => p || 'N/A' },
      { key: 'serviceArea', label: 'Service Area', format: (a: string, row: any) => a || row.address || 'N/A' },
      { key: 'vehicleNumber', label: 'Vehicle Number', format: (v: string) => v || 'N/A' },
      { key: 'status', label: 'Account Status', format: (s: string) => s || 'active' },
      { key: 'createdAt', label: 'Onboarding Date', format: (d: string) => (d ? new Date(d).toLocaleDateString() : '') }
    ];

    const success = this.csvExportService.exportToCsv(`delivery_${today}.csv`, columns, this.filteredDelivery);
    if (success) {
      this.notificationService.show('success', `Exported ${this.filteredDelivery.length} delivery staff records to CSV.`, 'CSV Export');
    }
  }

  async toggleDeliveryStatus(delivery: any) {
    const newStatus = delivery.status === 'suspended' ? 'active' : 'suspended';

    const confirmed = await this.confirmService.confirm({
      title: newStatus === 'suspended' ? 'Suspend Account' : 'Activate Account',
      message: `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'activate'} this account?`,
      confirmText: newStatus === 'suspended' ? 'Suspend' : 'Activate',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      const refNode = ref(this.db, `users/${delivery.uid}`);
      await update(refNode, {
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
      this.notificationService.show('error', 'Unable to change delivery account status. Please try again.', 'Update Failed');
    }
  }

  statusBadgeClass(status: string) {
    return status === 'suspended' ? 'badge-suspended' : 'badge-active';
  }
}

import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Database, ref, onValue, update, remove, get } from '@angular/fire/database';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { PrivateFileService } from '../../../services/private-file.service';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuditTrailService } from '../../../services/audit-trail.service';
import { NotificationInboxService } from '../../../services/notification-inbox.service';
import { CsvExportService } from '../../../services/csv-export.service';

@Component({
  selector: 'app-manage-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manage-orders.html',
  styleUrls: ['./manage-orders.scss']
})
export class ManageOrdersComponent implements OnInit {
  private db = inject(Database);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);
  private privateFileService = inject(PrivateFileService);
  private auditTrail = inject(AuditTrailService);
  private inbox = inject(NotificationInboxService);
  private csvExportService = inject(CsvExportService);

  orders: any[] = [];
  filteredOrders: any[] = [];
  searchTerm: string = '';
  statusFilter: string = '';
  dateFilter: 'all' | 'today' | 'week' | 'month' = 'all';
  isLoading: boolean = true;
  isRefreshing: boolean = false;

  // Pagination (Default: 15 records per page per PRD Section 7.6)
  currentPage: number = 1;
  readonly pageSize: number = 15;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.searchTerm = params['search'] || '';
      this.statusFilter = (params['status'] || '').toLowerCase();
      this.filterOrders();
    });
    this.fetchAllOrders();
  }

  fetchAllOrders() {
    this.isLoading = true;
    const ordersRef = ref(this.db, 'orders');

    onValue(
      ordersRef,
      snapshot => {
        this.orders = [];
        const ordersData = snapshot.val();

        if (ordersData) {
          Object.keys(ordersData).forEach(key => {
            this.orders.push({ id: key, ...ordersData[key] });
          });

          this.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        this.filterOrders();
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      },
      error => {
        console.error('Failed to load orders:', error);
        this.notificationService.show('error', 'Unable to fetch orders from server.', 'Fetch Error');
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.detectChanges();
      }
    );
  }

  async refresh(): Promise<void> {
    this.isRefreshing = true;
    try {
      const snapshot = await get(ref(this.db, 'orders'));
      this.orders = [];
      const ordersData = snapshot.val();
      if (ordersData) {
        Object.keys(ordersData).forEach(key => {
          this.orders.push({ id: key, ...ordersData[key] });
        });
        this.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      this.filterOrders();
      this.notificationService.show('success', 'Orders list refreshed successfully.', 'Refreshed');
    } catch (err) {
      console.error('Refresh error:', err);
      this.notificationService.show('error', 'Failed to refresh orders list.', 'Error');
    } finally {
      this.isRefreshing = false;
      this.cdr.detectChanges();
    }
  }

  filterOrders() {
    const term = this.searchTerm.toLowerCase().trim();
    const statusFilter = this.statusFilter;
    const dateFilter = this.dateFilter;

    this.filteredOrders = this.orders.filter(order => {
      const orderId = (order.id || '').toLowerCase();
      const studentName = (order.projectDetails?.submittedBy || '').toLowerCase();
      const searchable = [
        studentName,
        order.projectDetails?.subject,
        order.projectDetails?.course,
        order.projectDetails?.rollNumber,
        order.projectDetails?.topic,
        order.projectDetails?.experimentDetails,
        order.status,
        order.fileType
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesTerm =
        !term ||
        orderId.includes(term) ||
        searchable.includes(term) ||
        (order.projectDetails?.email || '').toLowerCase().includes(term);
      const status = (order.status || 'pending').toLowerCase();
      const matchesStatus = !statusFilter || status === statusFilter;
      const matchesDate = this.matchesDateRange(order.createdAt, dateFilter);

      return matchesTerm && matchesStatus && matchesDate;
    });

    // Reset pagination to page 1 on filter change
    this.currentPage = 1;
  }

  matchesDateRange(dateStr: string, range: string): boolean {
    if (range === 'all' || !dateStr) return true;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return true;

    const now = new Date();
    if (range === 'today') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return time >= startOfDay;
    }
    if (range === 'week') {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
      return time >= startOfWeek;
    }
    if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return time >= startOfMonth;
    }
    return true;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredOrders.length / this.pageSize));
  }

  get paginatedOrders(): any[] {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return this.filteredOrders.slice(startIndex, startIndex + this.pageSize);
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
      { key: 'id', label: 'Order ID', format: (id: string) => this.shortOrderId(id) },
      { key: 'createdAt', label: 'Order Date', format: (d: string) => (d ? new Date(d).toLocaleString() : '') },
      { key: 'projectDetails', label: 'Student Name', format: (p: any) => p?.submittedBy || 'N/A' },
      { key: 'projectDetails', label: 'Course', format: (p: any) => p?.course || 'N/A' },
      { key: 'projectDetails', label: 'Roll Number', format: (p: any) => p?.rollNumber || 'N/A' },
      { key: 'projectDetails', label: 'Subject', format: (p: any) => p?.subject || 'N/A' },
      { key: 'fileType', label: 'Service Type' },
      { key: 'pricing', label: 'Total Amount (INR)', format: (p: any) => p?.totalAmount || 0 },
      { key: 'status', label: 'Order Status', format: (s: string) => s || 'Pending' }
    ];

    const success = this.csvExportService.exportToCsv(`orders_${today}.csv`, columns, this.filteredOrders);
    if (success) {
      this.notificationService.show('success', `Exported ${this.filteredOrders.length} orders to CSV.`, 'CSV Export');
    }
  }

  shortOrderId(id: string): string {
    return id?.startsWith('-') ? id.slice(1, 9) : (id || '').slice(0, 8);
  }

  downloadOrderFile(file: any): void {
    if (file?.dataUrl) {
      this.privateFileService.downloadLegacyDataUrl(file.dataUrl, file.name || 'uploaded-file.pdf');
    } else if (file?.storagePath) {
      void this.privateFileService.download(file.storagePath, file.name || 'uploaded-file.pdf');
    }
  }

  clearSearch() {
    this.searchTerm = '';
    this.statusFilter = '';
    this.dateFilter = 'all';
    this.filteredOrders = [...this.orders];
    this.currentPage = 1;
  }

  // === STATUS UPDATES ===

  async updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const orderRef = ref(this.db, `orders/${orderId}`);
      await update(orderRef, { status: newStatus });
      const order = this.orders.find(item => item.id === orderId);
      if (order?.uid) {
        void this.inbox
          .notifyUser(
            order.uid,
            'delivery',
            'Order status updated',
            `Your order ${orderId.slice(0, 8)} is now marked ${newStatus}.`,
            '/dashboard/my-orders'
          )
          .catch(error => console.warn('Order notification could not be delivered:', error));
      }
      void this.auditTrail.recordAdmin('order_status_changed', 'order', orderId, `Order status set to ${newStatus}.`);
      this.notificationService.show('success', `Order status updated to ${newStatus}.`, 'Updated');
    } catch (error) {
      console.error('Error updating status:', error);
      this.notificationService.show('error', 'Failed to update status. Please check your connection.', 'Update Failed');
    }
  }

  // === ACTIONS ===

  async deleteOrder(orderId: string, event: Event) {
    event.stopPropagation();

    const confirmed = await this.confirmService.confirm({
      title: 'Delete Order',
      message: 'Are you sure you want to permanently delete this order?',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      const orderRef = ref(this.db, `orders/${orderId}`);
      void this.auditTrail.recordAdmin(
        'order_deleted',
        'order',
        orderId,
        `Order ${orderId} permanently deleted by an administrator.`
      );
      await remove(orderRef);
      this.notificationService.show('success', 'Order deleted successfully.', 'Deleted');
    } catch (error) {
      console.error('Error deleting order:', error);
      this.notificationService.show('error', 'Failed to delete order.', 'Delete Failed');
    }
  }
}

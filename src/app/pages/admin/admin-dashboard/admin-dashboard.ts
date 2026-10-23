import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Database, ref, onValue, update, push, set } from '@angular/fire/database';
import { Chart } from 'chart.js/auto'; // Graph ke liye import
import { NotificationService } from '../../../shared/notification/notification.service';
import { ThemeService } from '../../../services/theme.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  providers: [DatePipe], // Date format karne ke liye
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);
  private notificationService = inject(NotificationService);
  private themeService = inject(ThemeService);
  private stopUsersListener: (() => void) | null = null;
  private stopOrdersListener: (() => void) | null = null;
  private stopPaymentsListener: (() => void) | null = null;
  private verifiedPayments: any[] = [];
  private revenueDates: string[] = [];
  private orderCounts: number[] = [];

  // System Stats
  totalRevenue: number = 0;
  pendingOrders: number = 0;
  activeOrders: number = 0;
  completedOrders: number = 0;
  cancelledOrders: number = 0;
  totalOrders = 0;
  recentOrders: any[] = [];

  // Student Stats
  totalStudents: number = 0;
  activeStudents: number = 0;
  suspendedStudents: number = 0;
  students: Array<any> = [];
  isStudentLoading: boolean = true;

  // Teacher Stats
  totalTeachers: number = 0;
  activeTeachers: number = 0;
  suspendedTeachers: number = 0;
  teachers: Array<any> = [];

  // Delivery Staff Stats
  totalDelivery: number = 0;
  activeDelivery: number = 0;
  suspendedDelivery: number = 0;
  deliveryStaff: Array<any> = [];

  // Chart Variable
  public liveChart: any;
  today = new Date();
  showCreateOrder = false;
  isCreating = false;
  createError = '';
  newOrder = { studentUid: '', fileType: 'assignment', subject: '', topic: '', amount: 0 };

  constructor() {
    effect(() => {
      this.themeService.theme();
      this.applyChartTheme();
    });
  }

  ngOnDestroy(): void {
    this.stopUsersListener?.();
    this.stopOrdersListener?.();
    this.stopPaymentsListener?.();
    this.liveChart?.destroy();
  }

  shortOrderId(id: string): string {
    return id?.startsWith('-') ? id.slice(1, 9) : (id || '').slice(0, 8);
  }

  verifiedAmount(payment: any): number {
    return payment?.status === 'verified' ? Number(payment?.amount) || 0 : 0;
  }

  openCreateOrder(): void { this.createError = ''; this.showCreateOrder = true; }
  closeCreateOrder(): void { if (!this.isCreating) this.showCreateOrder = false; }

  async createOrder(): Promise<void> {
    const student = this.students.find(candidate => candidate.uid === this.newOrder.studentUid && candidate.status === 'active');
    const subject = this.newOrder.subject.trim();
    const topic = this.newOrder.topic.trim();
    const amount = Number(this.newOrder.amount);
    if (!student || !subject || !Number.isFinite(amount) || amount < 0) {
      this.createError = 'Select a registered student, enter a subject, and provide a valid non-negative amount.';
      return;
    }
    this.isCreating = true;
    this.createError = '';
    const orderRef = push(ref(this.db, 'orders'));
    try {
      await set(orderRef, {
        uid: student.uid,
        studentID: student.studentID || '',
        fileType: this.newOrder.fileType,
        createdAt: new Date().toISOString(), createdBy: 'admin', status: 'Pending',
        projectDetails: { submittedBy: student.fullName || student.name || 'Student', email: student.email || '', subject, topic, course: student.courseName || '', rollNumber: student.rollNumber || '', submittedTo: '' },
        userDetails: { fullName: student.fullName || student.name || 'Student', email: student.email || '', phone: student.phone || '', whatsapp: student.whatsapp || '', address: student.address || '', pincode: student.pincode || '' },
        printSettings: { pagesLabel: 'Not specified', binding: 'none', quantity: 1 },
        pricing: { printCost: amount, bindingCost: 0, uploadDiscount: 0, totalAmount: amount, advancePaid: 0 },
        paymentDetails: { status: 'Awaiting Quotation' }
      });
      this.notificationService.show('success', `Order #${this.shortOrderId(orderRef.key || '')} was added to the order queue.`, 'Order created');
      this.newOrder = { studentUid: '', fileType: 'assignment', subject: '', topic: '', amount: 0 };
      this.showCreateOrder = false;
    } catch (error) {
      console.error('Failed to create admin order', error);
      this.createError = 'The order could not be saved. Check your connection and try again.';
    } finally { this.isCreating = false; }
  }
  ngOnInit(): void {
    this.fetchSystemStats();
    this.fetchStudentStats();
  }

  async fetchStudentStats() {
    const usersRef = ref(this.db, 'users');
    this.stopUsersListener = onValue(usersRef, (snapshot) => {
      const usersData = snapshot.val();
      this.students = [];
      this.totalStudents = 0;
      this.activeStudents = 0;
      this.suspendedStudents = 0;

      this.teachers = [];
      this.totalTeachers = 0;
      this.activeTeachers = 0;
      this.suspendedTeachers = 0;

      this.deliveryStaff = [];
      this.totalDelivery = 0;
      this.activeDelivery = 0;
      this.suspendedDelivery = 0;

      if (usersData) {
        Object.keys(usersData).forEach(uid => {
          const user = usersData[uid];
          const role = (user.role || 'student').toLowerCase();
          if (role === 'student') {
            this.totalStudents += 1;
            if (user.status === 'suspended') { this.suspendedStudents += 1; } else { this.activeStudents += 1; }
            this.students.push({ uid, ...user });
          } else if (role === 'teacher') {
            this.totalTeachers += 1;
            if (user.status === 'suspended') { this.suspendedTeachers += 1; } else { this.activeTeachers += 1; }
            this.teachers.push({ uid, ...user });
          } else if (role === 'delivery' || role === 'deliveryboy' || role === 'delivery-boy') {
            this.totalDelivery += 1;
            if (user.status === 'suspended') { this.suspendedDelivery += 1; } else { this.activeDelivery += 1; }
            this.deliveryStaff.push({ uid, ...user });
          }
        });
      }

      this.students.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
      this.isStudentLoading = false;
      this.cdr.detectChanges();
    });
  }

  async changeStudentStatus(uid: string, newStatus: 'active' | 'suspended') {
    try {
      const userRef = ref(this.db, `users/${uid}`);
      await update(userRef, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      this.notificationService.show('success', 'Student status updated.', 'Updated');
    } catch (error) {
      console.error('Failed to update student status', error);
      // show notification instead
      this.notificationService.show('error', 'Failed to update student status. Please try again.', 'Update Failed');
    }
  }

  fetchSystemStats() {
    this.stopPaymentsListener = onValue(ref(this.db, 'payments'), snapshot => {
      const payments = snapshot.val() || {};
      this.verifiedPayments = Object.keys(payments).map(id => ({ id, ...payments[id] })).filter(payment => payment.status === 'verified');
      this.refreshVerifiedRevenue();
    });

    const ordersRef = ref(this.db, 'orders');

    this.stopOrdersListener = onValue(ordersRef, (snapshot) => {
      const ordersData = snapshot.val();

      // Sabhi counters ko reset karein
      this.totalRevenue = 0;
      this.pendingOrders = 0;
      this.activeOrders = 0;
      this.cancelledOrders = 0; // Reset cancelled count
      this.completedOrders = 0;
      this.totalOrders = 0;

      // Graph ke liye pichle 7 din ke labels aur data arrays
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      let orderData = [0, 0, 0, 0, 0, 0, 0];

      if (ordersData) {
        const allOrders = Object.keys(ordersData).map(key => ({ id: key, ...ordersData[key] }));
        this.totalOrders = allOrders.length;
        this.recentOrders = allOrders.sort((a, b) => (Date.parse(b.createdAt || '') || 0) - (Date.parse(a.createdAt || '') || 0)).slice(0, 5);
        Object.keys(ordersData).forEach(key => {
          const order = ordersData[key];
          const status = (order.status || 'Pending').toLowerCase();

          // 1. Stats calculation
          if (status === 'cancelled') {
            this.cancelledOrders++; // Cancelled count badhayein
          } else {
            // Status wise distribution
            if (status === 'pending') {
              this.pendingOrders++;
            } else if (status === 'delivered' || status === 'completed') {
              this.completedOrders++;
            } else {
              this.activeOrders++; // Processing/Printing etc.
            }
          }

          // 2. Graph ke liye daily data populate karna (Sirf non-cancelled orders)
          if (order.createdAt && status !== 'cancelled') {
            const timestamp = Date.parse(order.createdAt);
            const orderDateStr = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().split('T')[0] : '';
            const index = last7Days.indexOf(orderDateStr);
            if (index !== -1) {
              orderData[index] += 1;
            }
          }
        });
      } else {
        this.recentOrders = [];
      }

      // Format Labels (e.g., "10 May")
      const formattedLabels = last7Days.map(dateStr => this.datePipe.transform(dateStr, 'dd MMM'));

      this.revenueDates = last7Days;
      this.orderCounts = orderData;
      this.updateChart(formattedLabels, Array(7).fill(0), orderData);
      this.refreshVerifiedRevenue();
      this.cdr.detectChanges();
    });
  }

  private refreshVerifiedRevenue(): void {
    if (!this.revenueDates.length) return;
    const revenueData = Array(this.revenueDates.length).fill(0) as number[];
    this.totalRevenue = 0;
    for (const payment of this.verifiedPayments) {
      const amount = this.verifiedAmount(payment);
      this.totalRevenue += amount;
      const date = Date.parse(payment.createdAt || '');
      const index = Number.isFinite(date) ? this.revenueDates.indexOf(new Date(date).toISOString().split('T')[0]) : -1;
      if (index >= 0) revenueData[index] += amount;
    }
    const labels = this.revenueDates.map(date => this.datePipe.transform(date, 'dd MMM'));
    this.updateChart(labels, revenueData, this.orderCounts);
  }

  updateChart(labels: any[], revenueData: number[], orderData: number[]) {
    if (this.liveChart) {
      // Agar graph pehle se hai, toh sirf data update karein (Smooth animation)
      this.liveChart.data.labels = labels;
      this.liveChart.data.datasets[0].data = revenueData;
      this.liveChart.data.datasets[1].data = orderData;
      this.liveChart.update();
    } else {
      // Pehli baar graph render karna
      this.liveChart = new Chart('performanceChart', {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Daily Revenue (INR)',
              data: revenueData,
              borderColor: '#10b981', // Emerald Green
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true,
              tension: 0.4, // Smooth curve
              yAxisID: 'y'
            },
            {
              label: 'Orders Received',
              data: orderData,
              borderColor: '#0ea5e9', // Ocean Blue
              backgroundColor: 'rgba(14, 165, 233, 0.1)',
              fill: true,
              tension: 0.4,
              yAxisID: 'y1'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: this.themeService.theme() === 'light' ? '#596680' : '#94a3b8', font: { family: 'Inter', size: 12 } } },
            tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', bodyColor: '#fff', padding: 10, cornerRadius: 8 }
          },
          scales: {
            x: { grid: { color: this.themeService.theme() === 'light' ? '#e8ebf3' : 'rgba(255, 255, 255, 0.05)' }, ticks: { color: this.themeService.theme() === 'light' ? '#596680' : '#94a3b8' } },
            y: {
              type: 'linear', display: true, position: 'left',
              grid: { color: this.themeService.theme() === 'light' ? '#e8ebf3' : 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#10b981' }, title: { display: true, text: 'Revenue (INR)', color: '#10b981' }
            },
            y1: {
              type: 'linear', display: true, position: 'right',
              grid: { drawOnChartArea: false },
              ticks: { color: '#0ea5e9', stepSize: 1 }, title: { display: true, text: 'Orders', color: '#0ea5e9' }
            }
          }
        }
      });
    }
  }

  private applyChartTheme(): void {
    if (!this.liveChart) return;
    const light = this.themeService.theme() === 'light';
    const text = light ? '#596680' : '#94a3b8';
    const grid = light ? '#e8ebf3' : 'rgba(255,255,255,.06)';
    this.liveChart.options.plugins.legend.labels.color = text;
    for (const axis of Object.values(this.liveChart.options.scales) as any[]) {
      axis.ticks.color = text;
      axis.grid.color = grid;
    }
    this.liveChart.update('none');
  }
}

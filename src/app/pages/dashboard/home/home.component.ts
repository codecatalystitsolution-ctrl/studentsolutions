import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { Database, ref, query, orderByChild, equalTo, limitToFirst, onValue, set } from '@angular/fire/database';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private auth = inject(Auth);
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private ngZone = inject(NgZone); // UI ko instantly update karne ke liye
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);

  userName: string = 'Loading...';
  activeOrdersCount: number = 0;
  completedOrdersCount: number = 0;
  totalSpent: number = 0;
  recentOrders: any[] = [];

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        const uid = user.uid;

        // 1. User ki profile se Name aur studentID (FC-XXXXXX) fetch karein
        const userRef = ref(this.db, `users/${uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.val();
            this.userName = data.fullName || 'Student';
            const studentID = data.studentID || ''; // FC-ID nikala

            // 2. Fetch orders ko dono IDs bhej di
            this.fetchRealtimeOrders(uid);
          } else {
            this.fetchRealtimeOrders(uid);
          }
        }, { onlyOnce: true });

      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  fetchRealtimeOrders(uid: string) {
    // Ab hum specific query ki jagah poore 'orders' ref par onValue lagayenge
    // taaki client-side par 100% accurate double-filtering kar sakein.
    const ordersRef = query(ref(this.db, 'orders'), orderByChild('uid'), equalTo(uid), limitToFirst(100));

    onValue(ordersRef, (snapshot) => {
      this.ngZone.run(() => {
        const ordersData = snapshot.val();
        this.recentOrders = [];
        this.activeOrdersCount = 0;
        this.completedOrdersCount = 0;
        this.totalSpent = 0;

        if (ordersData) {
          Object.keys(ordersData).forEach(key => {
            const order = { id: key, ...ordersData[key] };

            // === FILTER 1: SIRF LOGIN STUDENT KE ORDERS ===
            const isMyOrder = order.uid === uid;

            if (isMyOrder) {
              const statusLabel = (order.status || 'Pending').toLowerCase();

              // === COUNTERS UPDATE KAREIN (Saare orders ginenge) ===
              if (statusLabel === 'delivered' && statusLabel !== 'cancelled') {
                this.completedOrdersCount++;
              } else if (statusLabel !== 'cancelled') {
                this.activeOrdersCount++;
              }

              if (order.pricing?.totalAmount) {
                this.totalSpent += order.pricing.totalAmount;
              }

              // === FILTER 2: TABLE MEIN SIRF UNDELIVERED DIKHAYEIN ===
              if (statusLabel !== 'delivered' && statusLabel !== 'cancelled') {
                this.recentOrders.push(order);
              }
            }
          });

          // Naye orders upar dikhane ke liye sort karna zaruri hai
          this.recentOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
      });

      this.cdr.detectChanges();
    });
  }

  // ==========================================
  // NAYE FUNCTIONS: CANCEL & EDIT ORDER
  // ==========================================

  async cancelOrder(orderId: string) {
    const confirmed = await this.confirmService.confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order? This cannot be undone.',
      confirmText: 'Yes, Cancel',
      cancelText: 'Keep Order'
    });

    if (!confirmed) return;

    try {
      const requestRef = ref(this.db, 'cancellationRequests/' + orderId);
      await set(requestRef, { orderId, uid: this.auth.currentUser?.uid || '', reason: 'Cancellation requested by student', status: 'pending', createdAt: new Date().toISOString() });
      this.notificationService.show('success', 'Cancellation request sent to the support team.', 'Request sent');
    } catch (error) {
      console.error('Error cancelling order:', error);
      this.notificationService.show('error', 'Failed to cancel order. Please check your connection.', 'Cancel Failed');
    }
  }

  editOrder(order: any) {
    this.router.navigate(['/dashboard/new-order'], { queryParams: { editId: order.id } });
  }
}

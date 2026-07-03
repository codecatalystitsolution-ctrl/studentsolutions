import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, NgZone } from '@angular/core'; // ChangeDetectorRef add kiya
import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
// Firebase Tools
import { Auth, authState } from '@angular/fire/auth';
import { ConfirmService } from '../../../shared/confirmation/confirm.service';
import { NotificationService } from '../../../shared/notification/notification.service';
import { Database, ref, onValue, off, update } from '@angular/fire/database';

interface Order {
  fileType?: string;
  projectDetails?: any;
  subject?: any;
  printSettings?: any;
  pagesLabel?: any;
  createdAt?: string | number | Date;
  id: string;
  fileName?: string;
  fileSize?: string;
  printType?: string;
  bindingType?: string;
  totalPages?: number;
  copies?: number;
  totalCost?: number;
  status: string;
  orderDate?: string;
  uid?: string;         
  studentID?: string;   
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe, UpperCasePipe],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  isLoading = true; // Start mein loading true rahega
  private ordersRef: any;

  private db = inject(Database);
  private auth = inject(Auth);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // UI force update tool
  private ngZone = inject(NgZone); // Angular zone for UI updates
  private confirmService = inject(ConfirmService);
  private notificationService = inject(NotificationService);

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        const uid = user.uid; // Firebase Auth UID

        // === NAYA STEP: Database se studentID (FC-XXXXXX) fetch karein ===
        const userRef = ref(this.db, `users/${uid}`);
        onValue(userRef, (snapshot) => {
          if (snapshot.exists() && snapshot.val().studentID) {
            const studentID = snapshot.val().studentID;
            // Fetch orders function ko dono IDs pass karein
            this.fetchOrdersLive(uid, studentID);
          } else {
            // Agar kisi wajah se studentID nahi hai, toh sirf Firebase UID pass karein
            this.fetchOrdersLive(uid, '');
          }
        }, { onlyOnce: true }); // onlyOnce true rakha hai taaki loop na bane

      } else {
        this.isLoading = false;
        this.router.navigate(['/login']); 
      }
    });
  }

  // Ab ye function dono ID (Firebase UID aur FC-ID) accept karega
  fetchOrdersLive(userId: string, studentID: string): void {
    this.isLoading = true;
    this.ordersRef = ref(this.db, 'orders');

    onValue(this.ordersRef, (snapshot) => {
      this.ngZone.run(() => {
        const data = snapshot.val();
        this.orders = []; 

        if (data) {
          this.orders = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            // === EK DUM CORRECT FILTER ===
            // Order ka 'uid' Firebase UID se match kare YA 'studentID' FC-ID se match kare
            .filter((order: Order) => 
              (order.uid === userId) || 
              (studentID !== '' && order.studentID === studentID)
            )
            .reverse(); 
        }

        this.isLoading = false;
      });
      
      this.cdr.detectChanges(); 

    }, (error) => {
      this.ngZone.run(() => {
        console.error("Firebase error:", error);
        this.isLoading = false;
      });
    });
  }

  getCountByStatus(status: string): number {
    return this.orders.filter(o => 
      (o.status || '').toLowerCase() === status.toLowerCase()
    ).length;
  }

  ngOnDestroy(): void {
    if (this.ordersRef) {
      off(this.ordersRef);
    }
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
      const orderRef = ref(this.db, `orders/${orderId}`);
      await update(orderRef, { status: 'Cancelled' });
      this.notificationService.show('success', 'Order has been cancelled successfully.', 'Cancelled');
    } catch (error) {
      console.error('Error cancelling order:', error);
      this.notificationService.show('error', 'Failed to cancel order. Please check your connection.', 'Cancel Failed');
    }
  }

  editOrder(order: any) {
    this.router.navigate(['/dashboard/new-order'], { queryParams: { editId: order.id } });
  }

}
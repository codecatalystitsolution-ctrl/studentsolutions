import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router'; 
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, onValue, update } from '@angular/fire/database';

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
            this.fetchRealtimeOrders(uid, studentID);
          } else {
            this.fetchRealtimeOrders(uid, '');
          }
        }, { onlyOnce: true });

      } else {
        this.router.navigate(['/login']);
      }
    });
  }

  fetchRealtimeOrders(uid: string, studentID: string) {
    // Ab hum specific query ki jagah poore 'orders' ref par onValue lagayenge
    // taaki client-side par 100% accurate double-filtering kar sakein.
    const ordersRef = ref(this.db, 'orders');
    
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
            const isMyOrder = (order.uid === uid) || (studentID !== '' && order.studentID === studentID);

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
    const isConfirm = confirm("Are you sure you want to cancel this order? This cannot be undone.");
    
    if (isConfirm) {
      try {
        const orderRef = ref(this.db, `orders/${orderId}`);
        // Database mein status ko 'Cancelled' set kar dega
        await update(orderRef, { status: 'Cancelled' });
        
        alert("Order has been cancelled successfully.");
        // Note: fetchRealtimeOrders mein onValue laga hai, toh table apne aap refresh ho jayegi
      } catch (error) {
        console.error("Error cancelling order:", error);
        alert("Failed to cancel order. Please check your connection.");
      }
    }
  }

  editOrder(order: any) {
    this.router.navigate(['/dashboard/new-order'], { queryParams: { editId: order.id } });
  }
}
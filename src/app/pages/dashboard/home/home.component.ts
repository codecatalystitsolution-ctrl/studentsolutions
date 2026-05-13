import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router'; // Router add kiya for navigation
import { Auth, authState } from '@angular/fire/auth';
import { Database, ref, onValue, query, orderByChild, equalTo, update } from '@angular/fire/database'; // update add kiya

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
  private router = inject(Router); // Router inject kiya

  userName: string = 'Loading...';
  activeOrdersCount: number = 0;
  completedOrdersCount: number = 0;
  totalSpent: number = 0;
  recentOrders: any[] = [];

  ngOnInit(): void {
    authState(this.auth).subscribe(user => {
      if (user) {
        this.fetchUserData(user.uid);
        this.fetchRealtimeOrders(user.uid);
      }
    });
  }

  fetchUserData(uid: string) {
    const userRef = ref(this.db, 'users/' + uid);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      this.userName = data ? (data.fullName || 'Student') : 'Student';
      this.cdr.detectChanges();
    });
  }

  fetchRealtimeOrders(uid: string) {
    const ordersRef = query(ref(this.db, 'orders'), orderByChild('userId'), equalTo(uid));
    
    onValue(ordersRef, (snapshot) => {
      const ordersData = snapshot.val();
      this.recentOrders = [];
      this.activeOrdersCount = 0;
      this.completedOrdersCount = 0;
      this.totalSpent = 0;

      if (ordersData) {
        Object.keys(ordersData).forEach(key => {
          const order = { id: key, ...ordersData[key] };
          this.recentOrders.push(order);

          // Status count logic (Cancelled ko active nahi manenge)
          if (order.status === 'Delivered') {
            this.completedOrdersCount++;
          } else if (order.status !== 'Cancelled') {
            this.activeOrdersCount++;
          }

          if (order.pricing?.totalAmount) {
            this.totalSpent += order.pricing.totalAmount;
          }
        });

        // Naye orders upar dikhane ke liye sort karna zaruri hai
        this.recentOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
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
    // Edit dabane par form par bhejenge aur URL me order ka ID pass karenge
    // Example url: /dashboard/new-order?editId=-Oabcd1234
    this.router.navigate(['/dashboard/new-order'], { queryParams: { editId: order.id } });
  }
}
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Database, ref, onValue, update, remove } from '@angular/fire/database';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-manage-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manage-orders.html',
  styleUrls: ['./manage-orders.scss']
})
export class ManageOrdersComponent implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);

  orders: any[] = [];
  filteredOrders: any[] = []; 
  searchTerm: string = '';    
  isLoading: boolean = true;

  ngOnInit(): void {
    this.fetchAllOrders();
  }

  fetchAllOrders() {
    const ordersRef = ref(this.db, 'orders');

    onValue(ordersRef, (snapshot) => {
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
      this.cdr.detectChanges();
    });
  }

  filterOrders() {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredOrders = [...this.orders];
      return;
    }

    this.filteredOrders = this.orders.filter(order => {
      const orderId = (order.id || '').toLowerCase();
      const studentName = (order.projectDetails?.submittedBy || '').toLowerCase();

      return orderId.includes(term) || studentName.includes(term);
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredOrders = [...this.orders];
  }

  // === STATUS UPDATES ===

  async updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const orderRef = ref(this.db, `orders/${orderId}`);
      await update(orderRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please check your connection.");
    }
  }

  async updatePaymentStatus(orderId: string, newStatus: string) {
    try {
      // Firebase mein exact path dena padta hai nested objects ke liye
      // taaki paymentDetails ka baaki data (UPI id wagerah) delete na ho jaye
      const paymentStatusRef = ref(this.db, `orders/${orderId}/paymentDetails`);
      await update(paymentStatusRef, { status: newStatus });
      
    } catch (error) {
      console.error("Error updating payment status:", error);
      alert("Failed to update payment status. Please check your connection.");
    }
  }

  // === ACTIONS ===

  async deleteOrder(orderId: string, event: Event) {
    event.stopPropagation();

    const isConfirm = confirm("⚠️ Are you sure you want to permanently delete this order?");

    if (isConfirm) {
      try {
        const orderRef = ref(this.db, `orders/${orderId}`);
        await remove(orderRef); 
      } catch (error) {
        console.error("Error deleting order:", error);
        alert("Failed to delete order.");
      }
    }
  }
}
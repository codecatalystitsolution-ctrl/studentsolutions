import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // Dropdown aur Search bind karne ke liye zaroori
import { Database, ref, onValue, update } from '@angular/fire/database';
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
  filteredOrders: any[] = []; // Search ke liye naya array
  searchTerm: string = '';    // Search bar ki value ke liye
  isLoading: boolean = true;

  ngOnInit(): void {
    this.fetchAllOrders();
  }

  fetchAllOrders() {
    const ordersRef = ref(this.db, 'orders');
    
    // onValue live data fetch karta hai
    onValue(ordersRef, (snapshot) => {
      this.orders = [];
      const ordersData = snapshot.val();

      if (ordersData) {
        Object.keys(ordersData).forEach(key => {
          this.orders.push({ id: key, ...ordersData[key] });
        });

        // Naye orders sabse upar dikhane ke liye date ke hisaab se sort karein
        this.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      
      // Data aane ke baad automatically filter function call kardo 
      // Taaki agar Admin search kar raha ho tab naya order aaye toh search kharab na ho
      this.filterOrders(); 

      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  // ==========================================
  // === NAYE SEARCH FUNCTIONS ===
  // ==========================================
  filterOrders() {
    const term = this.searchTerm.toLowerCase().trim();
    
    if (!term) {
      // Agar search box khali hai, toh original list dikhao
      this.filteredOrders = [...this.orders];
      return;
    }

    // Filter logic: Order ID ya Student Name dono mein search karega
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
  // ==========================================

  // Live Firebase Update Function
  async updateOrderStatus(orderId: string, newStatus: string) {
    try {
      const orderRef = ref(this.db, `orders/${orderId}`);
      await update(orderRef, { status: newStatus });
      
      // Optional: Aap yahan ek chota toast notification bhi laga sakte hain
      console.log(`Order ${orderId} updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status. Please check your connection.");
    }
  }
}
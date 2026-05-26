import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Dhyan dein: 'get' import karna zaroori hai
import { Database, ref, onValue, get } from '@angular/fire/database';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './order-details.html',
  styleUrls: ['./order-details.scss']
})
export class OrderDetailsComponent implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute); // Naya injection

  orders: any[] = [];
  filteredOrders: any[] = [];
  isLoading: boolean = true;
  searchTerm: string = '';

  ngOnInit(): void {
    // URL se 'search' parameter nikalna
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchTerm = params['search'];
      }
    });

    this.fetchAllDetailedOrders();
  }

  fetchAllDetailedOrders() {
    const ordersRef = ref(this.db, 'orders');

    onValue(ordersRef, async (snapshot) => {
      this.isLoading = true;
      const ordersData = snapshot.val();

      if (ordersData) {
        const rawOrders = Object.keys(ordersData).map(key => ({
          id: key,
          ...ordersData[key]
        }));

        // Har order ke liye user data fetch karna
        const detailedOrders = await Promise.all(
          rawOrders.map(async (order) => {
            if (order.userId) {
              const userSnap = await get(ref(this.db, `users/${order.userId}`));
              if (userSnap.exists()) {
                return { ...order, userDetails: userSnap.val() };
              }
            }
            return order;
          })
        );

        this.orders = detailedOrders.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // 2. CRITICAL FIX: Data aane ke baad check karo search term hai ya nahi
        this.filterOrders();
      } else {
        this.orders = [];
        this.filteredOrders = [];
      }

      this.isLoading = false;
      this.cdr.detectChanges();
    });
  }

  filterOrders() {
    // Agar koi search term nahi hai, toh saare dikhao
    if (!this.searchTerm || this.searchTerm.trim() === '') {
      this.filteredOrders = [...this.orders];
    } else {
      const term = this.searchTerm.toLowerCase().trim();

      this.filteredOrders = this.orders.filter(order => {
        // Order ID check (Pure ID ya slice dono check karega)
        const orderId = (order.id + '').toLowerCase();
        const shortId = orderId.substring(1, 9); // Humne Manage orders me substring(1,9) bheja tha

        return orderId.includes(term) ||
          shortId.includes(term) ||
          (order.projectDetails?.submittedBy || '').toLowerCase().includes(term) ||
          (order.projectDetails?.rollNumber || '').toLowerCase().includes(term) ||
          (order.userDetails?.phone || '').includes(term);
      });
    }
    this.cdr.detectChanges();
  }
}
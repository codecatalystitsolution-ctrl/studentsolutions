import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Database, ref, onValue } from '@angular/fire/database';
import { Chart } from 'chart.js/auto'; // Graph ke liye import

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  providers: [DatePipe], // Date format karne ke liye
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.scss']
})
export class AdminDashboardComponent implements OnInit {
  private db = inject(Database);
  private cdr = inject(ChangeDetectorRef);
  private datePipe = inject(DatePipe);

  // System Stats
  totalRevenue: number = 0;
  pendingOrders: number = 0;
  activeOrders: number = 0;
  completedOrders: number = 0;
  cancelledOrders: number = 0;


  // Chart Variable
  public liveChart: any;

  ngOnInit(): void {
    this.fetchSystemStats();
  }

fetchSystemStats() {
    const ordersRef = ref(this.db, 'orders');
    
    onValue(ordersRef, (snapshot) => {
      const ordersData = snapshot.val();
      
      // Sabhi counters ko reset karein
      this.totalRevenue = 0;
      this.pendingOrders = 0;
      this.activeOrders = 0;
      this.cancelledOrders = 0; // Reset cancelled count
      this.completedOrders = 0;

      // Graph ke liye pichle 7 din ke labels aur data arrays
      const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0];
      }).reverse();

      let revenueData = [0, 0, 0, 0, 0, 0, 0];
      let orderData = [0, 0, 0, 0, 0, 0, 0];

      if (ordersData) {
        Object.keys(ordersData).forEach(key => {
          const order = ordersData[key];
          const status = (order.status || 'Pending').toLowerCase();

          // 1. Stats calculation
          if (status === 'cancelled') {
            this.cancelledOrders++; // Cancelled count badhayein
          } else {
            // Revenue sirf un orders ka jo cancel nahi huye
            if (order.pricing?.totalAmount) {
              this.totalRevenue += order.pricing.totalAmount;
            }

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
            const orderDateStr = new Date(order.createdAt).toISOString().split('T')[0];
            const index = last7Days.indexOf(orderDateStr);
            if (index !== -1) {
              orderData[index] += 1;
              revenueData[index] += (order.pricing?.totalAmount || 0);
            }
          }
        });
      }

      // Format Labels (e.g., "10 May")
      const formattedLabels = last7Days.map(dateStr => this.datePipe.transform(dateStr, 'dd MMM'));
      
      this.updateChart(formattedLabels, revenueData, orderData);
      this.cdr.detectChanges();
    });
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
              label: 'Daily Revenue (₹)',
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
            legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } } },
            tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', titleColor: '#fff', bodyColor: '#fff', padding: 10, cornerRadius: 8 }
          },
          scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
            y: { 
              type: 'linear', display: true, position: 'left', 
              grid: { color: 'rgba(255, 255, 255, 0.05)' }, 
              ticks: { color: '#10b981' }, title: { display: true, text: 'Revenue (₹)', color: '#10b981' }
            },
            y1: { 
              type: 'linear', display: true, position: 'right', 
              grid: { drawOnChartArea: false }, // Avoid grid overlap
              ticks: { color: '#0ea5e9', stepSize: 1 }, title: { display: true, text: 'Orders', color: '#0ea5e9' }
            }
          }
        }
      });
    }
  }
}
import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';
import { HelpSupportComponent } from './pages/dashboard/help-support/help-support';
import { OrderHistoryComponent } from './pages/dashboard/order-history/order-history';
import { TicketStatusComponent } from './pages/dashboard/help-support/ticket-status/ticket-status';

export const routes: Routes = [
  {
    // Default route: Jab koi direct filecrafters.in khole, toh login par bhej do
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    // Login Route (Lazy Loaded)
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },


  {
    path: 'dashboard',
    // canActivate: [AuthGuard], // Agar aapka guard yahan laga hai
    children: [
      // Baki saare pages jo dashboard me khulte hain
      {
        path: 'help-support',
        component: HelpSupportComponent
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/dashboard/profile/profile.component').then(m => m.ProfileComponent)
      } // Example agar lazy load ho toh
    ]
  },
  {
    path: 'new-order',
    loadComponent: () => import('./pages/new-order/new-order.component').then(m => m.NewOrderComponent)
  },
  // app.routes.ts me dashboard ke children ke andar is tarah likhein:

  // --- Updated Dashboard Route with Children ---
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    children: [

      {
        // Default child route jab user /dashboard kholega
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/dashboard/home/home.component').then(m => m.HomeComponent)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/dashboard/profile/profile.component').then(m => m.ProfileComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/dashboard/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'quizzes',
        loadComponent: () => import('./pages/quizzes/quizzes.component').then(m => m.QuizzesComponent)
      },
      {
        path: 'quiz-player',
        loadComponent: () => import('./pages/quiz-player/quiz-player.component').then(m => m.QuizPlayerComponent)
      },
      {
        path: 'my-orders',
        component: OrderHistoryComponent
      },
      {
        path: 'my-tickets',
        component: TicketStatusComponent
      }
    ]
  },

  {
    // Wildcard Route: Agar koi galat URL daale, toh wapas login par bhej do
    path: '**',
    redirectTo: 'home'
  },


  // ... (Aapka purana student dashboard route) ...

  // --- ADMIN PANEL ROUTES ---

  {
    path: 'admin-login',
    loadComponent: () => import('./pages/admin/admin-login/admin-login').then(m => m.AdminLoginComponent)
  },

  {
    path: 'admin',
    // YEH LINE ADD KARNI HAI:
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/admin/manage-orders/manage-orders').then(m => m.ManageOrdersComponent)
      },
      {
        path: 'order-details',
        loadComponent: () => import('./pages/admin/order-details/order-details').then(m => m.OrderDetailsComponent)
      },
      {
        path: 'complaints',
        loadComponent: () => import('./pages/admin/complaints/complaints.component').then(m => m.ComplaintsComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];

import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin-guard';
import { studentGuard } from './guards/student-guard';
import { deliveryGuard } from './guards/delivery-guard';
import { teacherGuard } from './guards/teacher-guard';
import { inboxGuard } from './guards/inbox-guard';
import { HelpSupportComponent } from './pages/dashboard/help-support/help-support';
import { OrderHistoryComponent } from './pages/dashboard/order-history/order-history';
import { TicketStatusComponent } from './pages/dashboard/help-support/ticket-status/ticket-status';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./pages/public-preview/public-preview.component').then(m => m.PublicPreviewComponent)
  },
  {
    // Login Route (Lazy Loaded)
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'login-support',
    loadComponent: () => import('./pages/login/login-support.component').then(m => m.LoginSupportComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.component').then(m => m.RegisterComponent)
  },


  {
    path: 'new-order',
    canActivate: [studentGuard],
    loadComponent: () => import('./pages/new-order/new-order.component').then(m => m.NewOrderComponent)
  },
  {
    path: 'delivery-portal',
    canActivate: [deliveryGuard],
    loadComponent: () => import('./pages/delivery-portal/delivery-portal.component').then(m => m.DeliveryPortalComponent)
  },
  {
    path: 'teacher/referrals',
    canActivate: [teacherGuard],
    loadComponent: () => import('./pages/teacher-referrals/teacher-referrals.component').then(m => m.TeacherReferralsComponent)
  },
  {
    path: 'notifications',
    canActivate: [inboxGuard],
    loadComponent: () => import('./pages/notification-inbox/notification-inbox.component').then(m => m.NotificationInboxComponent)
  },
  // app.routes.ts me dashboard ke children ke andar is tarah likhein:

  // --- Updated Dashboard Route with Children ---
  {
    path: 'dashboard',
    canActivate: [studentGuard],
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
        path: 'help-support',
        component: HelpSupportComponent
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

  // --- ADMIN PANEL ROUTES ---

  {
    path: 'admin-login',
    loadComponent: () => import('./pages/admin/admin-login/admin-login').then(m => m.AdminLoginComponent)
  },
  {
    path: 'admin/login',
    redirectTo: 'admin-login',
    pathMatch: 'full'
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
        path: 'payments',
        loadComponent: () => import('./pages/admin/payments/admin-payments.component').then(m => m.AdminPaymentsComponent)
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/admin/notifications/admin-notifications.component').then(m => m.AdminNotificationsComponent)
      },
      {
        path: 'students/:uid',
        loadComponent: () => import('./pages/admin/student-management/student-detail.component').then(m => m.StudentDetailComponent)
      },
      {
        path: 'students',
        loadComponent: () => import('./pages/admin/student-management/student-management').then(m => m.StudentManagementComponent)
      },
      {
        path: 'teachers',
        loadComponent: () => import('./pages/admin/teacher-management/teacher-management').then(m => m.TeacherManagementComponent)
      },
      {
        path: 'teachers/:uid',
        loadComponent: () => import('./pages/admin/teacher-management/teacher-detail.component').then(m => m.TeacherDetailComponent)
      },
      {
        path: 'delivery',
        loadComponent: () => import('./pages/admin/delivery-management/delivery-management').then(m => m.DeliveryManagementComponent)
      },
      {
        path: 'delivery/:uid',
        loadComponent: () => import('./pages/admin/delivery-management/delivery-detail.component').then(m => m.DeliveryDetailComponent)
      },
      {
        path: 'order-details',
        loadComponent: () => import('./pages/admin/order-details/order-details').then(m => m.OrderDetailsComponent)
      },
      {
        path: 'complaints',
        loadComponent: () => import('./pages/admin/complaints/complaints.component').then(m => m.ComplaintsComponent)
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/admin/audit-history/audit-history.component').then(m => m.AuditHistoryComponent)
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];

# UI Implementation Plan

## 1. Project audit summary

This application is an Angular 21 web app with Firebase-based auth/data integration and route-based lazy loading. The actual project structure includes:

- Authentication pages:
  - `/login`
  - `/login-support`
  - `/register`
  - `/admin-login`
- Student dashboard shell:
  - `/dashboard`
  - `/dashboard/home`
  - `/dashboard/profile`
  - `/dashboard/settings`
  - `/dashboard/quizzes`
  - `/dashboard/quiz-player`
  - `/dashboard/my-orders`
  - `/dashboard/my-tickets`
- Student flows:
  - `/new-order`
  - `/home` (redirects to `/login` in the root route configuration)
- Admin panel:
  - `/admin`
  - `/admin/dashboard`
  - `/admin/orders`
  - `/admin/students`
  - `/admin/students/:uid`
  - `/admin/teachers`
  - `/admin/teachers/:uid`
  - `/admin/delivery`
  - `/admin/delivery/:uid`
  - `/admin/order-details`
  - `/admin/complaints`

## 2. Actual issues identified

1. The app already contains a base design token layer in `src/styles.scss`, but some legacy page files still use hardcoded dark-only color values.
2. The dashboard shell and main home screen had been redesigned using CSS variables, but a few admin and workflow screens still contain older palette assumptions.
3. The theme state relies on CSS classes like `body.app-theme-light`, but the codebase still has duplicate page-specific style assumptions rather than a single source of truth across every route.
4. There are real route-driven screens beyond the dashboard, and they need to be treated as part of the same premium design system.

## 3. Shared design system approach

The application already uses a CSS-variable-driven design layer. This is the correct foundation for a single design system because it allows all pages to inherit the same theme state while preserving the project’s existing Angular architecture.

The shared variables are managed in:

- `src/styles.scss`

The design tokens include:

- background and surface values
- primary and accent colors
- text and muted text levels
- borders and shadows
- contrast-safe dark/light mode values

## 4. Implementation order

1. Stabilize the global theme source of truth.
2. Refine the dashboard shell and home screen.
3. Update admin auth and administrative screens to use the same theme tokens.
4. Re-check high-traffic student pages: order flow, settings, profile, support, quizzes.
5. Validate build and route stability.
6. Record the status honestly in the implementation report.

## 5. Verification targets

- Angular production build should pass.
- Shared styling should compile without Sass errors.
- Route inventory should remain intact.
- Theme variables should be readable in both light and dark states.
- Browser-based test configuration should be installed if the project intends to run `ng test` with a browser target.

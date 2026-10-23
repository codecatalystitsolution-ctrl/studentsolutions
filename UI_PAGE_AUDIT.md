# UI Page Audit: Phase 2

The route table uses a single student shell and keeps admin routes ahead of the wildcard fallback. Production authentication and `adminGuard` remain active. Protected page screenshots were captured from the separate `visual-test-auth` build, which uses only synthetic in-memory identities/data and the real route table/components.

Every route below was rendered in Chromium and captured at desktop size in both themes. The access/redirect suite and test results are detailed in [UI_IMPLEMENTATION_REPORT.md](UI_IMPLEMENTATION_REPORT.md); per-image links are in [UI_EVIDENCE/README.md](UI_EVIDENCE/README.md).

| Route | Access | Render | Light | Dark | Tested interaction | Responsive |
| --- | --- | --- | --- | --- | --- | --- |
| `/login` | Public PASS | PASS | PASS | PASS | Theme toggle/reload PASS | Desktop/mobile PASS |
| `/login-support` | Public PASS | PASS | PASS | PASS | Submit NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/register` | Public PASS | PASS | PASS | PASS | Theme toggle/reload PASS | Desktop/mobile PASS |
| `/dashboard` | Test student PASS; redirects to home | PASS | PASS | PASS | Shared theme PASS | Desktop PASS; mobile via home PASS |
| `/dashboard/home` | Test student PASS; anonymous redirect PASS | PASS | PASS | PASS | Logout/relogin PASS | Desktop/mobile PASS |
| `/dashboard/profile` | Test student PASS | PASS | PASS | PASS | Edit/cancel PASS | Desktop PASS; mobile NOT TESTED |
| `/dashboard/settings` | Test student PASS | PASS | PASS | PASS | Settings mutations NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/dashboard/quizzes` | Test student PASS | PASS | PASS | PASS | Quiz launch PASS | Desktop PASS; mobile NOT TESTED |
| `/dashboard/quiz-player` | Test student PASS | PASS | PASS | PASS | Answer/submission NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/dashboard/my-orders` | Test student PASS | PASS | PASS | PASS | Orders rendered; mutations NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/dashboard/my-tickets` | Test student PASS | PASS | PASS | PASS | Ticket list rendered | Desktop PASS; mobile NOT TESTED |
| `/dashboard/help-support` | Test student PASS | PASS | PASS | PASS | FAQ expand PASS; submit NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/new-order` | Test student PASS; anonymous redirect PASS | PASS | PASS | PASS | File type step PASS; submit/payment NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin-login` | Public PASS | PASS | PASS | PASS | Theme toggle/reload PASS | Desktop PASS; mobile NOT TESTED |
| `/admin` | Test admin passes production guard | PASS | PASS | PASS | Shared shell rendered | Desktop PASS; mobile via dashboard PASS |
| `/admin/dashboard` | Test admin PASS; anonymous redirect PASS | PASS | PASS | PASS | Logout/relogin PASS | Desktop/mobile PASS |
| `/admin/orders` | Test admin PASS | PASS | PASS | PASS | Search/clear PASS; mutations NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/students` | Test admin PASS | PASS | PASS | PASS | Search filter PASS; status mutation NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/students/:uid` | Test admin PASS | PASS | PASS | PASS | Detail actions NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/teachers` | Test admin PASS | PASS | PASS | PASS | Table rendered; filters NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/teachers/:uid` | Test admin PASS | PASS | PASS | PASS | Detail actions NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/delivery` | Test admin PASS | PASS | PASS | PASS | Table rendered; filters NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/delivery/:uid` | Test admin PASS | PASS | PASS | PASS | Detail actions NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/order-details` | Test admin PASS | PASS | PASS | PASS | Details rendered; search NOT TESTED | Desktop PASS; mobile NOT TESTED |
| `/admin/complaints` | Test admin PASS | PASS | PASS | PASS | Reply/status mutations NOT TESTED | Desktop PASS; mobile NOT TESTED |

## Screenshot and Browser Diagnostics

`UI_EVIDENCE/README.md` indexes 54 real Chromium screenshots: 25 route entries in each desktop theme plus 4 mobile captures (login, registration, student dashboard, admin dashboard). `verification.json` records theme persistence, selected interactions, horizontal overflow, console errors/warnings, failed requests, and page errors. The capture run reported zero page errors, zero console warnings/errors, and zero failed requests.

The visual build never contacts Firebase. It provides synthetic fixture records and the test-only identity through a separate Angular bootstrap/config. It does not alter production authentication. Visual captures show rendered fixture states; actual Firebase integration and payment/provider behavior remain out of scope for this verification.

## Theme and Tooling

`ThemeService` restores persisted theme on initial app load and updates body classes across direct URLs and internal navigation. Light and Dark captures were reviewed for all 25 desktop routes. Component-specific light-mode fixes address visible auth, order/support, table, and detail-page contrast issues. Only the four listed routes were captured at mobile size.

App/spec type checks, jsdom tests (21 files/51 tests), Chromium tests (21 files/51 tests), production build, and the `visual-test-auth` build pass. Lint remains NOT CONFIGURED: there is no lint script or ESLint setup. See the implementation report for the Firebase/Vitest root cause and remaining dependency compatibility risk.

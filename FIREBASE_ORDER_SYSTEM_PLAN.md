# Firebase Order and Delivery System: Repository Audit and Phased Plan

## Repository findings (2026-10-20)

- The application is Angular 21 with AngularFire 20 / Firebase JS 12 dependencies.
- Firebase Authentication and Realtime Database are initialized from `src/environments/environments.ts`, project `filecrafters-258e6`.
- The app does not initialize Cloud Firestore or Cloud Functions. Firebase Storage is now initialized for private order file uploads.
- Local `firebase.json` and `database.rules.json` now define a restrictive Realtime Database baseline, and the database emulator is configured for local testing. These local rules have not been deployed; the current production rules remain unknown.
- `storage.rules` now restrict student uploads to their UID path (PDF, 1 MiB maximum) and admin-created deliverables to allowlisted admins (PDF/ZIP, 10 MiB maximum). File reads are limited to the path owner or allowlisted admins.

## Current persisted shapes observed in source

### `users/{authUid}`

Registration writes `role`, `fullName`, `email`, `phone`, `whatsapp`, `address`, `pincode`, `status`, and `createdAt`. Students additionally write student/academic fields and `studentID`; older code also created Teacher/Delivery profiles. Self-registration UI, service, and local rules now restrict new self-created profiles to Student; admin workflows still need a reviewed provisioning/approval path for staff. Admin access in local RTDB rules is based on Firebase-authenticated allowlisted email claims; this needs production identity review before deployment.

### `orders/{pushId}`

Student order creation writes `uid`, `studentID`, `fileType`, `projectDetails`, `printSettings`, `pricing`, `uploadDetails`, `paymentDetails`, `requestedPricing`, `status`, and `createdAt`. Student pricing is stored as a non-authoritative estimate; canonical total/advance values are initially zero. New uploads are validated as PDFs and stored in private Storage; RTDB receives only metadata and object paths. Local rules reject new Data URL file payloads. Admin order screens read new Storage paths through the authenticated SDK; legacy Data URL downloads remain for historical records. Student order pages query by UID, while admin pages read the whole node under the allowlisted admin rule.

### `complaints/{pushId}`

Student ticket submission writes contact fields, `uid`, `studentID`, `createdAt`, and a pending status. Student ticket pages now query by UID. Admin replies and status changes update the complaint record; there is no reply history or audit log.

### Missing domain records

No referral attribution/codes, quotations, payment history, refunds, delivery assignments/status history/proof, app pricing catalog, notifications, or audit records were found. The delivery module currently manages user profiles only. Teacher management currently manages user profiles only.

## Security and compatibility blockers

1. A frontend route guard cannot protect Realtime Database paths. Local rules exist and are emulator-tested, but production rules are unknown and have not been deployed.
2. Realtime Database rules are not query filters. Student order/ticket reads now use owner-scoped queries; all other readers/writers still require review against the rules before deployment.
3. Student cancellation now creates an owner-checked request record rather than changing the order status. Payments are still represented inside the order and require a separate payment ledger/manual verification module.
4. New self-registration is now student-only. Teacher/delivery approval, provisioning, role-specific dashboards and granular access remain incomplete.
5. Existing historical Data URLs have not been migrated or removed. Production Storage activation/rules deployment and bucket CORS behavior have not been verified. Storage Rules cannot query RTDB, so they cannot prove an order exists or check a user's RTDB account status/role; a signed-in owner can create private orphan uploads under their own UID. Per-file size limits contain but do not eliminate that cost risk. A trusted backend/custom-claim provisioning path is needed for stronger status checks and staff access.
6. No trusted backend is configured. Server-authoritative prices, user provisioning, push delivery, and other privileged operations cannot be made tamper-proof with frontend code alone. This plan does not introduce Cloud Functions.

## Phased implementation

### Phase 1 — Inspection and baseline (complete)

Inventory routes, Firebase initialization, roles, current data writers/readers, existing tests, and build. Preserve Realtime Database and existing routes. No live database/rules changes.

### Phase 2 — Data contract and security boundary (core local baseline complete; broader paths outstanding)

Define compatible typed records, administrator identity policy, and restrictive Realtime Database rules. Add a Firebase configuration that points to local rule files without deploying them. Convert student order/ticket reads to UID-scoped queries and specify required indexes. Add emulator-backed rule tests only if the Firebase Emulator Suite can be run. Do not weaken rules to accommodate client-side filtering.

### Phase 3 — Identity and role approval (student-only registration and route guard implemented; staff approval outstanding)

Self-registration is restricted to Student by the UI, AuthService, and local RTDB rules. A route guard allows active Student profiles and the existing allowlisted Admin identities into student routes; pending or unrelated roles are redirected to login. Teacher/delivery provisioning and approval remain outstanding. Local RTDB admin authorization uses an allowlist of signed Firebase email claims; production identity policy still needs review.

### Phase 4 — Private file storage (local implementation and emulator tests complete; production activation outstanding)

Initialize Firebase Storage, move new student PDFs to UID-scoped paths, store only metadata/path in RTDB, allow authenticated downloads for owner/admin, and test MIME/size/ownership restrictions with Storage and RTDB emulators. Keep old Data URL records readable until an explicit migration is planned. This phase is implemented locally; do not deploy until the bucket, CORS, allowlisted administrator identity, and legacy-file migration are reviewed.

### Phase 5 — Orders and quotations

Keep order lifecycle separate from payment/project/delivery states. Student creates a requirements request; admin issues a validated quotation snapshot; student accepts/rejects; cancellation becomes a request. Validate permissions and transitions in rules where expressible.

### Phase 6 — Pricing and projects

Introduce an admin-managed catalogue with a price snapshot per quotation. Add preparation, internal notes, quality checks, revisions, and final-file workflows. Keep internal notes inaccessible to student/delivery queries.

### Phase 7 — Referrals

Add immutable referral attribution at registration, unique non-secret codes, privacy-safe teacher summaries, and manual commission review/payout records. Prevent self-referrals and duplicate attribution.

### Phase 8 — Delivery

Add admin-owned assignments and a delivery-agent view scoped to the authenticated agent. Separate physical delivery from digital completion. Capture attempts and proof without exposing unrelated orders.

### Phase 9 — Payments, support, notifications, audit

Keep payment pending until manual admin verification. Add payment/refund records, ticket reply history, in-app notifications, and audit entries. No card credentials or push-sending backend are introduced.

### Phase 10 — Responsive/accessibility and verification

Finish responsive tables/forms, loading/error/empty states, permission checks, unit tests, emulator rules tests, production build, and real authenticated browser workflows. Report any external Firebase deployment/configuration that remains user-owned.

## Checks run

- `npm run test -- --watch=false`: 21 test files and 53 tests passed, including PDF signature checks.
- `npm run build`: passed; the prior `new-order.component.scss` budget warning is resolved by removing duplicated legacy layout rules (budget was not increased).
- `firebase emulators:exec --only "database,storage" --project demo-filecrafters "node scripts/test-rtdb-security.mjs"`: passed. Coverage includes owner isolation, student-only self-registration, price and Data URL protections, cancellation ownership, Storage owner/admin access, cross-user denial, MIME/size limits, and denied student writes to project deliverables. This is local evidence only and does not prove deployed rules match.
- `git diff --check`: passed with no whitespace errors. Git emitted LF-to-CRLF conversion notices for working-tree files.
- No Cloud Functions were created, configured, deployed, or added as a dependency.

## Implementation progress (2026-10-20 continuation)

This section records the current implementation beyond the original repository audit above. The original findings remain as the baseline snapshot.

### Completed locally

- Quotations: allowlisted admins append quotation versions, students can approve or reject only the current version for their own order, and prior versions/decisions remain visible.
- Payments and refunds: students submit payment references against an approved current quote; only admins can manually verify/reject a payment, review a refund, or mark a verified payment refunded after external processing. Dashboard revenue now counts verified ledger payments only. The legacy payment-status selector in Manage Orders is removed; admins open the ledger to review payment records.
- Delivery: admins assign active delivery agents, the delivery workspace queries only the signed-in agent's assignments, and students/admins/assigned agents can view scoped status history. Rules constrain agent status transitions and immutable assignment fields.
- Support: admin and student replies are individual append-only records with ticket ID, actor UID/email/role, message, and server timestamp. Owners and admins can read the relevant thread. A student follow-up reopens a resolved ticket as In Progress; tickets with reply history cannot be deleted.
- Teacher referrals: admins create unique teacher referral codes. Student registration accepts an optional code and creates an immutable one-time attribution. Teachers can view their own attribution and commission ledger.
- Commissions: an admin can manually record a commission only against a referred student's order and a verified payment. Statuses are pending, approved, rejected, and manually marked paid after external payout. Amounts are not calculated or paid automatically by the client.
- Notifications and audit: an authenticated user's inbox is readable only by that user; only admins create notification records, and users can only mark their own records read. Admin actions append scoped notification and audit entries. Module-specific histories remain the source for student/agent actions.
- Role workspaces: login routes active teachers to `/teacher/referrals` and active delivery agents to `/delivery-portal`; route guards and database rules both enforce role boundaries.
- Storage and the earlier responsive/theme work remain in place. Historical Data URL uploads have not been migrated or removed.

### Security and operational limits

- No trusted backend was added. Payment verification remains an administrator's manual comparison with external provider records; a client-side status is not proof of received funds. Commission amount entry/approval and external payout remain manual administrator actions.
- The app sends best-effort inbox notifications for administrator actions such as quotations, payment/refund decisions, delivery assignment, support replies, and commission decisions. Student-submitted orders/payments/refund requests and delivery-agent status updates cannot securely create notifications in another user's inbox from client code. Reliable automatic notification delivery and tamper-resistant cross-role audit events require a trusted backend; Cloud Functions remain excluded.
- `auditEvents` is append-only under the local rules and captures the authenticated administrator identity, but an authorized administrator can still fabricate an event from the client. It is not a trusted, tamper-proof financial ledger. Quotation/payment/delivery timestamps still use client-generated ISO values in existing workflow services; their actor/status rules are enforced separately.
- Student self-referral is prevented for the same UID. The app cannot identify the same person using a separate account. A referral write failure after Firebase Auth/profile creation can leave the new account created without attribution; the user is told to contact support.
- Delivery assignment updates and their first history append are separate client writes. A network failure between those writes can leave an assignment without its initial event; delivery state itself remains protected by database rules.
- Storage rules do not prove that an order exists or that an account is active. Students can still create private orphan uploads in their own UID path. Existing Data URL records remain readable in legacy order flows; migration/cleanup needs a separate review and explicit approval.
- `database.rules.json` and `storage.rules` are local emulator-tested files only. Production rules, Storage activation, CORS, admin identity allowlist, existing production data compatibility, and any migration have not been verified or deployed.

### Latest verification

- `npm run test -- --watch=false`: 21 test files and 57 tests passed.
- `npm run build`: passed without component stylesheet budget warnings.
- `firebase emulators:exec --only "database,storage" --project demo-filecrafters "node scripts/test-rtdb-security.mjs"`: passed. Coverage includes owner/cross-user/anonymous isolation, staff role restrictions, quotation and payment/refund transitions, delivery assignment and agent transitions, support-thread ownership/immutability, referral-code/attribution restrictions, commission eligibility/transitions/history, notification read ownership, audit append-only writes, and Storage owner/admin/type/size checks.
- `git diff --check`: passed on the existing working tree; Git reports LF-to-CRLF conversion notices for some files.
- No Cloud Functions were added and no production deployment was performed.

## Remaining security gaps follow-up (2026-10-20)

This follow-up supersedes the earlier broad statements above for the specific areas below. It records only work performed in the local checkout and emulator; it does not assert that deployed production rules or data match this repository.

### Payment verification and refunds

- Student payment submissions now use one deterministic record path per order and quotation version (`{orderId}_{quoteVersionId}`). The local Realtime Database rules reject a second creation at that path, including a duplicate submission race. A rejected payment is terminal for that quote version; another attempt needs a newly issued quote version. Refund requests are also one record per payment ID.
- Payment submission evidence (the student's transaction reference and optional UPI ID) remains separate from the administrator's verification decision. Admin verification/rejection requires a non-empty decision note; the record stores actor/time/note fields and an append-only decision history event. Students and delivery agents cannot set those fields or change financial status.
- Refund approval/rejection stores a separate reviewer, timestamp, and decision note. `refundProcessing/{paymentId}` records the administrator-reported external outcome, provider/bank reference, actor, time, and note; each processing attempt is represented in `refundProcessingHistory`. A payment moves to `refunded` only after the refund request is approved and a processed outcome with an external reference is recorded. A failed processing outcome leaves the payment verified.
- Payment status plus payment history and refund decision plus refund history are written as multi-location updates. Refund processing summary and history are two writes because the local history rule requires the summary record to exist first. Commission creation and its initial history event have the same two-write constraint. A network failure between either pair can leave the summary without its first history entry; the summary still contains its actor/time/note, but recovery should be reviewed and recorded manually. Later status/history updates are atomic where the existing rules permit them.
- An administrator's “verified” or “processed” entry is still a human assertion, not a provider-confirmed fact. Reconciliation with the payment provider and executing an actual refund remain manual. Dashboard revenue reads only payment records whose current status is `verified`; refunded and rejected records are excluded.
- Duplicate ledger rows for the same quote version/payment ID are rule-blocked. The current design does not provide a global uniqueness index for a transaction reference reused on a different quote/order; administrators must check provider references during manual verification. A trusted backend would be needed for an authoritative cross-record deduplication/reservation workflow without imposing restrictive client-side reference formats.

### Commission calculation and manual decisions

- Eligibility in the admin workflow is: an immutable student-to-teacher referral attribution exists, the order belongs to that student, and exactly one payment for the order is currently manually verified. The administrator enters a rate for that record from 0.01% through 100%, in increments of 0.01 percentage points. The client preview formula is `verified payment amount × entered rate ÷ 100`, rounded half-up to the nearest INR 0.01. A rounded result below ₹0.01 is rejected. The saved snapshot records the base amount, rate, proposed amount, formula version, and rounding policy.
- The commission ID is the payment ID, so the same verified-payment event cannot receive a second commission. Local rules bind the snapshot to that payment amount, validate the allowed formula/range/precision, reject duplicate IDs, and keep snapshot values immutable after creation. The client-computed amount is still not a tamper-proof or authoritative financial calculation: an authorized admin can create an allowed rate/snapshot, so admin policy review remains required.
- A required admin note accompanies creation, approval/rejection, and the manually recorded external payout outcome. Only an authorized admin can change commission status; teachers can read their own attribution/commission/history but cannot edit amount, rate, eligibility, decision, or payout fields. “Paid” records an admin-reported external transfer; the application does not initiate or verify payouts.
- No commission policy/rate is configured as a business-wide constant. The entered per-record rate is the calculation input until the organization formally chooses a policy. No payout credentials or automated payout code are present.

### Notifications and audit integrity

- Local rules restrict notification reads and read/unread changes to the recipient. Only allowlisted admins can create notifications, with actor identity matching the authenticated admin, an active recipient, an allowed event type, and an allowlisted route. Tests cover cross-user/anonymous reads, user-authored events, admin actor spoofing, invalid routes, and missing recipients.
- Notification history is retained in Realtime Database. Existing admin-client notifications are best-effort; student and delivery actions cannot securely create another user's inbox entry. Reliable automatic cross-role notification delivery, push delivery, and a trusted statement that an event actually happened require a trusted backend. No Cloud Functions were introduced.
- Scoped payment/refund/commission/delivery/support histories keep actor IDs, event type, timestamp, record reference, and notes where the current schema supports them. `auditEvents` is admin-readable, admin-authored, and append-only under local rules. These are client/admin-authored records, not tamper-proof evidence: a permitted administrator can fabricate an event, and a failed follow-up write can leave a summary/history pair incomplete. Rules deny ordinary users cross-scope access or history edits, but do not establish a trustworthy append-only audit trail. That guarantee requires a trusted backend or an independently controlled external log.

### Historical Data URL upload migration

- Code inspection found the two remaining legacy shapes read by the order screens: `orders/{orderId}/uploadDetails/files[]/dataUrl` and `orders/{orderId}/uploadDetails/uploadedFileDataUrl`. New orders use private Storage paths. No production export or private production records were inspected, so the number of affected orders/files is unknown.
- `scripts/local-upload-reconciliation.mjs --input <local-database-export.json>` is a dry-run inventory tool. It supports those shapes, verifies a PDF signature and the current 1 MiB limit, reports missing owners/malformed/oversized files, hashes content for duplicate detection, and proposes UID/order-scoped destinations. Its report omits Data URL bytes. Treat the local export and manifest as private because they contain UIDs, order IDs, file names, sizes, and content hashes. The script uploads, updates, and deletes nothing.
- Safe migration procedure: obtain an approved encrypted export; run the dry-run tool; verify each `order.uid` and source locator against the same export; resolve duplicate hashes and invalid/oversized records manually; upload each file under `student-uploads/{uid}/{orderId}/...` with owner/order metadata using an explicitly approved privileged migration procedure; read the object back and compare size/hash; then update the original file entry to `storagePath` while retaining a protected backup of the old record. Resume by comparing destination path/hash receipts and skip already verified objects. Do not remove the embedded Data URL until all references and downloads pass review.
- Current Storage Rules do not grant admins writes into student upload paths, and client rules cannot establish the order record during migration. A safe production migration therefore needs a separately approved, controlled privileged operation; this repository does not implement or run one. Rollback is to restore the protected original order fields, verify the old download path, and retain or separately review the new object. Delete a migrated object only after confirming UID/order ownership and that no order reference still points to it.

### Private upload orphan risk and manual reconciliation

- New-order uploads happen before the order record is written. Storage Rules cannot query Realtime Database to prove the order exists, so a timeout, expired session, or failed order write can leave an unreferenced private object. Student deletion is denied, including immediately after upload, because a client cannot distinguish an unreferenced upload from a file already attached to an order. The order form reports that support/admin reconciliation may be required after a failed submission.
- `reconcileUploadReferences(uid, storagePaths, orders)` in `scripts/local-upload-reconciliation.mjs` is synthetic/local dry-run logic. It compares a supplied object listing with `storagePath` references only for that UID, reports linked objects, missing objects, invalid cross-owner/order references, and unreferenced deletion candidates, and performs zero deletes. It does not connect to Firebase or enumerate production Storage.
- Manual procedure: an authorized operator obtains a scoped Storage object listing and matching order metadata, runs reconciliation offline, reviews each candidate against the order UID, order ID, upload time, and any active upload attempt, then deletes only confirmed orphans through an authorized Storage admin workflow. Keep an action receipt and re-run the listing after cleanup. Never treat “no matching RTDB reference in an incomplete export” as proof that an object is orphaned. Student upload paths are admin-delete only; no automatic client delete path was added.

### Follow-up verification and remaining limits

- `npm run test -- --watch=false`: **22 test files, 59 tests passed** after the financial/UI changes.
- `npm run build`: **passed** after the financial/UI changes; no stylesheet budget increase was made.
- `npm run test:upload-reconciliation`: **3 synthetic tests passed** for both legacy shapes, invalid/missing/oversized inputs, duplicate hashes, owner-scoped paths, missing references, and zero-delete behavior.
- `$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"; npx firebase emulators:exec --only "database,storage" --project demo-filecrafters "node scripts/test-rtdb-security.mjs"`: **passed** on the local database and Storage emulators. Coverage includes student/teacher/delivery/admin role restrictions; owner/cross-user/anonymous reads; duplicate/invalid payment and refund states; required financial decision fields; duplicate and invalid commission snapshots; notification recipient/actor/read privacy; append-only audit/history checks; and Storage owner/admin/type/size rules. Expected denied requests appear as emulator permission warnings.
- JSON parsing for `database.rules.json` and `package.json`: **passed**. `git diff --check`: **passed** (Git prints its existing LF-to-CRLF notices for working-tree files).
- Authenticated browser testing: **NOT RUN**. A shared localhost login tab is available, but no dedicated emulator test credentials were provided or created; no production account was used.
- Production rules/configuration, the live Storage bucket, production Data URL count, migration, orphan enumeration/cleanup, and provider/bank payment/refund/payout records remain unverified. No production migration, deployment, or rules deployment was performed.
- No Firebase Cloud Functions were added or used.

## Final security review and workflow verification (2026-10-20)

This review is scoped to the working checkout and local synthetic emulator data. It preserves the prior UI/evidence and does not claim the repository's local Firebase rules match production.

### Multi-write workflow inventory and recovery

| Workflow | Writes and failure window | Retry/reconciliation behavior |
| --- | --- | --- |
| Student payment submission | One Realtime Database creation at `payments/{normalizedTransactionReference}`. The key is uppercase and restricted to 1–200 ASCII letters, digits, `_`, or `-`. | Repeating the same submission with the same order, quote, UPI ID, and reference is treated as a retry; a different payment using the same reference is rejected. Rules enforce the key/payload match and one record across orders/quotes. A student can still reserve someone else's reference, so an admin must compare it with provider records. |
| Payment verify/reject/refund ledger transition | The payment summary and its fixed decision-history entry are one multi-location RTDB update. | If the client loses the acknowledgement after commit, retry reads the status and fixed event key and returns idempotently. If the summary/event pair was written by an older client separately, an admin retry can add a missing summary event. Rules block duplicate history keys and invalid transitions. |
| Refund request and admin approval/rejection | Refund request is one write at `refunds/{paymentId}`. The decision fields and fixed `refundHistory/{paymentId}/decision_{status}` event are one multi-location update. | Duplicate request is idempotent for the same owner/reason and refused for different details. Admin retries recover a missing fixed decision event or accept a fully committed status/event pair. Students and delivery agents cannot write review or processing fields. |
| External refund outcome | The admin-authored `refundProcessing/{paymentId}` summary stores a `historyEventId`, then its history event is appended separately. The payment's final `refunded` state and payment history are a separate atomic multi-location update. | A retry repairs the event at the stored ID before continuing. Rules prevent changing outcome state to `processed` while the previous failed outcome has no history event. Duplicate retries after `processed` do not create another processing outcome; they only finish a missing final payment-ledger transition. The provider/bank operation itself remains external and manual. |
| Commission creation | The commission summary stores a generated `creationHistoryId`; the initial history record is a second write. | A repeat with the same order, teacher, rate and memo finds the existing commission and repairs the initial history entry. Rules bind the commission key to its payment ID and keep the history key/snapshot immutable. A different commission for that payment is refused. |
| Commission approval/rejection/payout outcome | Each status/actor/time change and fixed `commissionHistory/{id}/transition_{status}` event are one multi-location update. | Retries with the already-recorded status are idempotent and can repair a missing history entry. A status write that fails validation of the event is atomic and leaves the record unchanged. “Paid” is an admin report of an external payout, never proof or execution of the transfer. |
| Delivery assignment and status | Assignment/status summary is written first with the fixed latest history-event ID, status, actor, note and timestamp. The matching `deliveryHistory` entry is a second write. | Retrying an assignment to the same agent, retrying the same status, or making the next transition first repairs the saved event. Legacy assignments with no snapshot get an explicit “legacy history reconciled” event before another state transition. Status plus note/actor/event snapshot are updated together. Reassignment first reconciles the previous assignment event. A privileged direct rewrite that bypasses these services can still replace the one-event recovery snapshot; that requires manual review. |
| Teacher self-registration/referral | Firebase Auth account creation, user profile creation and referral attribution are three separate operations. | No atomic transaction spans Auth and RTDB. Failure after Auth creation may leave an account without its profile; failure after profile creation may leave a student without attribution. The current UI asks the student to contact support; an admin must reconcile the account/attribution. |
| Student order with private files | Storage uploads happen before the single order-record write. Catch cleanup uses `Promise.allSettled` and may itself fail after a timeout/session expiry. | No transaction spans Storage and RTDB. Reconciliation remains a scoped dry run and manual review; orphaned private objects are never automatically deleted. |
| Admin quotation version/current pointer | Quotation version is written before `currentVersionId`. A failure on the pointer write leaves an unreferenced version. | Version history remains visible and an admin can review/reissue the current quote manually. There is no automatic pointer repair because a later version could have been intentionally issued concurrently. |
| Notifications and audit | Workflow summary/history is committed first; best-effort notification and admin audit writes happen afterward. | Failure or retry can omit a notification/audit event. These are not part of the financial/delivery state transaction and are not evidence that an external event occurred. Reliable delivery and tamper-resistant logging need a trusted backend. |

### Authorization and data-integrity review

- Realtime Database rules deny anonymous access to protected paths, scope student orders/payments/refunds/tickets and delivery tracking to their owner, scope teachers to their referral/commission records, and scope delivery queries and writes to the assigned active agent. Local rules tests exercise cross-user reads and attempted role/field escalation.
- Allowlisted admin email claims are the local admin authorization source; routes and UI checks are supplemental. Payment verification, refund decisions, commission decisions and payout status changes are rule-protected, not UI-only. A teacher cannot write a commission or payment decision, including the teacher's own records. Any account whose token email is on the admin allowlist is an admin by this policy, regardless of its profile label; production identity policy still needs review.
- Storage rules scope student files to `student-uploads/{uid}/{orderId}/...`, constrain size and MIME type, and permit deliverables only to allowlisted admins. Storage Rules cannot verify that an RTDB order exists, that its account is active, or that the file is referenced by an order. Private orphan uploads therefore remain possible.
- Source scan found no Firebase Cloud Functions dependency, service-account private key, or client payout/provider credential. The Firebase web API key in the environment config is a public client identifier, not a service-account secret. No production config was changed.
- The unified admin audit stream and per-workflow histories remain client/admin-authored records. Append-only rules prevent ordinary users from altering them, but a permitted admin can fabricate entries and client-side timestamps are not trusted timestamps.

### Tests and browser evidence

- `npm run test -- --watch=false`: **23 test files, 61 tests passed**.
- `npm run build`: **passed**; no stylesheet budget was raised.
- `$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"; npx firebase emulators:exec --only "database,storage" --project demo-filecrafters "node scripts/test-rtdb-security.mjs"`: **passed** on a freshly started local Database and Storage Emulator. Coverage includes owner/cross-user and anonymous reads; role escalation; duplicate payment IDs and transaction references across quotes; financial decision notes/transitions; failed second history writes and retry gates; duplicate commission records and immutable snapshots; notification/audit privacy; delivery owner/field/transition restrictions, append-only event IDs and failed-history recovery; Storage ownership, MIME and size rules.
- `npm run test:upload-reconciliation`: **4 synthetic tests passed** for Data URL shapes, malformed/oversized PDFs, duplicate content hashes, missing owners/objects, foreign paths, invalid UID scope and zero-delete behavior.
- `npm run test:role-browser`: **passed** with temporary Auth-emulator users and synthetic Database-emulator records. Chromium opened the real Angular app and verified Student dashboard/orders, Teacher referral-code display, Delivery assignment/pickup plus tracking note, and Admin dashboard. The test removes its synthetic accounts and records in `finally`. It does not exercise payment-provider verification, a real refund/payout, or commission approval in a browser.
- Database/package JSON parsing: **passed**. `git diff --check`: **passed** (Git emits existing line-ending conversion notices).
- The app logs AngularFire's development warning about Firebase calls outside an injection context during these browser flows; no uncaught browser errors occurred in the final run. The delivery status form now retains notes on failure, updates its saved status/history snapshot, and displays the committed tracking event.

### Remaining manual operations and backend-dependent guarantees

- Admins must compare transaction references to provider records before marking a payment verified. The client cannot prove a payment happened, prevent a user from reserving another person's reference, or verify a refund/provider settlement.
- Admins choose a commission rate per eligible record, review its saved base/rate/formula/rounding snapshot, approve/reject it, then manually make and confirm any external payout. No authoritative organization-wide commission policy is configured.
- Referral/account reconciliation after partial registration, recovering an unreferenced quotation version, confirming missing audit/notification events, and checking old delivery/upload records remain admin/manual procedures.
- Reliable automatic cross-user notifications, push delivery, server-authoritative quote/payment/commission calculations, provider payment verification, actual refunds/payouts, tamper-resistant append-only audit, atomic Auth/profile/referral provisioning, and global idempotent reconciliation require a trusted backend. None was added.
- Historical Data URL counts, production Firebase rules/configuration, production Storage CORS/activation, real account role assignments, production backups, and any production migration/cleanup were not inspected or performed.
- Authenticated browser checks used only emulator accounts. No production account/data was accessed.
- No Cloud Functions were added or used; no application deployment, Firebase rules deployment, production migration or production cleanup was performed.

## Senior developer recheck (2026-10-21)

This pass reviewed the current Angular/Firebase checkout and fixed six confirmed defects:

1. The new-order form collected payment details before quotation approval and wrote them into `orders.paymentDetails`, bypassing the protected payment ledger. It now submits only an order marked `Awaiting Quotation`; students submit payment evidence from My Orders after approving the current quotation. Admin-created orders now use the same initial status. The form no longer advertises a 50% advance that the ledger did not support.
2. An administrator could replace a delivery assignment after its tracking status was `delivered` if the related order status had not yet synchronized. The service and Realtime Database rule now reject reassigning delivered assignments; a local rules regression test covers this.
3. Students could delete a private upload during the two-minute post-upload window, including after an order referenced the file. Student delete permission is removed. Cleanup after a failed order write now requires administrator reconciliation; the UI explains that possibility.
4. Student order rules rejected the legacy top-level `uploadedFileDataUrl` but accepted nested `uploadDetails.files[].dataUrl` records and oversized/extra file metadata. Local rules now reject nested Data URLs, enforce metadata types and per-file size limits, and permit only the three file slots supported by the UI. Admin legacy records remain readable and admin access can preserve them.
5. The new-order submit control triggered Angular's `ExpressionChangedAfterItHasBeenCheckedError` while its loading state changed around navigation. The loading guard now prevents duplicate submits in code without binding a rapidly changing disabled property; a successful order stays in the submitted state while navigating away.
6. An order write whose acknowledgement was lost could be retried with a newly generated order ID, potentially creating a duplicate. The form now reuses a request fingerprint and order key from the current component/session, checks for an already-created owner order on retry, and recovers uploads by verifying immutable owner/order/size metadata. It skips the initial read for a brand-new order key because owner-scoped rules correctly deny reads of nonexistent records.

### Verification for this pass

- `npm run test -- --watch=false`: **23 test files, 61 tests passed**.
- `npm run build`: **passed**.
- `$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"; npx firebase emulators:exec --only "database,storage" --project demo-filecrafters "node scripts/test-rtdb-security.mjs"`: **passed**. New cases reject nested Data URLs, oversized and fourth-file metadata, post-delivery reassignment, and student deletion of a private upload; admin cleanup succeeds in the Storage emulator.
- `npm run test:upload-reconciliation`: **4 synthetic tests passed**.
- With the local Angular dev server at `127.0.0.1:4200`, `$env:JAVA_HOME='C:\Program Files\Java\jdk-21.0.12'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"; npx firebase emulators:exec --only "auth,database,storage" --project demo-filecrafters "node scripts/test-role-browser.mjs"`: **passed** for Student, Teacher, Delivery, and Admin. The student UI test submitted a new order and verified it waits for quotation approval and contains no unverified transaction fields. Delivery tracking was also updated through the UI. The test used synthetic emulator accounts/data and cleaned them up.
- Database, package, lockfile and Firebase JSON parsing: **passed**. `git diff --check`: **passed**; Git emitted only its existing LF-to-CRLF notices.
- Initial browser invocations either had no local app server or an intermediate implementation issue; the final authenticated run after starting/restarting the dev server passed. An initial rules draft used unsupported `numChildren`; the emulator rejected it before tests ran, and it was replaced with explicit file-slot validation before the passing rules run. An initial idempotency draft also tried reading a newly generated order key; owner-scoped rules correctly denied that nonexistent-record read, so the final code skips reads until a prior attempt may have committed.

### Remaining limits

- Private file uploads still occur before order creation, and Storage Rules cannot look up Realtime Database order references. A failed order write may leave an orphan. Students cannot delete these uploads; an authorized administrator must run the dry-run reconciliation and manually remove only confirmed orphans. No migration or cleanup was run.
- Retry identity is stored in session storage; if that storage is unavailable, the browser session is discarded, or the user changes order details after an ambiguous failure, automatic deduplication cannot cover every case. Check My Orders before manually repeating an order, and reconcile any unreferenced uploads.
- External payment verification, refund execution, and commission payouts remain manual and require provider/bank evidence. The UI and client cannot prove those external actions occurred.
- Trusted server operations are still needed for authoritative pricing/commission decisions, atomic provisioning across Auth and RTDB, reliable cross-user/push notifications, and tamper-resistant audit events.
- Production rules/configuration, production accounts/data, Storage bucket activation/CORS, historical Data URL counts, migration, and cleanup remain unverified. No deployment, production migration, or Cloud Function was performed.

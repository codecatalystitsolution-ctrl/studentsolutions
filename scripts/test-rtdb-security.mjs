import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { equalTo, get, limitToFirst, orderByChild, query, ref, remove, set, update } from 'firebase/database';
import { deleteObject, getBytes, ref as storageRef, uploadBytes } from 'firebase/storage';
import assert from 'node:assert/strict';

const env = await initializeTestEnvironment({
  projectId: 'demo-filecrafters',
  database: { host: '127.0.0.1', port: 9000, rules: await readFile('database.rules.json', 'utf8') },
  storage: { host: '127.0.0.1', port: 9199, rules: await readFile('storage.rules', 'utf8') }
});

const admin = env.authenticatedContext('rules-admin', { email: 'admin@filecrafters.in' }).database();
const studentA = env.authenticatedContext('student-a', { email: 'student-a@example.com' }).database();
const studentB = env.authenticatedContext('student-b', { email: 'student-b@example.com' }).database();
const teacher = env.authenticatedContext('teacher-a', { email: 'teacher-a@example.com' }).database();
const delivery = env.authenticatedContext('delivery-a', { email: 'delivery-a@example.com' }).database();
const anonymous = env.unauthenticatedContext().database();
const studentAStorage = env.authenticatedContext('student-a', { email: 'student-a@example.com' }).storage();
const studentBStorage = env.authenticatedContext('student-b', { email: 'student-b@example.com' }).storage();
const adminStorage = env.authenticatedContext('rules-admin', { email: 'admin@filecrafters.in' }).storage();

const users = {
  'student-a': { role: 'Student', status: 'active', email: 'student-a@example.com', studentID: 'FC-A12345', createdAt: '2026-10-20T00:00:00.000Z' },
  'student-b': { role: 'Student', status: 'active', email: 'student-b@example.com', studentID: 'FC-B12345', createdAt: '2026-10-20T00:00:00.000Z' },
  'teacher-a': { role: 'Teacher', status: 'active', email: 'teacher-a@example.com', employeeID: 'TEA-123456', referralCode: 'TEACHER-A', createdAt: '2026-10-20T00:00:00.000Z' },
  'delivery-a': { role: 'Delivery', status: 'active', email: 'delivery-a@example.com', employeeID: 'DEL-123456', createdAt: '2026-10-20T00:00:00.000Z' },
  'delivery-b': { role: 'Delivery', status: 'active', email: 'delivery-b@example.com', employeeID: 'DEL-654321', createdAt: '2026-10-20T00:00:00.000Z' }
};
const order = (uid, studentID) => ({ uid, studentID, status: 'Pending', fileType: 'assignment', createdAt: '2026-10-20T00:00:00.000Z', projectDetails: { submittedBy: 'Test Student', subject: 'Computer Science' }, printSettings: { pagesLabel: 'Up to 20 pages', binding: 'spiral', quantity: 1 }, pricing: { totalAmount: 0, advancePaid: 0 }, requestedPricing: { estimatedAmount: 250 }, uploadDetails: { selfUploaded: false }, paymentDetails: { status: 'Awaiting Quotation' } });
const complaints = {
  'ticket-a': { uid: 'student-a', name: 'Student A', email: 'student-a@example.com', subject: 'Help', message: 'Need support with my order', status: 'pending', createdAt: '2026-10-20T00:00:00.000Z' },
  'ticket-b': { uid: 'student-b', name: 'Student B', email: 'student-b@example.com', subject: 'Help', message: 'Need support with my order', status: 'pending', createdAt: '2026-10-20T00:00:00.000Z' }
};

try {
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), 'users'), users);
    await set(ref(context.database(), 'orders'), { 'order-a': order('student-a', 'FC-A12345'), 'order-b': order('student-b', 'FC-B12345') });
    await set(ref(context.database(), 'payments/rate-probe'), { uid: 'student-a', orderId: 'order-a', amount: 650, status: 'verified' });
    await set(ref(context.database(), 'complaints'), complaints);
  });
  await assertFails(get(ref(anonymous, 'orders')));
  await assertFails(get(ref(studentA, 'orders')));
  const ownOrders = await assertSucceeds(get(query(ref(studentA, 'orders'), orderByChild('uid'), equalTo('student-a'), limitToFirst(100))));
  assert.deepEqual(Object.keys(ownOrders.val()), ['order-a']);
  await assertFails(get(ref(studentA, 'orders/order-b')));

  await assertSucceeds(set(ref(studentA, 'orders/order-a2'), order('student-a', 'FC-A12345')));
  const studentWizardOrder = {
    ...order('student-a', 'FC-A12345'),
    projectDetails: { course: 'E2E Course', subject: 'E2E Subject', rollNumber: 'E2E-12345678', submittedTo: 'E2E Instructor', submittedBy: 'E2E Student', topic: 'Quotation first workflow', experimentDetails: 'N/A', specialInstructions: 'None' },
    printSettings: { pagesLabel: 'Up to 20 pages', binding: 'spiral', quantity: 1 },
    pricing: { printCost: 0, bindingCost: 0, uploadDiscount: 0, totalAmount: 0, advancePaid: 0 },
    requestedPricing: { estimatedAmount: 100, currency: 'INR' },
    uploadDetails: { selfUploaded: false, fileName: null, fileSize: null, note: 'No self-upload selected. Admin will prepare the file from scratch.' },
    paymentDetails: { status: 'Awaiting Quotation' }
  };
  await assertSucceeds(set(ref(studentA, 'orders/order-wizard'), studentWizardOrder));
  await assertFails(set(ref(studentA, 'orders/order-a2'), order('student-a', 'FC-A12345')));
  const manipulated = order('student-a', 'FC-A12345');
  manipulated.pricing.totalAmount = 500;
  await assertFails(set(ref(studentA, 'orders/order-a3'), manipulated));
  const embeddedFile = order('student-a', 'FC-A12345');
  embeddedFile.uploadDetails.uploadedFileDataUrl = 'data:application/pdf;base64,JVBERi0=';
  await assertFails(set(ref(studentA, 'orders/order-a4'), embeddedFile));
  const embeddedFileList = order('student-a', 'FC-A12345');
  embeddedFileList.uploadDetails = { selfUploaded: true, files: [{ name: 'legacy.pdf', sizeLabel: '8 B', size: 8, storagePath: 'student-uploads/student-a/order-a5/1-legacy.pdf', dataUrl: 'data:application/pdf;base64,JVBERi0=' }] };
  await assertFails(set(ref(studentA, 'orders/order-a5'), embeddedFileList));
  const oversizedFileMetadata = order('student-a', 'FC-A12345');
  oversizedFileMetadata.uploadDetails = { selfUploaded: true, files: [{ name: 'large.pdf', sizeLabel: '1 MB', size: 1048577, storagePath: 'student-uploads/student-a/order-a6/1-large.pdf' }] };
  await assertFails(set(ref(studentA, 'orders/order-a6'), oversizedFileMetadata));
  const tooManyFiles = order('student-a', 'FC-A12345');
  tooManyFiles.uploadDetails = { selfUploaded: true, files: Array.from({ length: 4 }, (_, index) => ({ name: `file-${index}.pdf`, sizeLabel: '8 B', size: 8, storagePath: `student-uploads/student-a/order-a7/${index}-file.pdf` })) };
  await assertFails(set(ref(studentA, 'orders/order-a7'), tooManyFiles));
  await assertFails(update(ref(studentA, 'orders/order-a'), { status: 'Delivered' }));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'In Progress' }));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'Printing' }));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'Delivered' }));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'Cancelled' }));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'Pending' }));
  await assertFails(update(ref(admin, 'orders/order-a'), { status: 'InvalidStatus' }));
  await assertFails(update(ref(admin, 'orders/order-a'), { status: 'in progress' }));
  await assertFails(update(ref(admin, 'orders/order-a'), { status: '' }));
  await assertFails(update(ref(admin, 'orders/order-a'), { status: 123 }));
  await assertFails(update(ref(admin, 'orders/order-a'), { status: true }));
  await assertFails(update(ref(studentA, 'orders/order-a'), { status: 'In Progress' }));
  await assertFails(update(ref(studentA, 'orders/order-a'), { status: 'Pending' }));
  await assertFails(set(ref(studentA, 'orders/order-a/status'), 'In Progress'));
  await assertFails(update(ref(anonymous, 'orders/order-a'), { status: 'In Progress' }));
  await assertFails(set(ref(anonymous, 'orders/order-a/status'), 'Delivered'));
  const cancellation = { uid: 'student-a', orderId: 'order-a', reason: 'No longer needed', status: 'pending', createdAt: '2026-10-20T00:00:00.000Z' };
  await assertSucceeds(set(ref(studentA, 'cancellationRequests/order-a'), cancellation));
  await assertFails(set(ref(studentA, 'cancellationRequests/order-a'), cancellation));
  await assertFails(set(ref(studentA, 'cancellationRequests/cancel-b'), { uid: 'student-a', orderId: 'order-b', reason: 'Wrong owner', status: 'pending', createdAt: '2026-10-20T00:00:00.000Z' }));
  await assertFails(update(ref(studentA, 'users/student-a'), { role: 'Admin' }));
  const staffApplicant = env.authenticatedContext('staff-applicant', { email: 'staff@example.com' }).database();
  await assertFails(set(ref(staffApplicant, 'users/staff-applicant'), { role: 'Teacher', status: 'active', email: 'staff@example.com', createdAt: '2026-10-20T00:00:00.000Z' }));
  await assertFails(set(ref(staffApplicant, 'users/staff-applicant'), { role: 'Delivery', status: 'pending', email: 'staff@example.com', createdAt: '2026-10-20T00:00:00.000Z' }));
  await assertFails(get(ref(studentA, 'complaints')));
  const ownTickets = await assertSucceeds(get(query(ref(studentA, 'complaints'), orderByChild('uid'), equalTo('student-a'), limitToFirst(100))));
  assert.deepEqual(Object.keys(ownTickets.val()), ['ticket-a']);
  await assertFails(get(ref(studentB, 'complaints/ticket-a')));
  await assertFails(set(ref(teacher, 'orders/teacher-order'), order('teacher-a', '')));
  await assertSucceeds(update(ref(admin, 'orders/order-a'), { status: 'Printing' }));
  await assertSucceeds(set(ref(anonymous, 'complaints/login-ticket'), { name: 'Account owner', email: 'owner@example.com', subject: 'Login issue', message: 'I cannot access my account and need support.', issueType: 'Account Suspension', source: 'login-support', status: 'pending', createdAt: '2026-10-20T00:00:00.000Z' }));

  const quoteV1 = { amount: 650, currency: 'INR', terms: 'Includes preparation and delivery.', version: 1, actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', createdAt: '2026-10-20T01:00:00.000Z' };
  await assertSucceeds(set(ref(admin, 'quotations/order-a/versions/v1'), quoteV1));
  await assertSucceeds(set(ref(admin, 'quotations/order-a/currentVersionId'), 'v1'));
  await assertSucceeds(get(ref(studentA, 'quotations/order-a')));
  await assertFails(get(ref(studentB, 'quotations/order-a')));
  await assertFails(get(ref(anonymous, 'quotations/order-a')));
  await assertFails(set(ref(studentA, 'quotations/order-a/versions/v2'), { ...quoteV1, amount: 1, actorUid: 'student-a' }));
  await assertFails(update(ref(admin, 'quotations/order-a/versions/v1'), { amount: 1 }));
  await assertFails(set(ref(admin, 'quotations/order-a/versions/v2'), { ...quoteV1, actorUid: 'student-a' }));
  await assertFails(set(ref(admin, 'quotations/missing-order/versions/v1'), quoteV1));
  await assertSucceeds(set(ref(studentA, 'quotationDecisions/order-a/v1'), { uid: 'student-a', status: 'approved', createdAt: '2026-10-20T02:00:00.000Z' }));
  await assertFails(update(ref(studentA, 'quotationDecisions/order-a/v1'), { status: 'rejected' }));
  await assertFails(set(ref(studentB, 'quotationDecisions/order-a/v1'), { uid: 'student-b', status: 'approved', createdAt: '2026-10-20T02:00:00.000Z' }));
  await assertFails(set(ref(studentA, 'quotationDecisions/order-a/v2'), { uid: 'student-a', status: 'approved', createdAt: '2026-10-20T02:00:00.000Z' }));
  await assertFails(set(ref(studentA, 'quotationDecisions/order-a/v2'), { uid: 'student-a', status: 'approved', amount: 1, createdAt: '2026-10-20T02:00:00.000Z' }));

  const referralCode = { code: 'FC-TEACHERA', teacherUid: 'teacher-a', active: true, createdBy: 'rules-admin', createdAt: 1792490000000 };
  await assertSucceeds(set(ref(admin, 'referralCodes/FC-TEACHERA'), referralCode));
  await assertSucceeds(get(ref(studentA, 'referralCodes/FC-TEACHERA')));
  await assertFails(get(ref(studentA, 'referralCodes')));
  await assertSucceeds(get(query(ref(teacher, 'referralCodes'), orderByChild('teacherUid'), equalTo('teacher-a'), limitToFirst(10))));
  await assertFails(set(ref(studentA, 'referralCodes/FC-FAKE'), referralCode));
  const attribution = { studentUid: 'student-a', teacherUid: 'teacher-a', referralCode: 'FC-TEACHERA', createdAt: 1792490100000 };
  await assertSucceeds(set(ref(studentA, 'referralAttributions/student-a'), attribution));
  await assertSucceeds(get(ref(studentA, 'referralAttributions/student-a')));
  await assertFails(get(ref(studentB, 'referralAttributions/student-a')));
  await assertFails(get(ref(anonymous, 'referralAttributions/student-a')));
  await assertSucceeds(get(query(ref(teacher, 'referralAttributions'), orderByChild('teacherUid'), equalTo('teacher-a'), limitToFirst(100))));
  await assertFails(set(ref(studentA, 'referralAttributions/student-a'), { ...attribution, teacherUid: 'teacher-b' }));
  await assertFails(set(ref(studentB, 'referralAttributions/student-a'), { ...attribution, studentUid: 'student-a' }));
  await assertFails(set(ref(studentB, 'referralAttributions/student-b'), { ...attribution, studentUid: 'student-b', referralCode: 'FC-UNKNOWN' }));
  await assertFails(update(ref(teacher, 'referralAttributions/student-a'), { teacherUid: 'teacher-b' }));

  const payment = { uid: 'student-a', orderId: 'order-a', quoteVersionId: 'v1', amount: 650, currency: 'INR', transactionRef: 'UPI-TXN-123', upiId: 'student@bank', status: 'pending', createdAt: '2026-10-20T03:00:00.000Z' };
  await assertSucceeds(set(ref(studentA, 'payments/UPI-TXN-123'), payment));
  await assertFails(set(ref(studentA, 'payments/UPI-TXN-123'), payment));
  await assertSucceeds(get(ref(studentA, 'payments/UPI-TXN-123')));
  await assertFails(get(ref(studentB, 'payments/UPI-TXN-123')));
  await assertFails(get(ref(anonymous, 'payments/UPI-TXN-123')));
  await assertFails(set(ref(studentB, 'payments/payment-b'), { ...payment, uid: 'student-b' }));
  await assertFails(set(ref(studentA, 'payments/order-a_other'), payment));
  await assertFails(set(ref(studentA, 'payments/payment-c'), { ...payment, amount: 1 }));
  await assertFails(set(ref(studentA, 'payments/payment-d'), { ...payment, verifiedAt: '2026-10-20T00:00:00.000Z', verifiedBy: 'rules-admin' }));
  await assertFails(set(ref(studentA, 'payments/payment-e'), { ...payment, privileged: true }));
  await assertFails(update(ref(studentA, 'payments/UPI-TXN-123'), { status: 'verified' }));
  await assertFails(set(ref(delivery, 'payments/UPI-TXN-123/status'), 'verified'));
  await assertFails(update(ref(admin, 'payments/UPI-TXN-123'), { status: 'refunded' }));
  await assertFails(set(ref(studentA, 'payments/UPI-TXN-123'), payment));
  const verifiedEvent = { type: 'verified', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', message: 'Manually verified against provider records.', createdAt: '2026-10-20T04:00:00.000Z' };
  await assertFails(update(ref(admin), { 'payments/UPI-TXN-123/status': 'verified', 'payments/UPI-TXN-123/verifiedAt': verifiedEvent.createdAt, 'payments/UPI-TXN-123/verifiedBy': 'rules-admin' }));
  await assertFails(update(ref(admin), { 'payments/UPI-TXN-123/status': 'verified', 'payments/UPI-TXN-123/verifiedAt': verifiedEvent.createdAt, 'payments/UPI-TXN-123/verifiedBy': 'rules-admin', 'payments/UPI-TXN-123/verificationNote': verifiedEvent.message, 'paymentHistory/UPI-TXN-123/decision_verified': { ...verifiedEvent, actorUid: 'student-a' } }));
  assert.equal((await assertSucceeds(get(ref(admin, 'payments/UPI-TXN-123')))).val().status, 'pending', 'a failed second write must not partially verify payment');
  await assertSucceeds(update(ref(admin), { 'payments/UPI-TXN-123/status': 'verified', 'payments/UPI-TXN-123/verifiedAt': verifiedEvent.createdAt, 'payments/UPI-TXN-123/verifiedBy': 'rules-admin', 'payments/UPI-TXN-123/verificationNote': verifiedEvent.message, 'paymentHistory/UPI-TXN-123/decision_verified': verifiedEvent }));
  await assertFails(set(ref(admin, 'paymentHistory/UPI-TXN-123/forged-verified-event'), verifiedEvent));
  await assertFails(update(ref(admin), { 'payments/UPI-TXN-123/status': 'pending' }));
  const quoteV2 = { ...quoteV1, amount: 800, version: 2, createdAt: '2026-10-20T04:05:00.000Z' };
  await assertSucceeds(set(ref(admin, 'quotations/order-a/versions/v2'), quoteV2));
  await assertSucceeds(set(ref(admin, 'quotations/order-a/currentVersionId'), 'v2'));
  await assertSucceeds(set(ref(studentA, 'quotationDecisions/order-a/v2'), { uid: 'student-a', status: 'approved', createdAt: '2026-10-20T04:06:00.000Z' }));
  const concurrentPayment = { ...payment, quoteVersionId: 'v2', amount: 800, transactionRef: 'UPI-RACE-1' };
  await assertFails(set(ref(studentA, 'payments/UPI-TXN-123'), { ...concurrentPayment, transactionRef: 'UPI-TXN-123' }));
  await assertFails(set(ref(studentA, 'payments/upi-txn-lower'), { ...concurrentPayment, transactionRef: 'upi-txn-lower' }));
  await assertSucceeds(set(ref(studentA, 'payments/UPI-RACE-1'), concurrentPayment));
  const raceWrites = await Promise.allSettled([
    update(ref(admin, 'payments/UPI-RACE-1'), { status: 'verified', verifiedAt: '2026-10-20T04:10:00.000Z', verifiedBy: 'rules-admin', verificationNote: 'Matched provider record.' }),
    update(ref(admin, 'payments/UPI-RACE-1'), { status: 'rejected', rejectedAt: '2026-10-20T04:10:00.000Z', rejectedBy: 'rules-admin', rejectionNote: 'Provider reference not found.' })
  ]);
  assert.equal(raceWrites.filter(result => result.status === 'fulfilled').length, 1, 'only one concurrent financial transition may win');
  const concurrentPaymentResult = (await assertSucceeds(get(ref(admin, 'payments/UPI-RACE-1')))).val();
  assert.ok(['verified', 'rejected'].includes(concurrentPaymentResult.status));
  const commission = { teacherUid: 'teacher-a', studentUid: 'student-a', orderId: 'order-a', paymentId: 'UPI-TXN-123', amount: 65, calculationBaseAmount: 650, calculationRatePercent: 10, proposedAmount: 65, calculationFormula: 'verified-payment-times-admin-rate-v1', roundingPolicy: 'half-up-to-0.01-INR', currency: 'INR', status: 'pending', memo: 'Manual 10% review amount.', createdBy: 'rules-admin', createdAt: 1792490200000, creationHistoryId: 'creation-event' };
  await assertSucceeds(set(ref(admin, 'commissions/UPI-TXN-123'), commission));
  await assertFails(set(ref(admin, 'commissionHistory/UPI-TXN-123/creation-event'), { commissionId: 'UPI-TXN-123', teacherUid: 'teacher-a', status: 'pending', actorUid: 'student-a', actorEmail: 'student-a@example.com', message: 'Injected second write failure.', createdAt: 1792490200000 }));
  assert.equal((await assertSucceeds(get(ref(admin, 'commissions/UPI-TXN-123')))).val().status, 'pending', 'failed second write must leave the commission intact for retry');
  const commissionCreatedEvent = { commissionId: 'UPI-TXN-123', teacherUid: 'teacher-a', status: 'pending', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', message: 'Commission recorded for administrator review.', createdAt: 1792490200000 };
  await assertSucceeds(set(ref(admin, 'commissionHistory/UPI-TXN-123/creation-event'), commissionCreatedEvent));
  await assertFails(set(ref(admin, 'commissionHistory/UPI-TXN-123/forged-pending-event'), commissionCreatedEvent));
  await assertFails(set(ref(admin, 'commissionHistory/UPI-TXN-123/creation-event'), commissionCreatedEvent));
  await assertFails(set(ref(admin, 'commissions/UPI-TXN-123'), commission));
  await assertFails(set(ref(admin, 'commissions/UPI-RACE-1'), { ...commission, paymentId: 'UPI-TXN-123' }));
  await assertFails(set(ref(admin, 'commissions/rate-probe'), { ...commission, paymentId: 'rate-probe', calculationRatePercent: 10.001, amount: 65.01, proposedAmount: 65.01 }));
  await assertFails(set(ref(admin, 'commissions/paise-probe'), { ...commission, paymentId: 'rate-probe', amount: 65.005, proposedAmount: 65.005 }));
  await assertSucceeds(get(ref(teacher, 'commissions/UPI-TXN-123')));
  await assertFails(get(ref(studentA, 'commissions/UPI-TXN-123')));
  await assertFails(get(ref(studentB, 'commissions/UPI-TXN-123')));
  await assertFails(get(ref(delivery, 'commissions/UPI-TXN-123')));
  await assertSucceeds(get(query(ref(teacher, 'commissions'), orderByChild('teacherUid'), equalTo('teacher-a'), limitToFirst(100))));
  await assertFails(set(ref(studentA, 'commissions/forged'), commission));
  await assertFails(set(ref(admin, 'commissions/wrong-owner'), { ...commission, studentUid: 'student-b' }));
  await assertFails(set(ref(admin, 'commissions/wrong-amount'), { ...commission, paymentId: 'wrong-amount', amount: 0 }));
  await assertFails(set(ref(admin, 'commissions/wrong-rate'), { ...commission, paymentId: 'wrong-rate', calculationRatePercent: 25 }));
  await assertFails(update(ref(teacher, 'commissions/UPI-TXN-123'), { amount: 650, status: 'paid' }));
  await assertFails(set(ref(admin, 'commissions/unverified'), { ...commission, paymentId: 'payment-not-verified' }));
  const commissionApproved = { commissionId: 'UPI-TXN-123', teacherUid: 'teacher-a', status: 'approved', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', message: 'Commission approved for manual payout.', createdAt: 1792490300000 };
  await assertFails(update(ref(admin), { 'commissions/UPI-TXN-123/status': 'approved', 'commissions/UPI-TXN-123/updatedBy': 'rules-admin', 'commissions/UPI-TXN-123/updatedAt': 1792490290000, 'commissionHistory/UPI-TXN-123/transition_approved': { ...commissionApproved, message: '' } }));
  assert.equal((await assertSucceeds(get(ref(admin, 'commissions/UPI-TXN-123')))).val().status, 'pending', 'invalid approval history must not partially approve a commission');
  await assertSucceeds(update(ref(admin), { 'commissions/UPI-TXN-123/status': 'approved', 'commissions/UPI-TXN-123/updatedBy': 'rules-admin', 'commissions/UPI-TXN-123/updatedAt': 1792490300000, 'commissionHistory/UPI-TXN-123/transition_approved': commissionApproved }));
  await assertSucceeds(get(ref(teacher, 'commissionHistory/UPI-TXN-123')));
  await assertFails(get(ref(studentA, 'commissionHistory/UPI-TXN-123')));
  await assertFails(update(ref(admin, 'commissionHistory/UPI-TXN-123/transition_approved'), { message: 'Changed after approval.' }));
  await assertFails(update(ref(admin, 'commissions/UPI-TXN-123'), { status: 'pending', updatedBy: 'rules-admin', updatedAt: 1792490400000 }));
  const commissionPaid = { ...commissionApproved, status: 'paid', message: 'External payout completed.', createdAt: 1792490500000 };
  await assertFails(update(ref(admin), { 'commissions/UPI-TXN-123/status': 'paid', 'commissions/UPI-TXN-123/updatedBy': 'rules-admin', 'commissions/UPI-TXN-123/updatedAt': 1792490490000, 'commissionHistory/UPI-TXN-123/transition_paid': { ...commissionPaid, message: '' } }));
  assert.equal((await assertSucceeds(get(ref(admin, 'commissions/UPI-TXN-123')))).val().status, 'approved', 'invalid payout history must not partially mark a commission paid');
  await assertSucceeds(update(ref(admin), { 'commissions/UPI-TXN-123/status': 'paid', 'commissions/UPI-TXN-123/updatedBy': 'rules-admin', 'commissions/UPI-TXN-123/updatedAt': 1792490500000, 'commissionHistory/UPI-TXN-123/transition_paid': commissionPaid }));

  const notification = { recipientUid: 'student-a', type: 'quotation', title: 'New quotation received', message: 'A quotation is ready for your order.', route: '/dashboard/my-orders', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', createdAt: 1792490600000, isRead: false };
  await assertSucceeds(set(ref(admin, 'notifications/student-a/notification-1'), notification));
  await assertSucceeds(get(ref(studentA, 'notifications/student-a')));
  await assertFails(get(ref(studentB, 'notifications/student-a')));
  await assertFails(get(ref(anonymous, 'notifications/student-a')));
  await assertSucceeds(get(ref(admin, 'notifications/student-a')));
  await assertSucceeds(get(ref(admin, 'notifications')));
  await assertFails(get(ref(studentA, 'notifications')));
  await assertFails(get(ref(studentB, 'notifications')));
  await assertFails(get(ref(anonymous, 'notifications')));

  // Analytics Visitor Counter permissions
  await assertSucceeds(get(ref(anonymous, 'analytics/visitorCount')));
  await assertSucceeds(get(ref(studentA, 'analytics/visitorCount')));
  await assertFails(set(ref(anonymous, 'analytics/visitorCount'), 2000));
  await assertFails(set(ref(studentA, 'analytics/visitorCount'), 2000));
  await assertSucceeds(set(ref(admin, 'analytics/visitorCount'), 1500));
  await assertFails(set(ref(admin, 'analytics/visitorCount'), 500));
  await assertFails(set(ref(admin, 'analytics/visitorCount'), 'not-a-number'));
  await assertFails(set(ref(admin, 'analytics/visitorCount'), 10000001));
  await assertFails(set(ref(studentA, 'notifications/student-a/forged'), notification));
  await assertFails(update(ref(studentB, 'notifications/student-a/notification-1'), { isRead: true, readBy: 'student-b', readAt: 1792490700000 }));
  await assertFails(update(ref(studentA, 'notifications/student-a/notification-1'), { isRead: true, title: 'Changed title', readBy: 'student-a', readAt: 1792490700000 }));
  await assertSucceeds(update(ref(studentA, 'notifications/student-a/notification-1'), { isRead: true, readBy: 'student-a', readAt: 1792490700000 }));
  await assertFails(update(ref(admin, 'notifications/student-a/notification-1'), { title: 'Overwritten' }));
  await assertFails(set(ref(admin, 'notifications/student-a/forged-actor'), { ...notification, actorUid: 'student-a' }));
  await assertFails(set(ref(admin, 'notifications/student-a/bad-route'), { ...notification, route: '/admin/private' }));
  await assertFails(set(ref(admin, 'notifications/missing-user/notification-1'), { ...notification, recipientUid: 'missing-user' }));
  const auditEvent = { actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', type: 'quotation_created', entityType: 'order', entityId: 'order-a', summary: 'Created a new quotation version.', createdAt: 1792490800000 };
  await assertSucceeds(set(ref(admin, 'auditEvents/audit-1'), auditEvent));
  await assertSucceeds(get(ref(admin, 'auditEvents')));
  await assertFails(get(ref(studentA, 'auditEvents')));
  await assertFails(get(ref(teacher, 'auditEvents')));
  await assertFails(set(ref(teacher, 'auditEvents/forged'), auditEvent));
  await assertFails(set(ref(studentA, 'auditEvents/forged'), auditEvent));
  await assertFails(set(ref(admin, 'auditEvents/fake-actor'), { ...auditEvent, actorUid: 'student-a' }));
  await assertFails(update(ref(admin, 'auditEvents/audit-1'), { summary: 'Changed history.' }));
  await assertSucceeds(get(ref(studentA, 'paymentHistory/UPI-TXN-123')));
  await assertFails(get(ref(studentB, 'paymentHistory/UPI-TXN-123')));
  await assertFails(update(ref(admin, 'paymentHistory/UPI-TXN-123/decision_verified'), { type: 'rejected' }));
  const refund = { uid: 'student-a', paymentId: 'UPI-TXN-123', orderId: 'order-a', amount: 650, currency: 'INR', reason: 'Order was cancelled after payment', status: 'pending', createdAt: '2026-10-20T05:00:00.000Z' };
  await assertSucceeds(set(ref(studentA, 'refunds/UPI-TXN-123'), refund));
  await assertFails(set(ref(studentA, 'refunds/UPI-TXN-123'), refund));
  await assertFails(set(ref(studentA, 'refunds/payment-b'), { ...refund, paymentId: 'payment-b', amount: 1 }));
  await assertFails(update(ref(studentA, 'refunds/UPI-TXN-123'), { status: 'approved' }));
  const refundApprovedEvent = { ...verifiedEvent, type: 'approved', message: 'Refund approved for external processing.', createdAt: '2026-10-20T06:00:00.000Z' };
  await assertFails(update(ref(admin), { 'refunds/UPI-TXN-123/status': 'approved', 'refunds/UPI-TXN-123/reviewedAt': refundApprovedEvent.createdAt, 'refunds/UPI-TXN-123/reviewedBy': 'rules-admin', 'refunds/UPI-TXN-123/decisionNote': '', 'refundHistory/UPI-TXN-123/decision_approved': { ...refundApprovedEvent, message: '' } }));
  assert.equal((await assertSucceeds(get(ref(admin, 'refunds/UPI-TXN-123')))).val().status, 'pending', 'invalid refund decision history must not partially approve a refund');
  await assertSucceeds(update(ref(admin), { 'refunds/UPI-TXN-123/status': 'approved', 'refunds/UPI-TXN-123/reviewedAt': '2026-10-20T06:00:00.000Z', 'refunds/UPI-TXN-123/reviewedBy': 'rules-admin', 'refunds/UPI-TXN-123/decisionNote': refundApprovedEvent.message, 'refundHistory/UPI-TXN-123/decision_approved': refundApprovedEvent }));
  await assertFails(set(ref(admin, 'refundHistory/UPI-TXN-123/forged-approval-event'), refundApprovedEvent));
  await assertSucceeds(get(ref(studentA, 'refundHistory/UPI-TXN-123')));
  await assertFails(get(ref(studentB, 'refundHistory/UPI-TXN-123')));
  await assertFails(update(ref(admin), { 'refunds/UPI-TXN-123/status': 'rejected' }));
  await assertFails(update(ref(admin, 'payments/UPI-TXN-123'), { status: 'refunded' }));
  const refundFailed = { uid: 'student-a', paymentId: 'UPI-TXN-123', orderId: 'order-a', status: 'failed', reference: '', note: 'Provider rejected the refund request; retry required.', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', createdAt: '2026-10-20T06:30:00.000Z', historyEventId: 'processing-failed' };
  const refundFailedEvent = { type: 'failed', reference: '', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', message: refundFailed.note, createdAt: refundFailed.createdAt };
  await assertFails(set(ref(admin, 'refundProcessing/UPI-TXN-123'), { ...refundFailed, note: '' }));
  await assertSucceeds(set(ref(admin, 'refundProcessing/UPI-TXN-123'), refundFailed));
  await assertFails(set(ref(admin, 'refundProcessingHistory/UPI-TXN-123/processing-failed'), { ...refundFailedEvent, actorUid: 'student-a', actorEmail: 'student-a@example.com' }));
  assert.equal((await assertSucceeds(get(ref(admin, 'refundProcessing/UPI-TXN-123')))).val().status, 'failed', 'a failed second write must retain the processing summary for reconciliation');
  assert.equal((await assertSucceeds(get(ref(admin, 'payments/UPI-TXN-123')))).val().status, 'verified', 'a failed processing outcome must not finalize a refund');
  await assertFails(update(ref(admin, 'refundProcessing/UPI-TXN-123'), { status: 'processed', reference: 'BANK-REFUND-9001', note: 'Retry before failed event history exists.', historyEventId: 'processing-processed' }));
  assert.equal((await assertSucceeds(get(ref(admin, 'refundProcessing/UPI-TXN-123')))).val().status, 'failed', 'processing cannot advance while its prior history entry is missing');
  await assertSucceeds(set(ref(admin, 'refundProcessingHistory/UPI-TXN-123/processing-failed'), refundFailedEvent));
  await assertFails(set(ref(admin, 'refundProcessingHistory/UPI-TXN-123/forged-failed-event'), refundFailedEvent));
  await assertFails(set(ref(admin, 'refundProcessingHistory/UPI-TXN-123/processing-failed'), refundFailedEvent));
  await assertSucceeds(get(ref(studentA, 'refundProcessing/UPI-TXN-123')));
  await assertFails(get(ref(studentB, 'refundProcessing/UPI-TXN-123')));
  await assertFails(get(ref(delivery, 'refundProcessing/UPI-TXN-123')));
  await assertFails(set(ref(studentA, 'refundProcessing/UPI-TXN-123'), { ...refundFailed, status: 'processed' }));
  await assertFails(set(ref(delivery, 'refundProcessing/UPI-TXN-123/status'), 'processed'));
  const refundProcessed = { ...refundFailed, status: 'processed', reference: 'BANK-REFUND-9001', note: 'Provider confirmed refund settlement.', createdAt: '2026-10-20T06:45:00.000Z', historyEventId: 'processing-processed' };
  const refundProcessedEvent = { type: 'processed', reference: refundProcessed.reference, actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', actorRole: 'Admin', message: refundProcessed.note, createdAt: refundProcessed.createdAt };
  await assertSucceeds(update(ref(admin, 'refundProcessing/UPI-TXN-123'), refundProcessed));
  await assertSucceeds(set(ref(admin, 'refundProcessingHistory/UPI-TXN-123/processing-processed'), refundProcessedEvent));
  await assertFails(update(ref(admin), { 'payments/UPI-TXN-123/status': 'refunded' }));
  await assertSucceeds(update(ref(admin), { 'payments/UPI-TXN-123/status': 'refunded', 'payments/UPI-TXN-123/refundedAt': '2026-10-20T07:00:00.000Z', 'payments/UPI-TXN-123/refundedBy': 'rules-admin', 'payments/UPI-TXN-123/refundNote': 'External refund reference BANK-REFUND-9001.', 'paymentHistory/UPI-TXN-123/decision_refunded': { ...verifiedEvent, type: 'refunded', message: 'External refund completed; BANK-REFUND-9001.', createdAt: '2026-10-20T07:00:00.000Z' } }));
  await assertFails(update(ref(admin), { 'payments/UPI-TXN-123/status': 'verified' }));

  const assignment = { orderId: 'order-a', uid: 'student-a', agentUid: 'delivery-a', status: 'assigned', assignedAt: '2026-10-20T08:00:00.000Z', assignedBy: 'rules-admin', studentName: 'Student A', subject: 'Computer Science', phone: '1234567890', address: 'Campus Road', pincode: '110001', lastHistoryEventId: 'assigned-initial', lastHistoryStatus: 'assigned', lastHistoryActorUid: 'rules-admin', lastHistoryActorEmail: 'admin@filecrafters.in', lastHistoryNote: 'Delivery assignment created by administrator.', lastHistoryCreatedAt: '2026-10-20T08:00:00.000Z' };
  await assertSucceeds(set(ref(admin, 'deliveryAssignments/order-a'), assignment));
  const assignedHistory = { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'rules-admin', actorEmail: 'admin@filecrafters.in', status: 'assigned', note: assignment.lastHistoryNote, createdAt: assignment.assignedAt };
  await assertFails(set(ref(admin, 'deliveryHistory/order-a/assigned-initial'), { ...assignedHistory, actorUid: 'student-a', actorEmail: 'student-a@example.com' }));
  assert.equal((await assertSucceeds(get(ref(admin, 'deliveryAssignments/order-a/status')))).val(), 'assigned', 'failed assignment history must leave the assignment available for reconciliation');
  await assertSucceeds(set(ref(admin, 'deliveryHistory/order-a/assigned-initial'), assignedHistory));
  await assertFails(set(ref(admin, 'deliveryHistory/order-a/forged-assignment-event'), assignedHistory));
  await assertSucceeds(get(ref(studentA, 'deliveryAssignments/order-a')));
  await assertFails(get(ref(studentB, 'deliveryAssignments/order-a')));
  await assertFails(get(ref(anonymous, 'deliveryAssignments/order-a')));
  await assertSucceeds(get(query(ref(delivery, 'deliveryAssignments'), orderByChild('agentUid'), equalTo('delivery-a'), limitToFirst(100))));
  await assertFails(get(ref(delivery, 'deliveryAssignments/order-b')));
  await assertFails(set(ref(studentA, 'deliveryAssignments/order-b'), { ...assignment, orderId: 'order-b' }));
  await assertFails(set(ref(admin, 'deliveryAssignments/order-b'), { ...assignment, orderId: 'order-b', uid: 'student-a', agentUid: 'teacher-a' }));
  await assertFails(set(ref(admin, 'deliveryAssignments/missing-order'), { ...assignment, orderId: 'missing-order' }));
  await assertFails(update(ref(delivery, 'deliveryAssignments/order-a'), { agentUid: 'delivery-b' }));
  await assertFails(set(ref(delivery, 'deliveryAssignments/order-a/status'), 'delivered'));
  await assertFails(set(ref(delivery, 'deliveryAssignments/order-a/status'), 'picked_up'));
  await assertFails(set(ref(delivery, 'deliveryAssignments/order-a/lastHistoryActorUid'), 'rules-admin'));
  const pickup = { status: 'picked_up', updatedAt: '2026-10-20T08:10:00.000Z', lastNote: 'Collected the package.', lastHistoryEventId: 'agent-picked-up', lastHistoryStatus: 'picked_up', lastHistoryActorUid: 'delivery-a', lastHistoryActorEmail: 'delivery-a@example.com', lastHistoryNote: 'Collected the package.', lastHistoryCreatedAt: '2026-10-20T08:10:00.000Z' };
  await assertSucceeds(update(ref(delivery), Object.fromEntries(Object.entries(pickup).map(([field, value]) => [`deliveryAssignments/order-a/${field}`, value]))));
  assert.equal((await assertSucceeds(get(ref(delivery, 'deliveryAssignments/order-a/status')))).val(), 'picked_up');
  await assertFails(set(ref(delivery, 'deliveryHistory/order-a/agent-picked-up'), { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'student-a', actorEmail: 'student-a@example.com', status: 'picked_up', note: 'Injected failed write.', createdAt: pickup.lastHistoryCreatedAt }));
  assert.equal((await assertSucceeds(get(ref(delivery, 'deliveryAssignments/order-a/status')))).val(), 'picked_up', 'failed delivery history append must not undo or corrupt the assignment projection');
  await assertSucceeds(set(ref(delivery, 'deliveryHistory/order-a/agent-picked-up'), { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'delivery-a', actorEmail: 'delivery-a@example.com', status: 'picked_up', note: 'Collected the package.', createdAt: pickup.lastHistoryCreatedAt }));
  await assertFails(set(ref(delivery, 'deliveryHistory/order-a/agent-picked-up'), { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'delivery-a', actorEmail: 'delivery-a@example.com', status: 'picked_up', note: 'Duplicate event.', createdAt: pickup.lastHistoryCreatedAt }));
  await assertFails(set(ref(delivery, 'deliveryAssignments/order-a/status'), 'in_transit'));
  const transit = { ...pickup, status: 'in_transit', lastNote: 'Out for delivery.', lastHistoryEventId: 'agent-in-transit', lastHistoryStatus: 'in_transit', lastHistoryNote: 'Out for delivery.', lastHistoryCreatedAt: '2026-10-20T08:20:00.000Z' };
  await assertSucceeds(update(ref(delivery), Object.fromEntries(Object.entries(transit).map(([field, value]) => [`deliveryAssignments/order-a/${field}`, value]))));
  await assertSucceeds(set(ref(delivery, 'deliveryHistory/order-a/agent-in-transit'), { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'delivery-a', actorEmail: 'delivery-a@example.com', status: 'in_transit', note: transit.lastNote, createdAt: transit.lastHistoryCreatedAt }));
  await assertFails(set(ref(delivery, 'deliveryAssignments/order-a/status'), 'failed_delivery'));
  const delivered = { ...transit, status: 'delivered', lastNote: 'Delivered to student.', lastHistoryEventId: 'agent-delivered', lastHistoryStatus: 'delivered', lastHistoryNote: 'Delivered to student.', lastHistoryCreatedAt: '2026-10-20T08:30:00.000Z' };
  await assertSucceeds(update(ref(delivery), Object.fromEntries(Object.entries(delivered).map(([field, value]) => [`deliveryAssignments/order-a/${field}`, value]))));
  const deliveryEvent = { orderId: 'order-a', agentUid: 'delivery-a', actorUid: 'delivery-a', actorEmail: 'delivery-a@example.com', status: 'delivered', note: 'Delivered to student.', createdAt: delivered.lastHistoryCreatedAt };
  await assertSucceeds(set(ref(delivery, 'deliveryHistory/order-a/agent-delivered'), deliveryEvent));
  await assertFails(set(ref(admin, 'deliveryAssignments/order-a'), {
    ...delivered,
    agentUid: 'delivery-b',
    status: 'assigned',
    assignedAt: '2026-10-20T08:31:00.000Z',
    lastHistoryEventId: 'forbidden-reassign-after-delivered',
    lastHistoryStatus: 'assigned',
    lastHistoryActorUid: 'rules-admin',
    lastHistoryActorEmail: 'admin@filecrafters.in'
  }));
  await assertSucceeds(get(ref(studentA, 'deliveryHistory/order-a')));
  await assertFails(get(ref(studentB, 'deliveryHistory/order-a')));
  await assertFails(get(ref(anonymous, 'deliveryHistory/order-a')));
  await assertFails(set(ref(studentA, 'deliveryHistory/order-a/event-forged'), deliveryEvent));
  await assertFails(update(ref(delivery, 'deliveryHistory/order-a/event-delivered'), { note: 'Edited history' }));

  const supportReply = { ticketId: 'ticket-a', authorUid: 'rules-admin', authorEmail: 'admin@filecrafters.in', authorRole: 'Admin', message: 'We are reviewing the payment reference.', createdAt: 1792490900000 };
  await assertSucceeds(update(ref(admin), { 'supportReplies/ticket-a/reply-1': supportReply, 'complaints/ticket-a/status': 'Resolved' }));
  await assertSucceeds(set(ref(admin, 'supportReplies/ticket-a/reply-2'), { ...supportReply, message: 'The payment has now been reviewed.', createdAt: 1792491000000 }));
  await assertSucceeds(get(ref(studentA, 'supportReplies/ticket-a')));
  await assertSucceeds(get(ref(admin, 'supportReplies/ticket-a')));
  await assertFails(get(ref(studentB, 'supportReplies/ticket-a')));
  await assertFails(get(ref(anonymous, 'supportReplies/ticket-a')));
  await assertFails(set(ref(studentA, 'supportReplies/ticket-a/impersonated-admin'), { ...supportReply, authorUid: 'student-a', authorEmail: 'student-a@example.com', authorRole: 'Admin' }));
  await assertFails(set(ref(admin, 'supportReplies/ticket-a/reply-forged'), { ...supportReply, authorUid: 'student-a' }));
  await assertFails(update(ref(admin, 'supportReplies/ticket-a/reply-1'), { message: 'Edited history' }));
  const studentReply = { ticketId: 'ticket-a', authorUid: 'student-a', authorEmail: 'student-a@example.com', authorRole: 'Student', message: 'Thank you. I have added the transaction reference.', createdAt: 1792491100000 };
  await assertSucceeds(update(ref(studentA), { 'supportReplies/ticket-a/student-reply': studentReply, 'complaints/ticket-a/status': 'In Progress' }));
  await assertSucceeds(get(ref(studentA, 'supportReplies/ticket-a')));
  await assertFails(set(ref(studentB, 'supportReplies/ticket-a/student-reply'), { ...studentReply, authorUid: 'student-b', authorEmail: 'student-b@example.com' }));
  await assertFails(update(ref(studentB, 'complaints/ticket-a'), { status: 'Resolved' }));
  await assertFails(update(ref(studentA, 'supportReplies/ticket-a/student-reply'), { message: 'Changed reply' }));
  await assertFails(remove(ref(admin, 'complaints/ticket-a')));

  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
  const ownerFile = storageRef(studentAStorage, 'student-uploads/student-a/order-a/1-project.pdf');
  const ownerPdfMetadata = { contentType: 'application/pdf', customMetadata: { ownerUid: 'student-a', orderId: 'order-a' } };
  await assertSucceeds(uploadBytes(ownerFile, pdf, ownerPdfMetadata));
  await assertFails(uploadBytes(ownerFile, pdf, ownerPdfMetadata));
  await assertSucceeds(getBytes(ownerFile));
  await assertFails(getBytes(storageRef(env.unauthenticatedContext().storage(), 'student-uploads/student-a/order-a/1-project.pdf')));
  await assertFails(getBytes(storageRef(studentBStorage, 'student-uploads/student-a/order-a/1-project.pdf')));
  await assertFails(uploadBytes(storageRef(studentAStorage, 'student-uploads/student-a/order-b/bad.txt'), pdf, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(storageRef(studentAStorage, 'student-uploads/student-a/order-b/large.pdf'), new Uint8Array(1048577), { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(storageRef(studentAStorage, 'project-deliverables/student-a/order-a/final.pdf'), pdf, { contentType: 'application/pdf' }));
  await assertSucceeds(getBytes(storageRef(adminStorage, 'student-uploads/student-a/order-a/1-project.pdf')));
  await assertSucceeds(uploadBytes(storageRef(adminStorage, 'project-deliverables/student-a/order-a/final.pdf'), pdf, { contentType: 'application/pdf' }));
  await assertFails(deleteObject(ownerFile));
  await assertSucceeds(deleteObject(storageRef(adminStorage, 'student-uploads/student-a/order-a/1-project.pdf')));

  console.log('Realtime Database and Storage rules passed: owner isolation, student-only registration, private uploads, quotation decisions, payment/refund transitions, delivery restrictions and history, ticket-scoped append-only support replies, immutable teacher referral attribution, commission transitions and history, owner-scoped notification read state, admin-only append-only audit events, price/Data URL protection, cancellation ownership, and restricted login-support intake.');
} finally {
  await env.cleanup();
}


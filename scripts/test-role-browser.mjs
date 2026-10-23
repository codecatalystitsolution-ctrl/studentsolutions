import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectDatabaseEmulator, equalTo, get, getDatabase, limitToFirst, orderByChild, query, ref, remove, set } from 'firebase/database';
import { chromium } from 'playwright';

const projectId = 'demo-filecrafters';
const databaseUrl = `https://${projectId}-default-rtdb.firebaseio.com/`;
const baseUrl = process.env.FILECRAFTERS_LOCAL_URL || 'http://127.0.0.1:4200';
const runId = `e2e-${Date.now()}`;
const password = 'Local-E2E-Only-Password9';
const accounts = [
  { key: 'student', email: `student-${runId}@example.test`, role: 'Student', path: '/dashboard/home', heading: /Get Your Assignments/ },
  { key: 'teacher', email: `teacher-${runId}@example.test`, role: 'Teacher', path: '/teacher/referrals', heading: /Referrals & commissions/ },
  { key: 'delivery', email: `delivery-${runId}@example.test`, role: 'Delivery', path: '/delivery-portal', heading: /My assigned deliveries/ },
  { key: 'admin', email: 'admin@filecrafters.in', role: 'Admin', path: '/admin/dashboard', heading: /Good morning, Admin/i }
];

const app = initializeApp({
  apiKey: 'demo-key',
  authDomain: `${projectId}.firebaseapp.com`,
  projectId,
  databaseURL: databaseUrl,
  storageBucket: `${projectId}.appspot.com`
}, `role-browser-${runId}`);
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getDatabase(app);
connectDatabaseEmulator(db, '127.0.0.1', 9000);
const testEnvironment = await initializeTestEnvironment({ projectId, database: { host: '127.0.0.1', port: 9000 } });
let browser;
const createdAccounts = [];
const seededUids = [];
const priorProfiles = new Map();
const orderId = `e2e-order-${Date.now()}`;
let submittedOrderId = null;

try {
  for (const account of accounts) {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, account.email, password);
      account.createdByThisRun = true;
    } catch (error) {
      if ((error)?.code !== 'auth/email-already-in-use') throw error;
      credential = await signInWithEmailAndPassword(auth, account.email, password);
      account.createdByThisRun = false;
    }
    account.uid = credential.user.uid;
    if (account.createdByThisRun) createdAccounts.push(account);
    await signOut(auth);
  }

  await testEnvironment.withSecurityRulesDisabled(async context => {
    const database = context.database(databaseUrl);
    const userRecords = Object.fromEntries(accounts.map(account => [account.uid, {
      role: account.role,
      status: 'active',
      fullName: `E2E ${account.role}`,
      email: account.email,
      studentID: account.role === 'Student' ? `FC-${runId.slice(-8).toUpperCase()}` : undefined
    }]));
    for (const [uid, profile] of Object.entries(userRecords)) {
      if (profile.studentID === undefined) delete profile.studentID;
      seededUids.push(uid);
    }
    const oldProfiles = (await get(ref(database, 'users'))).val() || {};
    for (const uid of seededUids) priorProfiles.set(uid, oldProfiles[uid] ?? null);
    await set(ref(database, 'users'), { ...oldProfiles, ...userRecords });
    await set(ref(database, `orders/${orderId}`), {
      uid: accounts[0].uid,
      studentID: userRecords[accounts[0].uid].studentID,
      status: 'Pending',
      fileType: 'assignment',
      createdAt: new Date().toISOString(),
      projectDetails: { submittedBy: 'E2E Student', subject: 'Browser verification' },
      pricing: { totalAmount: 0, advancePaid: 0 },
      uploadDetails: { selfUploaded: false }
    });
    await set(ref(database, `deliveryAssignments/${orderId}`), {
      orderId,
      uid: accounts[0].uid,
      agentUid: accounts[2].uid,
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      assignedBy: accounts[3].uid,
      studentName: 'E2E Student',
      subject: 'Browser verification',
      phone: '0000000000',
      address: 'Local emulator only',
      pincode: '000000'
    });
    await set(ref(database, `referralCodes/${runId.toUpperCase()}`), {
      code: runId.toUpperCase(), teacherUid: accounts[1].uid, active: true, createdBy: accounts[3].uid, createdAt: Date.now()
    });
  });
  const seededCodeQuery = await get(query(
    ref(testEnvironment.authenticatedContext(accounts[1].uid, { email: accounts[1].email }).database(databaseUrl), 'referralCodes'),
    orderByChild('teacherUid'), equalTo(accounts[1].uid), limitToFirst(10)
  ));
  console.log(`Teacher referral seed query: ${JSON.stringify(seededCodeQuery.val())}`);
  assert.ok(seededCodeQuery.exists(), 'Synthetic referral code should be visible to its own teacher');
  for (const account of accounts) {
    const context = testEnvironment.authenticatedContext(account.uid, { email: account.email });
    const emulatorProfile = await get(ref(context.database(databaseUrl), `users/${account.uid}`));
    console.log(`Seeded profile (${account.role}): ${JSON.stringify(emulatorProfile.val())}`);
    await signInWithEmailAndPassword(auth, account.email, password);
    const profile = await get(ref(db, `users/${account.uid}`));
    console.log(`App SDK profile (${account.role}): ${JSON.stringify(profile.val())}`);
    assert.equal(profile.val()?.role, account.role, `Auth SDK should read the seeded ${account.role} profile under emulator rules`);
    await signOut(auth);
  }

  browser = await chromium.launch({ headless: true });
  for (const account of accounts) {
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('filecrafters-use-emulators', 'true'));
    const page = await context.newPage();
    const browserErrors = [];
    page.on('pageerror', error => { browserErrors.push(error.message); console.error(`Browser error (${account.role}):`, error.message); });
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
      console[message.type() === 'error' ? 'error' : 'log'](`Browser console (${account.role}):`, message.text());
    });
    page.on('requestfailed', request => console.error(`Browser request failed (${account.role}): ${request.url()} ${request.failure()?.errorText || ''}`));
    page.on('response', response => { if (response.status() >= 400) console.error(`Browser HTTP ${response.status()} (${account.role}): ${response.url()}`); });
    await page.goto(`${baseUrl}/login?emulators=1`);
    await page.locator('#email').fill(account.email);
    await page.locator('#password').fill(password);
    console.log(`Form state (${account.role}): email=${await page.locator('#email').inputValue()}, enabled=${!(await page.getByRole('button', { name: 'Sign In' }).isDisabled())}, valid=${await page.locator('form').evaluate((form) => form.checkValidity())}`);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(750);
    try {
      await page.waitForURL(url => url.pathname === account.path, { timeout: 15_000 });
    } catch (error) {
      console.error(`Role route failed (${account.role}); current URL: ${page.url()}`);
      console.error((await page.locator('body').innerText()).slice(0, 1800));
      throw error;
    }
    await page.getByRole('heading', { name: account.heading }).waitFor({ timeout: 15_000 });
    assert.equal(new URL(page.url()).pathname, account.path);
    if (account.key === 'student') {
      await page.goto(`${baseUrl}/dashboard/my-orders?emulators=1`);
      await page.getByText('Browser verification', { exact: true }).waitFor({ timeout: 10_000 });
      await page.goto(`${baseUrl}/new-order?emulators=1`);
      await page.getByRole('button', { name: /Assignment.*Homework & solutions/ }).click();
      await page.getByRole('button', { name: /^Continue/ }).click();
      await page.locator('#order-course').fill('E2E Course');
      await page.locator('#order-subject').fill(`Browser Order ${runId}`);
      await page.locator('#order-topic').fill('Quotation first workflow');
      await page.locator('#submitted-to').fill('E2E Instructor');
      await page.locator('#submitted-by').fill('E2E Student');
      await page.locator('#roll-number').fill(`E2E-${runId.slice(-8)}`);
      await page.getByRole('button', { name: /^Continue/ }).click();
      await page.getByRole('button', { name: 'Submit order' }).click();
      await page.waitForURL(url => url.pathname === '/dashboard/home', { timeout: 15_000 });
      const submittedOrders = await get(query(
        ref(testEnvironment.authenticatedContext(account.uid, { email: account.email }).database(databaseUrl), 'orders'),
        orderByChild('uid'), equalTo(account.uid), limitToFirst(100)
      ));
      const matchingOrders = Object.entries(submittedOrders.val() || {}).filter(([, order]) => order.projectDetails?.subject === `Browser Order ${runId}`);
      assert.equal(matchingOrders.length, 1, 'A single student order submission should create one order');
      const submittedEntry = matchingOrders[0];
      assert.ok(submittedEntry, 'Student order submission should create an owned order record');
      submittedOrderId = submittedEntry[0];
      assert.equal(submittedEntry[1].paymentDetails?.status, 'Awaiting Quotation', 'New orders must wait for an approved quotation before payment');
      assert.equal(submittedEntry[1].paymentDetails?.transactionId, undefined, 'The order form must not write unverified payment evidence outside the ledger');
    } else if (account.key === 'teacher') {
      await page.getByText(runId.toUpperCase(), { exact: true }).waitFor({ timeout: 10_000 }).catch(async error => {
        console.error('Teacher page snapshot:', (await page.locator('body').innerText()).slice(0, 1200));
        throw error;
      });
    } else if (account.key === 'delivery') {
      await page.getByText('Browser verification', { exact: true }).waitFor({ timeout: 10_000 });
      await page.getByLabel('Delivery note').fill('E2E browser smoke delivery update');
      await page.getByRole('button', { name: /Mark Picked Up/ }).click();
      await page.locator('.delivery-status').getByText('Picked Up', { exact: true }).waitFor({ timeout: 10_000 });
      const deliveryHistory = await get(ref(
        testEnvironment.authenticatedContext(account.uid, { email: account.email }).database(databaseUrl),
        `deliveryHistory/${orderId}`
      ));
      assert.ok(Object.values(deliveryHistory.val() || {}).some(event => event.note === 'E2E browser smoke delivery update'), 'Delivery status and history should both persist');
      await page.getByText('E2E browser smoke delivery update', { exact: true }).waitFor({ timeout: 10_000 }).catch(async error => {
        console.error('Delivery page snapshot after status update:', (await page.locator('body').innerText()).slice(0, 1600));
        throw error;
      });
    }
    assert.deepEqual(browserErrors, [], `Browser page should render without uncaught errors for ${account.role}`);
    console.log(`PASS ${account.role}: ${account.path}`);
    await context.close();
  }
} finally {
  await browser?.close();
  await testEnvironment.withSecurityRulesDisabled(async context => {
    const database = context.database(databaseUrl);
    await Promise.all([
      remove(ref(database, `orders/${orderId}`)),
      ...(submittedOrderId ? [remove(ref(database, `orders/${submittedOrderId}`))] : []),
      remove(ref(database, `deliveryAssignments/${orderId}`)),
      remove(ref(database, `referralCodes/${runId.toUpperCase()}`)),
      ...seededUids.map(uid => priorProfiles.get(uid)
        ? set(ref(database, `users/${uid}`), priorProfiles.get(uid))
        : remove(ref(database, `users/${uid}`)))
    ]);
  }).catch(error => console.warn('Could not remove synthetic browser-test records from the local emulator:', error));
  for (const account of createdAccounts.reverse()) {
    try {
      await signInWithEmailAndPassword(auth, account.email, password);
      if (auth.currentUser) await deleteUser(auth.currentUser);
    } catch (error) {
      console.warn(`Could not remove synthetic Auth emulator account ${account.email}:`, error);
    }
  }
  await signOut(auth).catch(() => undefined);
  await testEnvironment.cleanup();
  await deleteApp(app);
}

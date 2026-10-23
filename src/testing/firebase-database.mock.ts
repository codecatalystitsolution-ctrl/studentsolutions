type DatabaseValue = any;

export interface DatabaseReference {
  path: string;
  key: string | null;
}

export type Unsubscribe = () => void;

export class Database {}

const visualTestData: Record<string, DatabaseValue> = {
  users: {
    'visual-student': {
      uid: 'visual-student',
      fullName: 'Morgan Lee',
      email: 'student@example.test',
      role: 'Student',
      status: 'active',
      studentID: 'FC-VIS001',
      phone: '9876543210',
      whatsapp: '9876543210',
      collegeName: 'Northbridge Institute',
      courseName: 'B.Tech Computer Science',
      branch: 'Computer Science',
      year: '2nd Year',
      semester: '4th Sem',
      rollNumber: '24001001',
      address: '12 Campus Road, Northbridge',
      pincode: '560001',
    },
    'visual-student-02': {
      uid: 'visual-student-02',
      fullName: 'Jamie Patel',
      email: 'jamie@example.test',
      role: 'Student',
      status: 'active',
      studentID: 'FC-VIS002',
      collegeName: 'Northbridge Institute',
    },
    'visual-teacher': {
      uid: 'visual-teacher',
      fullName: 'Taylor Chen',
      email: 'taylor@example.test',
      role: 'Teacher',
      status: 'active',
      employeeID: 'TEA-VIS001',
      department: 'Computer Science',
      qualification: 'M.Tech',
      collegeName: 'Northbridge Institute',
    },
    'visual-delivery': {
      uid: 'visual-delivery',
      fullName: 'Alex Rivera',
      email: 'alex@example.test',
      role: 'Delivery',
      status: 'active',
      deliveryID: 'DEL-VIS001',
      vehicleNumber: 'KA-01-VT-001',
      licenseNumber: 'TEST-LICENSE-001',
    },
    'visual-admin': {
      uid: 'visual-admin',
      fullName: 'Visual Test Admin',
      email: 'admin@filecrafters.in',
      role: 'Admin',
      status: 'active',
    },
  },
  orders: {
    'visual-order-001': {
      uid: 'visual-student',
      studentID: 'FC-VIS001',
      studentName: 'Morgan Lee',
      email: 'student@example.test',
      fileType: 'Project File',
      subject: 'Data Structures',
      course: 'B.Tech Computer Science',
      rollNumber: '24001001',
      topic: 'Library Management System',
      fileQuantity: 1,
      status: 'Printing',
      createdAt: '2026-10-12T10:00:00.000Z',
      pricing: { totalAmount: 500 },
      paymentDetails: { status: 'Paid', transactionId: 'VIS-PAY-001' },
      projectDetails: {
        subject: 'Data Structures',
        topic: 'Library Management System',
        submittedTo: 'Dr. Taylor Chen',
        submittedBy: 'Morgan Lee',
        rollNumber: '24001001',
        course: 'B.Tech Computer Science',
        estimatedPages: 50,
      },
      printSettings: { pagesLabel: '50', binding: 'Spiral' },
    },
    'visual-order-002': {
      uid: 'visual-student',
      studentID: 'FC-VIS001',
      studentName: 'Morgan Lee',
      email: 'student@example.test',
      fileType: 'Practical File',
      subject: 'Database Systems',
      course: 'B.Tech Computer Science',
      rollNumber: '24001001',
      topic: 'SQL Practical Record',
      fileQuantity: 1,
      status: 'Delivered',
      createdAt: '2026-10-10T10:00:00.000Z',
      pricing: { totalAmount: 300 },
      paymentDetails: { status: 'Paid', transactionId: 'VIS-PAY-002' },
      projectDetails: {
        subject: 'Database Systems',
        topic: 'SQL Practical Record',
        submittedTo: 'Dr. Taylor Chen',
        submittedBy: 'Morgan Lee',
        rollNumber: '24001001',
        course: 'B.Tech Computer Science',
        estimatedPages: 30,
      },
      printSettings: { pagesLabel: '30', binding: 'Spiral' },
    },
    'visual-order-003': {
      uid: 'visual-student-02',
      studentID: 'FC-VIS002',
      studentName: 'Jamie Patel',
      email: 'jamie@example.test',
      fileType: 'Assignment File',
      subject: 'Operating Systems',
      status: 'Pending',
      createdAt: '2026-10-11T10:00:00.000Z',
      pricing: { totalAmount: 150 },
      projectDetails: {
        subject: 'Operating Systems',
        topic: 'Process Scheduling',
        submittedBy: 'Jamie Patel',
        submittedTo: 'Dr. Taylor Chen',
        rollNumber: '24001002',
        course: 'B.Tech Computer Science',
        estimatedPages: 20,
      },
      printSettings: { pagesLabel: '20', binding: 'Soft Bound' },
    },
  },
  complaints: {
    'visual-ticket-001': {
      uid: 'visual-student',
      studentID: 'FC-VIS001',
      name: 'Morgan Lee',
      email: 'student@example.test',
      category: 'payment',
      subject: 'Payment confirmation',
      message: 'Please confirm the advance payment for my project file.',
      status: 'In Progress',
      adminReply: 'Payment received. Your order is being prepared.',
      createdAt: '2026-10-13T09:30:00.000Z',
    },
  },
};

let nextKey = 1;

export function ref(_database: Database, path: string = ''): DatabaseReference {
  const cleanPath = path ? path.replace(/^\/+|\/+$/g, '') : '';
  const segments = cleanPath.split('/').filter(Boolean);
  const key = segments.length > 0 ? segments[segments.length - 1] : null;
  return { path: cleanPath, key };
}

export function onValue(
  reference: DatabaseReference,
  callback: (snapshot: ReturnType<typeof createSnapshot>) => void,
  _errorOrOptions?: ((error: Error) => void) | { onlyOnce?: boolean },
  _options?: { onlyOnce?: boolean },
): () => void {
  callback(createSnapshot(readPath(reference.path)));
  return () => undefined;
}

export function off(_reference?: DatabaseReference): void {}

export async function get(reference: DatabaseReference) {
  return createSnapshot(readPath(reference.path));
}

export async function set(reference: DatabaseReference, value: DatabaseValue): Promise<void> {
  writePath(reference.path, value);
}

export async function update(reference: DatabaseReference, value: object): Promise<void> {
  const current = readPath(reference.path);
  const merged = typeof current === 'object' && current !== null
    ? { ...(current as Record<string, unknown>), ...(value as Record<string, unknown>) }
    : value;
  writePath(reference.path, merged);
}

export async function remove(reference: DatabaseReference): Promise<void> {
  writePath(reference.path, null);
}

export function push(reference: DatabaseReference): DatabaseReference {
  const k = `visual-created-${nextKey++}`;
  const p = reference.path ? `${reference.path}/${k}` : k;
  return { path: p, key: k };
}

export function query(reference: DatabaseReference, ..._queryConstraints: any[]): DatabaseReference {
  return reference;
}

export function orderByChild(_path: string): any {
  return {};
}

export function equalTo(_value: any): any {
  return {};
}

export function limitToFirst(_limit: number): any {
  return {};
}

export function limitToLast(_limit: number): any {
  return {};
}

export function startAt(_value: any): any {
  return {};
}

export function endAt(_value: any): any {
  return {};
}

export function serverTimestamp(): any {
  return new Date().toISOString();
}

export async function runTransaction(
  reference: DatabaseReference,
  transactionUpdate: (currentData: any) => any,
): Promise<{ committed: boolean; snapshot: ReturnType<typeof createSnapshot> }> {
  const current = readPath(reference.path);
  const updated = transactionUpdate(current);
  if (updated !== undefined) {
    writePath(reference.path, updated);
  }
  return { committed: true, snapshot: createSnapshot(updated) };
}

function readPath(path: string): any {
  return path.split('/').filter(Boolean).reduce<unknown>((value, part) => {
    if (typeof value !== 'object' || value === null) return undefined;
    return (value as Record<string, unknown>)[part];
  }, visualTestData) as DatabaseValue | undefined;
}

function writePath(path: string, value: DatabaseValue): void {
  const segments = path.split('/').filter(Boolean);
  const lastSegment = segments.pop();
  if (!lastSegment) return;

  const parent = segments.reduce<Record<string, unknown>>((current, segment) => {
    if (typeof current[segment] !== 'object' || current[segment] === null) {
      current[segment] = {};
    }
    return current[segment] as Record<string, unknown>;
  }, visualTestData);

  if (value === null) delete parent[lastSegment];
  else parent[lastSegment] = value;
}

function createSnapshot(value: any) {
  return {
    exists: () => value !== undefined && value !== null,
    val: () => value ?? null,
  };
}
import assert from 'node:assert/strict';
import test from 'node:test';
import { planLegacyUploadMigration, reconcileUploadReferences } from './local-upload-reconciliation.mjs';

const pdf = content => `data:application/pdf;base64,${Buffer.from(`%PDF-1.7\n${content}`).toString('base64')}`;

test('legacy planner recognizes both existing Data URL shapes without returning file content', () => {
  const report = planLegacyUploadMigration({ orders: {
    orderA: { uid: 'student-a', uploadDetails: { files: [{ name: 'report.pdf', dataUrl: pdf('synthetic A') }] } },
    orderB: { uid: 'student-b', uploadDetails: { uploadedFileDataUrl: pdf('synthetic B'), fileName: 'notes.pdf' } }
  } });
  assert.equal(report.candidates.length, 2);
  assert.equal(report.candidates[0].destinationPath.startsWith('student-uploads/student-a/orderA/'), true);
  assert.equal(report.issues.length, 0);
  assert.equal(JSON.stringify(report).includes('data:application/pdf'), false);
});

test('legacy planner reports missing owners, malformed PDFs, oversized files and duplicate content', () => {
  const same = pdf('same synthetic bytes');
  const oversized = `data:application/pdf;base64,${Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(1024 * 1024)]).toString('base64')}`;
  const report = planLegacyUploadMigration({ orders: {
    one: { uid: 'student-a', uploadDetails: { files: [{ dataUrl: same }, { dataUrl: 'not-a-data-url' }, { dataUrl: oversized }] } },
    two: { uid: 'student-b', uploadDetails: { uploadedFileDataUrl: same } },
    ownerMissing: { uploadDetails: { uploadedFileDataUrl: same } }
  } });
  assert.equal(report.candidates.length, 2);
  assert.equal(report.duplicateContent.length, 1);
  assert.deepEqual(new Set(report.issues.map(issue => issue.reason)), new Set([
    'unsupported-or-malformed-data-url', 'over-current-upload-limit', 'missing-order-owner'
  ]));
});

test('orphan reconciliation is dry-run, UID-scoped, and reports missing object references', () => {
  const linked = 'student-uploads/student-a/order-a/file.pdf';
  const orphan = 'student-uploads/student-a/order-old/legacy.pdf';
  const foreign = 'student-uploads/student-b/order-b/private.pdf';
  const report = reconcileUploadReferences('student-a', [linked, orphan, foreign], {
    'order-a': { uid: 'student-a', uploadDetails: { files: [{ storagePath: linked }] } },
    'order-missing': { uid: 'student-a', uploadDetails: { files: [{ storagePath: 'student-uploads/student-a/order-missing/missing.pdf' }] } },
    'order-invalid-reference': { uid: 'student-a', uploadDetails: { files: [{ storagePath: 'student-uploads/student-b/order-b/private.pdf' }] } }
  });
  assert.deepEqual(report.linked, [linked]);
  assert.deepEqual(report.unreferencedCandidates, [{ path: orphan, action: 'manual-review-required' }]);
  assert.deepEqual(report.outsideUidScope, [foreign]);
  assert.equal(report.missingStorageObjects.length, 1);
  assert.equal(report.invalidReferences.length, 1);
  assert.equal(report.deletesPerformed, 0);
});

test('orphan reconciliation rejects missing or path-unsafe user scopes', () => {
  for (const uid of ['', '../student-a', 'student/a', 'student.a']) {
    assert.throws(() => reconcileUploadReferences(uid, [], {}));
  }
  assert.throws(() => reconcileUploadReferences('student-a', null, {}));
});

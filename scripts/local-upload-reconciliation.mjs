import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MAX_UPLOAD_BYTES = 1024 * 1024;

function pdfDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== 'string') return { error: 'missing-data-url' };
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/]*={0,2})$/i.exec(dataUrl);
  if (!match) return { error: 'unsupported-or-malformed-data-url' };
  const bytes = Buffer.from(match[1], 'base64');
  if (!bytes.length || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') return { error: 'invalid-pdf-signature' };
  if (bytes.length > MAX_UPLOAD_BYTES) return { error: 'over-current-upload-limit', size: bytes.length };
  return { bytes };
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Inspect only the two legacy shapes still read by the application. The result
 * contains locators and hashes, never the embedded PDF bytes or Data URL.
 */
export function planLegacyUploadMigration(databaseExport) {
  const orders = databaseExport?.orders ?? databaseExport ?? {};
  const candidates = [];
  const issues = [];

  for (const [orderId, order] of Object.entries(orders)) {
    const uid = typeof order?.uid === 'string' ? order.uid : '';
    const fileEntries = [];
    const files = order?.uploadDetails?.files;
    if (Array.isArray(files)) {
      files.forEach((file, index) => {
        if (file && Object.hasOwn(file, 'dataUrl')) fileEntries.push({ locator: `uploadDetails.files.${index}.dataUrl`, name: file.name ?? `legacy-${index + 1}.pdf`, dataUrl: file.dataUrl });
      });
    }
    if (order?.uploadDetails && Object.hasOwn(order.uploadDetails, 'uploadedFileDataUrl')) {
      fileEntries.push({ locator: 'uploadDetails.uploadedFileDataUrl', name: order.uploadDetails.fileName ?? 'legacy-upload.pdf', dataUrl: order.uploadDetails.uploadedFileDataUrl });
    }

    fileEntries.forEach((entry, index) => {
      const common = { orderId, uid: uid || null, sourceLocator: entry.locator, fileName: String(entry.name).slice(0, 180) };
      if (!uid) {
        issues.push({ ...common, reason: 'missing-order-owner' });
        return;
      }
      const parsed = pdfDataUrlBytes(entry.dataUrl);
      if (parsed.error) {
        issues.push({ ...common, reason: parsed.error, ...(parsed.size ? { size: parsed.size } : {}) });
        return;
      }
      const hash = sha256(parsed.bytes);
      candidates.push({
        ...common,
        size: parsed.bytes.length,
        sha256: hash,
        destinationPath: `student-uploads/${uid}/${orderId}/legacy-${index + 1}-${hash.slice(0, 12)}.pdf`
      });
    });
  }

  const byHash = new Map();
  for (const candidate of candidates) {
    const matches = byHash.get(candidate.sha256) ?? [];
    matches.push({ orderId: candidate.orderId, sourceLocator: candidate.sourceLocator });
    byHash.set(candidate.sha256, matches);
  }

  return {
    mode: 'dry-run-only',
    maxUploadBytes: MAX_UPLOAD_BYTES,
    candidates,
    issues,
    duplicateContent: [...byHash.entries()]
      .filter(([, matches]) => matches.length > 1)
      .map(([sha256, matches]) => ({ sha256, matches }))
  };
}

/**
 * Compare a locally supplied Storage object listing to exported order metadata.
 * Unreferenced files are candidates for review only; this function never deletes.
 */
export function reconcileUploadReferences(uid, storagePaths, orders) {
  if (typeof uid !== 'string' || !uid || /[.#$\[\]/]/.test(uid)) throw new Error('A valid Firebase UID is required for scoped reconciliation.');
  if (!Array.isArray(storagePaths)) throw new Error('A Storage object path list is required.');
  const expected = new Set();
  const invalidReferences = [];
  for (const [orderId, order] of Object.entries(orders ?? {})) {
    if (order?.uid !== uid) continue;
    const fileRefs = order?.uploadDetails?.files;
    if (Array.isArray(fileRefs)) {
      for (const file of fileRefs) {
        if (typeof file?.storagePath !== 'string') continue;
        if (!file.storagePath.startsWith(`student-uploads/${uid}/${orderId}/`)) invalidReferences.push({ orderId, path: file.storagePath, reason: 'reference-outside-owner-order-path' });
        else expected.add(file.storagePath);
      }
    }
  }

  const linked = [];
  const unreferencedCandidates = [];
  const outsideUidScope = [];
  for (const path of storagePaths ?? []) {
    if (typeof path !== 'string' || !path.startsWith(`student-uploads/${uid}/`)) {
      outsideUidScope.push(path);
    } else if (expected.has(path)) {
      linked.push(path);
    } else {
      unreferencedCandidates.push({ path, action: 'manual-review-required' });
    }
  }

  const existing = new Set(storagePaths ?? []);
  const missingStorageObjects = [...expected].filter(path => !existing.has(path));
  return { linked, unreferencedCandidates, missingStorageObjects, invalidReferences, outsideUidScope, deletesPerformed: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const inputFlag = process.argv.indexOf('--input');
  const inputPath = inputFlag >= 0 ? process.argv[inputFlag + 1] : null;
  if (!inputPath) {
    console.error('Usage: node scripts/local-upload-reconciliation.mjs --input <local-database-export.json>');
    process.exitCode = 2;
  } else {
    const source = JSON.parse(await readFile(inputPath, 'utf8'));
    console.log(JSON.stringify(planLegacyUploadMigration(source), null, 2));
  }
}

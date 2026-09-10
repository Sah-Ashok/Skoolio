import { BlobServiceClient } from '@azure/storage-blob';
import pool from '../config/db';

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set in environment variables.');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

// Unified container for all school data
export const SCHOOL_DATA_CONTAINER = process.env.AZURE_SCHOOL_DATA_CONTAINER || 'school-data';

/**
 * Helper to generate URL-safe, human-readable unique school directory slug:
 * e.g. "Gurukul Pathshala" -> "gurukul-pathshala-10"
 */
export const generateSchoolStorageFolder = (schoolName: string, schoolId: number): string => {
  const slug = (schoolName || 'school')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'school'}-${schoolId}`;
};

/**
 * Initialize a directory for a school inside the `school-data` container.
 * Uploads a lightweight .initialized marker blob so the folder appears in Azure Storage Browser.
 */
export const initializeSchoolStorage = async (
  storageFolder: string,
  schoolMeta: { id: number; school_name: string }
): Promise<string> => {
  const container = blobServiceClient.getContainerClient(SCHOOL_DATA_CONTAINER);
  await container.createIfNotExists({ access: 'blob' });

  const blobName = `${storageFolder}/.initialized`;
  const blockBlob = container.getBlockBlobClient(blobName);

  const markerContent = JSON.stringify({
    school_id: schoolMeta.id,
    school_name: schoolMeta.school_name,
    storage_folder: storageFolder,
    initialized_at: new Date().toISOString(),
  });

  await blockBlob.uploadData(Buffer.from(markerContent, 'utf8'), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
  });

  return blockBlob.url;
};

/**
 * Resolve or retrieve the school's storage_folder from the DB,
 * falling back to generated slug if not yet set in DB.
 */
export const resolveSchoolStorageFolder = async (schoolId: number): Promise<string> => {
  try {
    const res = await pool.query(`SELECT storage_folder, school_name FROM schools WHERE id = $1`, [schoolId]);
    if (res.rows.length) {
      if (res.rows[0].storage_folder) {
        return res.rows[0].storage_folder;
      }
      // If column is null, compute it and persist it
      const computed = generateSchoolStorageFolder(res.rows[0].school_name, schoolId);
      await pool.query(`UPDATE schools SET storage_folder = $1 WHERE id = $2`, [computed, schoolId]);
      return computed;
    }
  } catch (err) {
    console.warn('[Storage] Could not query storage_folder from DB:', (err as any).message);
  }
  return `school-${schoolId}`;
};

/**
 * Upload a buffer to Azure Blob Storage.
 * Returns the public URL of the uploaded blob.
 */
export const uploadToAzure = async (
  containerName: string,
  blobName:      string,
  buffer:        Buffer,
  mimeType:      string
): Promise<string> => {
  const container = blobServiceClient.getContainerClient(containerName);
  await container.createIfNotExists({ access: 'blob' });
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlob.url;
};

/**
 * Delete a blob if it exists. Safe to call even if the blob doesn't exist yet.
 */
export const deleteFromAzure = async (
  containerName: string,
  blobName:      string
): Promise<void> => {
  const container = blobServiceClient.getContainerClient(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.deleteIfExists();
};

// ── Deterministic blob name helpers within the school's folder ───────────────

export const getLogoBlob = (folder: string, ext: string) =>
  `${folder}/logo.${ext.toLowerCase().replace('.', '')}`;

export const getTeacherBlob = (folder: string, teacher_id: number, ext: string) =>
  `${folder}/teachers/${teacher_id}.${ext.toLowerCase().replace('.', '')}`;

export const getStudentBlob = (folder: string, student_id: number, ext: string) =>
  `${folder}/students/${student_id}.${ext.toLowerCase().replace('.', '')}`;

export const getPaymentScreenshotBlob = (folder: string, student_id: number, timestamp: number, ext: string) =>
  `${folder}/payment-screenshots/${student_id}/${timestamp}.${ext.toLowerCase().replace('.', '')}`;

export const getQrCodeBlob = (folder: string, account_id: number, ext: string) =>
  `${folder}/qr-codes/${account_id}.${ext.toLowerCase().replace('.', '')}`;

export const getReceiptBlob = (folder: string, receipt_number: string) =>
  `${folder}/receipts/${receipt_number}.pdf`;

export interface ISchoolStorageUsage {
  totalBytes: number;
  totalMB: string;
  totalFiles: number;
  breakdown: {
    logos: { count: number; bytes: number };
    profiles: { count: number; bytes: number };
    screenshots: { count: number; bytes: number };
    qrCodes: { count: number; bytes: number };
    receipts: { count: number; bytes: number };
  };
}

/**
 * Calculates total storage used by a school by scanning its directory prefix
 * in the unified `school-data` container.
 */
export const getSchoolStorageUsage = async (school_id: number): Promise<ISchoolStorageUsage> => {
  const breakdown = {
    logos: { count: 0, bytes: 0 },
    profiles: { count: 0, bytes: 0 },
    screenshots: { count: 0, bytes: 0 },
    qrCodes: { count: 0, bytes: 0 },
    receipts: { count: 0, bytes: 0 },
  };

  let totalBytes = 0;
  let totalFiles = 0;

  try {
    const folder = await resolveSchoolStorageFolder(school_id);
    const container = blobServiceClient.getContainerClient(SCHOOL_DATA_CONTAINER);
    const prefix = `${folder}/`;

    for await (const blob of container.listBlobsFlat({ prefix })) {
      // Don't count the .initialized marker in file counts/breakdowns
      if (blob.name.endsWith('/.initialized')) continue;

      const size = blob.properties.contentLength || 0;
      totalBytes += size;
      totalFiles++;

      if (blob.name.includes('/logo.')) {
        breakdown.logos.count++;
        breakdown.logos.bytes += size;
      } else if (blob.name.includes('/teachers/') || blob.name.includes('/students/')) {
        breakdown.profiles.count++;
        breakdown.profiles.bytes += size;
      } else if (blob.name.includes('/payment-screenshots/')) {
        breakdown.screenshots.count++;
        breakdown.screenshots.bytes += size;
      } else if (blob.name.includes('/qr-codes/')) {
        breakdown.qrCodes.count++;
        breakdown.qrCodes.bytes += size;
      } else if (blob.name.includes('/receipts/')) {
        breakdown.receipts.count++;
        breakdown.receipts.bytes += size;
      }
    }
  } catch (err) {
    console.warn('[Storage] Error querying blob usage:', (err as any).message);
  }

  return {
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    totalFiles,
    breakdown,
  };
};

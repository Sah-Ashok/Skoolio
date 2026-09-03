import { BlobServiceClient } from '@azure/storage-blob';

if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
  throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set in environment variables.');
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

/**
 * Upload a buffer to Azure Blob Storage.
 * Returns the public URL of the uploaded blob.
 * Uploading to an existing blobName silently overwrites it —
 * use deterministic names (school_id, teacher_id, student_id) so
 * orphaned blobs never accumulate.
 */
export const uploadToAzure = async (
  containerName: string,
  blobName:      string,
  buffer:        Buffer,
  mimeType:      string
): Promise<string> => {
  const container = blobServiceClient.getContainerClient(containerName);
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

// ── Deterministic blob name helpers ──────────────────────────────────────────

export const getLogoBlob = (school_id: number, ext: string) =>
  `${school_id}.${ext.toLowerCase().replace('.', '')}`;

export const getTeacherBlob = (school_id: number, teacher_id: number, ext: string) =>
  `teachers/${school_id}/${teacher_id}.${ext.toLowerCase().replace('.', '')}`;

export const getStudentBlob = (school_id: number, student_id: number, ext: string) =>
  `students/${school_id}/${student_id}.${ext.toLowerCase().replace('.', '')}`;

export const getPaymentScreenshotBlob = (school_id: number, student_id: number, timestamp: number, ext: string) =>
  `payment-screenshots/${school_id}/${student_id}/${timestamp}.${ext.toLowerCase().replace('.', '')}`;

export const getQrCodeBlob = (school_id: number, account_id: number, ext: string) =>
  `qr-codes/${school_id}/${account_id}.${ext.toLowerCase().replace('.', '')}`;

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

export const getSchoolStorageUsage = async (school_id: number): Promise<ISchoolStorageUsage> => {
  const breakdown = {
    logos: { count: 0, bytes: 0 },
    profiles: { count: 0, bytes: 0 },
    screenshots: { count: 0, bytes: 0 },
    qrCodes: { count: 0, bytes: 0 },
    receipts: { count: 0, bytes: 0 },
  };

  try {
    const LOGOS_CONTAINER       = process.env.AZURE_LOGOS_CONTAINER       || 'skoolio-logos';
    const PROFILES_CONTAINER    = process.env.AZURE_PROFILES_CONTAINER    || 'skoolio-profiles';
    const SCREENSHOTS_CONTAINER = process.env.AZURE_SCREENSHOTS_CONTAINER || 'skoolio-screenshots';
    const QR_CODES_CONTAINER    = process.env.AZURE_QR_CODES_CONTAINER    || 'bank-qr';
    const RECEIPTS_CONTAINER   = process.env.AZURE_RECEIPTS_CONTAINER    || 'school-receipts';

    const scanContainer = async (containerName: string, prefixes: string[]) => {
      let count = 0;
      let bytes = 0;
      try {
        const container = blobServiceClient.getContainerClient(containerName);
        for (const prefix of prefixes) {
          for await (const blob of container.listBlobsFlat({ prefix })) {
            count++;
            bytes += blob.properties.contentLength || 0;
          }
        }
      } catch (e) {
        // Container might not exist yet or empty
      }
      return { count, bytes };
    };

    const [logoStats, profStats, scrStats, qrStats, rcpStats] = await Promise.all([
      scanContainer(LOGOS_CONTAINER, [`${school_id}.`]),
      scanContainer(PROFILES_CONTAINER, [`teachers/${school_id}/`, `students/${school_id}/`]),
      scanContainer(SCREENSHOTS_CONTAINER, [`payment-screenshots/${school_id}/`]),
      scanContainer(QR_CODES_CONTAINER, [`qr-codes/${school_id}/`]),
      scanContainer(RECEIPTS_CONTAINER, [`School-Receipt/${school_id}/`]),
    ]);

    breakdown.logos = logoStats;
    breakdown.profiles = profStats;
    breakdown.screenshots = scrStats;
    breakdown.qrCodes = qrStats;
    breakdown.receipts = rcpStats;
  } catch (err) {
    console.warn('[Storage] Error querying blob usage:', (err as any).message);
  }

  const totalBytes =
    breakdown.logos.bytes +
    breakdown.profiles.bytes +
    breakdown.screenshots.bytes +
    breakdown.qrCodes.bytes +
    breakdown.receipts.bytes;

  const totalFiles =
    breakdown.logos.count +
    breakdown.profiles.count +
    breakdown.screenshots.count +
    breakdown.qrCodes.count +
    breakdown.receipts.count;

  return {
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    totalFiles,
    breakdown,
  };
};

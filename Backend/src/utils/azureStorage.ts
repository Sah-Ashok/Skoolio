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
  blobName:      string,   // e.g. "teachers/42/7.jpg"
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
// Extension is always lowercase and stripped of the dot.
// Overwriting the same blobName replaces the old file — no cleanup needed.

export const getLogoBlob = (school_id: number, ext: string) =>
  `${school_id}.${ext.toLowerCase().replace('.', '')}`;

export const getTeacherBlob = (school_id: number, teacher_id: number, ext: string) =>
  `teachers/${school_id}/${teacher_id}.${ext.toLowerCase().replace('.', '')}`;

export const getStudentBlob = (school_id: number, student_id: number, ext: string) =>
  `students/${school_id}/${student_id}.${ext.toLowerCase().replace('.', '')}`;

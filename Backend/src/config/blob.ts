// ── config/blob.ts ────────────────────────────────────────────────────────────
// Azure Blob Storage client for receipt PDFs.
// Container layout: school-data / <storage_folder> / receipts / <receipt_number>.pdf
// ─────────────────────────────────────────────────────────────────────────────
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { SCHOOL_DATA_CONTAINER, resolveSchoolStorageFolder, getReceiptBlob } from '../utils/azureStorage';

// Lazy — only created on first use so missing env var doesn't crash startup
let _client:    BlobServiceClient | null  = null;
let _container: ContainerClient   | null  = null;
let _ready      = false;

function getClient(): BlobServiceClient {
  if (_client) return _client;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set in .env');
  _client = BlobServiceClient.fromConnectionString(conn);
  return _client;
}

async function getContainer(): Promise<ContainerClient> {
  if (_container && _ready) return _container;
  _container = getClient().getContainerClient(SCHOOL_DATA_CONTAINER);
  if (!_ready) {
    await _container.createIfNotExists({ access: 'blob' });
    _ready = true;
  }
  return _container;
}

/**
 * Upload a PDF buffer to:
 *   school-data/<storage_folder>/receipts/<receipt_number>.pdf
 *
 * Idempotent — uploading again overwrites the same blob.
 * Returns the public URL of the uploaded blob.
 */
export async function uploadReceiptPDF(
  school_id:      number,
  receipt_number: string,
  pdfBuffer:      Buffer
): Promise<string> {
  const container = await getContainer();
  const folder    = await resolveSchoolStorageFolder(school_id);
  const blobName  = getReceiptBlob(folder, receipt_number);
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(pdfBuffer, {
    blobHTTPHeaders: {
      blobContentType:        'application/pdf',
      blobContentDisposition: `inline; filename="${receipt_number}.pdf"`,
    },
  });

  return blockBlob.url;
}

/**
 * Returns the public URL if the blob exists, or null if not yet generated.
 */
export async function getReceiptURL(
  school_id:      number,
  receipt_number: string
): Promise<string | null> {
  const container = await getContainer();
  const folder    = await resolveSchoolStorageFolder(school_id);
  const blobName  = getReceiptBlob(folder, receipt_number);
  const blockBlob = container.getBlockBlobClient(blobName);
  const exists    = await blockBlob.exists();
  return exists ? blockBlob.url : null;
}

/**
 * Delete a receipt blob — call when a payment record is voided.
 * Safe to call even if blob doesn't exist.
 */
export async function deleteReceiptPDF(
  school_id:      number,
  receipt_number: string
): Promise<void> {
  try {
    const container = await getContainer();
    const folder    = await resolveSchoolStorageFolder(school_id);
    const blobName  = getReceiptBlob(folder, receipt_number);
    await container.deleteBlob(blobName, { deleteSnapshots: 'include' });
  } catch {
    // Ignore — blob already deleted or doesn't exist
  }
}

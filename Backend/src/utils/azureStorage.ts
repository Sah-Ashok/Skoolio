import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob';
import AppError from './AppError';

// ── Client (lazy-initialised so missing env doesn't crash at import) ─────────

let _client: BlobServiceClient | null = null;

const getClient = (): BlobServiceClient => {
  if (_client) return _client;
  const connStr = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connStr) throw new AppError('Azure Storage is not configured.', 500);
  _client = BlobServiceClient.fromConnectionString(connStr);
  return _client;
};

// ── Container names from env ──────────────────────────────────────────────────

const LOGOS_CONTAINER    = () => process.env.AZURE_LOGOS_CONTAINER    || 'skoolio-logos';
const PROFILES_CONTAINER = () => process.env.AZURE_PROFILES_CONTAINER || 'skoolio-profiles';

// ── Deterministic blob name helpers ──────────────────────────────────────────
// Uploading to the same path overwrites the previous blob — no orphaned files.

export const getLogoBlob    = (school_id: number,  ext: string) =>
  `${school_id}.${ext}`;

export const getTeacherBlob = (school_id: number,  teacher_id: number, ext: string) =>
  `teachers/${school_id}/${teacher_id}.${ext}`;

export const getStudentBlob = (school_id: number,  student_id: number, ext: string) =>
  `students/${school_id}/${student_id}.${ext}`;

// ── Core upload helper ────────────────────────────────────────────────────────

export const uploadToAzure = async (
  containerName: string,
  blobName:      string,
  buffer:        Buffer,
  mimeType:      string
): Promise<string> => {
  const container  = getClient().getContainerClient(containerName);
  const blockBlob: BlockBlobClient = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType },
  });

  return blockBlob.url;
};

// ── Delete helper (best-effort, never throws) ─────────────────────────────────

export const deleteFromAzure = async (
  containerName: string,
  blobName:      string
): Promise<void> => {
  try {
    const container = getClient().getContainerClient(containerName);
    await container.getBlockBlobClient(blobName).deleteIfExists();
  } catch {
    // non-critical — log but don't propagate
    console.warn(`[Azure] deleteIfExists failed: ${containerName}/${blobName}`);
  }
};

// ── Typed upload wrappers used by controllers ─────────────────────────────────

export const uploadSchoolLogo = async (
  school_id: number,
  buffer:    Buffer,
  mimeType:  string,
  ext:       string
): Promise<string> => {
  const blobName = getLogoBlob(school_id, ext);
  return uploadToAzure(LOGOS_CONTAINER(), blobName, buffer, mimeType);
};

export const uploadTeacherPhoto = async (
  school_id:  number,
  teacher_id: number,
  buffer:     Buffer,
  mimeType:   string,
  ext:        string
): Promise<string> => {
  const blobName = getTeacherBlob(school_id, teacher_id, ext);
  return uploadToAzure(PROFILES_CONTAINER(), blobName, buffer, mimeType);
};

export const uploadStudentPhoto = async (
  school_id:  number,
  student_id: number,
  buffer:     Buffer,
  mimeType:   string,
  ext:        string
): Promise<string> => {
  const blobName = getStudentBlob(school_id, student_id, ext);
  return uploadToAzure(PROFILES_CONTAINER(), blobName, buffer, mimeType);
};

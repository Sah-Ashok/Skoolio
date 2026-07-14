/**
 * uploadChunked.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Splits a File into fixed-size chunks and POSTs them one by one to the
 * backend chunked-upload endpoint.
 *
 * Each request is multipart/form-data with a single field "chunk".
 * The following custom headers are added per request:
 *   x-upload-id     – unique session ID (crypto UUID)
 *   x-chunk-index   – 0-based index of this slice
 *   x-total-chunks  – total number of slices
 *   x-mime-type     – original MIME type of the file
 *
 * The server reassembles the buffer on its last chunk and pushes to Azure.
 *
 * @param file        The File object to upload
 * @param endpoint    Full API path, e.g. "/upload/student-photo/9/chunk"
 * @param onProgress  Called with 0-100 as each chunk completes
 * @returns           The JSON body returned on the final chunk (contains { url })
 */

const API_BASE_URL  = 'http://localhost:5001/api';
const CHUNK_SIZE    = 512 * 1024; // 512 KB per chunk

export async function uploadChunked(
  file:        File,
  endpoint:    string,
  onProgress?: (pct: number) => void,
): Promise<any> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId    = crypto.randomUUID();

  let lastResponse: any = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end   = Math.min(start + CHUNK_SIZE, file.size);
    // Pass the original MIME type explicitly so the browser labels the
    // multipart part as e.g. "image/png" instead of "application/octet-stream"
    const slice = file.slice(start, end, file.type);

    const fd = new FormData();
    fd.append('chunk', slice, file.name);           // field name expected by multer

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method:      'POST',
      credentials: 'include',
      headers: {
        'x-upload-id':    uploadId,
        'x-chunk-index':  String(i),
        'x-total-chunks': String(totalChunks),
        'x-mime-type':    file.type,
        // NOTE: do NOT set Content-Type here — browser sets multipart boundary
      },
      body: fd,
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.message || `Chunk ${i + 1}/${totalChunks} failed`);
    }

    lastResponse = data;

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalChunks) * 100));
    }
  }

  return lastResponse;
}

const API_BASE_URL = 'http://localhost:5001/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // If body is FormData, don't set Content-Type — let the browser set it
  // automatically with the correct multipart boundary for file uploads.
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    headers: isFormData
      ? { ...options.headers }                              // no Content-Type
      : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
}

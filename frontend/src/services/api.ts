const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('prakash_auth_token');

  const headers = new Headers(options.headers);

  // Only set JSON content type when there is a body and it is not FormData.
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // DELETE endpoints often return 204 No Content.
  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiError('API request failed', response.status);
    }

    return undefined as T;
  }

  const contentType = response.headers.get('content-type');

  let data: any = null;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    const text = await response.text();

    data = text
      ? { message: text }
      : {};
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message ||
        data?.error ||
        `API request failed (${response.status})`,
      response.status,
      data
    );
  }

  return data as T;
}

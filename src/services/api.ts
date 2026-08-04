import { API_BASE_URL, API_HINT } from '../constants/api';
import { userFacingError } from '../utils/userFacingError';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
};

function statusFallback(status: number): string {
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find that.";
  if (status === 409) return 'That already exists. Try something else.';
  if (status === 429) return 'Too many tries. Please wait a bit and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Something went wrong. Please try again.';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 12000 } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal as any,
    });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    if (__DEV__) {
      console.warn(
        aborted ? 'API timeout' : 'API unreachable',
        `${API_BASE_URL}${path}`,
        API_HINT,
        err,
      );
    }
    throw new ApiError(
      0,
      aborted
        ? 'This is taking too long. Please try again in a moment.'
        : "Can't connect right now. Check your internet and try again.",
    );
  } finally {
    clearTimeout(timer);
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const raw = typeof data?.error === 'string' ? data.error : '';
    const code = typeof data?.code === 'string' ? data.code : undefined;
    const message = userFacingError(
      { status: res.status, message: raw },
      statusFallback(res.status),
    );
    if (__DEV__) {
      console.warn('API error', res.status, path, raw || message, code);
    }
    throw new ApiError(res.status, message, code);
  }

  return data as T;
}

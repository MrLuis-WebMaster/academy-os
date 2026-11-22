/** One transport adapter for all AcademyOS web features. No domain policy belongs here. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function workspacePath(workspaceId: string, path: string): string {
  if (!workspaceId || !path.startsWith('/')) throw new Error('Invalid workspace API path');
  return '/api/v1/workspaces/' + encodeURIComponent(workspaceId) + path;
}

export async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  // Several legacy screens already send JSON.stringify() without a Content-Type.
  // Express will not parse such requests as JSON; normalize centrally.
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, {credentials: 'same-origin', ...options, headers});
  let body: unknown;
  try { body = await response.json() as unknown; } catch { body = null; }

  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? (typeof body.message === 'string'
        ? body.message
        : Array.isArray(body.message) ? body.message.join(', ') : null)
      : null;
    const fallback = response.status === 401 ? 'Inicia sesión nuevamente para continuar.'
      : response.status === 403 ? 'No tienes permiso para realizar esta acción.'
      : response.status === 429 ? 'Has realizado demasiadas solicitudes. Inténtalo más tarde.'
      : response.status >= 500 ? 'El servidor no pudo completar la operación.' : 'No se pudo completar la solicitud.';
    throw new ApiError(message || fallback, response.status);
  }
  return body as T;
}

/** JSON helper used by presentation adapters. */
export function apiJson<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(url,{
    method,
    ...(body !== undefined ? {headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {}),
  });
}

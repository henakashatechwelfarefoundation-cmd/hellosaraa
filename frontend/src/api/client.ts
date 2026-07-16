/**
 * Lightweight typed API client for the Hello Sara backend.
 * Bearer token pulled from secure storage; every /api call is prefixed here.
 */
import { storage } from '@/src/utils/storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';
export const TOKEN_KEY = 'hs.auth.token';

export interface ApiError {
  status: number;
  detail: string;
}

export async function readToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, '' as string);
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await readToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

  if (!res.ok) {
    const detail = (data && typeof data === 'object' && 'detail' in data) ? (data as any).detail : res.statusText;
    const err: ApiError = { status: res.status, detail: String(detail || 'Request failed') };
    throw err;
  }
  return data as T;
}

export const AuthApi = {
  register: (email: string, password: string, name: string) =>
    api<{ token: string; token_type: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  login: (email: string, password: string) =>
    api<{ token: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  googleSession: (session_token: string) =>
    api<{ token: string; token_type: string; user: any }>('/auth/google/session', {
      method: 'POST',
      body: JSON.stringify({ session_token }),
    }),
  me: () => api<any>('/auth/me'),
  logout: () => api<{ success: boolean }>('/auth/logout', { method: 'POST' }),
};

export const ProfileApi = {
  update: (payload: Record<string, unknown>) =>
    api<any>('/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
};

export const SettingsApi = {
  get: () => api<any>('/settings'),
  update: (payload: Record<string, unknown>) =>
    api<any>('/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
};

export const MemoriesApi = {
  list: (q?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api<any[]>(`/memories${qs}`);
  },
  create: (payload: { title: string; content: string; tags: string[] }) =>
    api<any>('/memories', { method: 'POST', body: JSON.stringify(payload) }),
  remove: (id: string) => api<any>(`/memories/${id}`, { method: 'DELETE' }),
};

export const HistoryApi = {
  list: (q?: string) => api<any[]>(`/history${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  clear: () => api<any>('/history', { method: 'DELETE' }),
};

export const NotesApi = {
  list: (q?: string) => api<any[]>(`/notes${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  create: (payload: { title: string; content: string; tags: string[]; color?: string; pinned?: boolean }) =>
    api<any>('/notes', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    api<any>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => api<any>(`/notes/${id}`, { method: 'DELETE' }),
};

export const RemindersApi = {
  list: () => api<any[]>('/reminders'),
  create: (payload: { title: string; notes?: string; remind_at: string }) =>
    api<any>('/reminders', { method: 'POST', body: JSON.stringify(payload) }),
  remove: (id: string) => api<any>(`/reminders/${id}`, { method: 'DELETE' }),
};

export const ChatApi = {
  send: (messages: { role: string; content: string }[], save_history = true) =>
    api<{ reply: string; provider: string; model: string; history_id?: string }>(
      '/chat', { method: 'POST', body: JSON.stringify({ messages, save_history }) },
    ),
};

export const TasksApi = {
  list: (completed?: boolean) =>
    api<any[]>(`/tasks${typeof completed === 'boolean' ? `?completed=${completed}` : ''}`),
  create: (payload: { title: string; notes?: string; due_at?: string; priority?: 'low' | 'medium' | 'high' }) =>
    api<any>('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Record<string, unknown>) =>
    api<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) => api<any>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const IntegrationsApi = {
  list: () => api<{ provider: string; label: string; configured: boolean; connected: boolean; connected_at?: string }[]>('/integrations'),
  connectUrl: (provider: string) => api<{ url: string }>(`/integrations/${provider}/connect-url`),
  disconnect: (provider: string) => api<any>(`/integrations/${provider}`, { method: 'DELETE' }),
  googleCalendarEvents: () => api<any[]>('/integrations/google/calendar/events'),
  googleGmailMessages: () => api<any[]>('/integrations/google/gmail/messages'),
  googleDriveFiles: () => api<any[]>('/integrations/google/drive/files'),
  googleTasks: () => api<any[]>('/integrations/google/tasks'),
  microsoftMailMessages: () => api<any[]>('/integrations/microsoft/mail/messages'),
  microsoftCalendarEvents: () => api<any[]>('/integrations/microsoft/calendar/events'),
  microsoftDriveFiles: () => api<any[]>('/integrations/microsoft/drive/files'),
  microsoftTodoTasks: () => api<any[]>('/integrations/microsoft/todo/tasks'),
  dropboxFiles: () => api<any[]>('/integrations/dropbox/files'),
  boxFiles: () => api<any[]>('/integrations/box/files'),
};

/**
 * Streams a chat reply token-by-token from /chat/stream.
 *
 * React Native's `fetch` does not reliably expose a readable stream on the
 * response body across engines, so this uses XMLHttpRequest's progressive
 * `responseText` (via `onprogress` / readyState 3) — the well-established
 * RN-compatible way to consume a chunked HTTP response.
 *
 * Returns an `abort()` function the caller can invoke to cancel the request.
 */
export function streamChat(
  messages: { role: string; content: string }[],
  handlers: {
    onChunk: (textSoFar: string, delta: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
  },
  save_history = true,
): () => void {
  const xhr = new XMLHttpRequest();
  let lastLength = 0;
  let aborted = false;

  readToken().then((token) => {
    if (aborted) return;
    try {
      xhr.open('POST', `${BASE_URL}/api/chat/stream`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.onprogress = () => {
        const full = xhr.responseText || '';
        const delta = full.slice(lastLength);
        lastLength = full.length;
        if (delta) handlers.onChunk(full, delta);
      };
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            const full = xhr.responseText || '';
            const delta = full.slice(lastLength);
            if (delta) handlers.onChunk(full, delta);
            handlers.onDone(full);
          } else {
            let detail = xhr.responseText || `Request failed (${xhr.status})`;
            try {
              const parsed = JSON.parse(detail);
              if (parsed && parsed.detail) detail = parsed.detail;
            } catch {}
            handlers.onError(detail);
          }
        }
      };
      xhr.onerror = () => handlers.onError('Network error reaching your AI provider.');
      xhr.send(JSON.stringify({ messages, save_history }));
    } catch (e: any) {
      handlers.onError(e?.message || 'Could not start stream.');
    }
  });

  return () => {
    aborted = true;
    try { xhr.abort(); } catch {}
  };
}

export const BriefingApi = {
  get: () => api<any>('/briefing'),
};

export const DeviceApi = {
  listCommands: () => api<any[]>('/device/commands'),
  logCommand: (payload: { action: string; payload?: object; status?: string }) =>
    api<any>('/device/commands', { method: 'POST', body: JSON.stringify(payload) }),
  listComms: () => api<any[]>('/device/comms'),
  logComm: (payload: any) =>
    api<any>('/device/comms', { method: 'POST', body: JSON.stringify(payload) }),
};

export const AutomationsApi = {
  list: () => api<any[]>('/automations'),
  create: (payload: any) => api<any>('/automations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: any) => api<any>(`/automations/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  run: (id: string) => api<any>(`/automations/${id}/run`, { method: 'POST' }),
  remove: (id: string) => api<any>(`/automations/${id}`, { method: 'DELETE' }),
  recordUsage: (kind: string, key: string) =>
    api<any>('/usage', { method: 'POST', body: JSON.stringify({ kind, key }) }),
  topUsage: (kind?: string, limit = 5) => {
    const params = new URLSearchParams();
    if (kind) params.set('kind', kind);
    params.set('limit', String(limit));
    return api<any[]>(`/usage/top?${params.toString()}`);
  },
  backup: () => api<any>('/backup'),
};

export const OcrApi = {
  run: (image_base64: string) => api<any>('/ocr', { method: 'POST', body: JSON.stringify({ image_base64 }) }),
};

export const MarketplaceApi = {
  list: (q?: string, tag?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api<any[]>(`/marketplace/workflows${qs}`);
  },
  publish: (payload: { workflow_id: string; description: string; icon?: string; tags?: string[] }) =>
    api<any>('/marketplace/publish', { method: 'POST', body: JSON.stringify(payload) }),
  install: (marketplace_id: string) =>
    api<any>(`/marketplace/install/${marketplace_id}`, { method: 'POST' }),
  like: (marketplace_id: string) =>
    api<any>(`/marketplace/like/${marketplace_id}`, { method: 'POST' }),
};

export const MetaApi = {
  providers: () => api<any[]>('/ai/providers'),
  health: () => api<any>('/health'),
};

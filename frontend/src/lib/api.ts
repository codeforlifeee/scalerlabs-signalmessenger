/**
 * API client for communicating with the FastAPI backend.
 * Handles JWT token management and request/response formatting.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ─── Token Management ─────────────────────────────────────

let accessToken: string | null = null;

export function setToken(token: string) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    localStorage.setItem('signal_token', token);
  }
}

export function getToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('signal_token');
  }
  return accessToken;
}

export function clearToken() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('signal_token');
    localStorage.removeItem('signal_user');
  }
}

// ─── HTTP Client ────────────────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ─── Auth API ─────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  phone?: string;
  display_name: string;
  avatar_url?: string;
  avatar_color: string;
  status_text?: string;
  is_online: boolean;
  last_seen?: string;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const authAPI = {
  register: (data: { username: string; phone?: string; display_name: string; password: string }) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { username: string; password: string }) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  verifyOTP: (data: { username: string; otp: string }) =>
    request<{ verified: boolean }>('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Users API ──────────────────────────────────────────────

export const usersAPI = {
  getMe: () => request<User>('/api/users/me'),
  
  updateMe: (data: Partial<User>) =>
    request<User>('/api/users/me', { method: 'PUT', body: JSON.stringify(data) }),

  search: (q: string) => request<User[]>(`/api/users/search?q=${encodeURIComponent(q)}`),

  getOnline: () => request<number[]>('/api/users/online'),
};

// ─── Contacts API ───────────────────────────────────────────

export interface Contact {
  id: number;
  contact: User;
  nickname?: string;
  created_at?: string;
}

export const contactsAPI = {
  list: () => request<Contact[]>('/api/contacts'),

  add: (username: string) =>
    request<Contact>('/api/contacts', { method: 'POST', body: JSON.stringify({ username }) }),

  remove: (id: number) =>
    request<void>(`/api/contacts/${id}`, { method: 'DELETE' }),
};

// ─── Conversations API ─────────────────────────────────────

export interface ConversationMember {
  id: number;
  user_id: number;
  user: User;
  role: string;
  joined_at?: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender?: User;
  content: string;
  message_type: string;
  status: string;
  reply_to_id?: number;
  reply_to?: Message;
  created_at?: string;
}

export interface Conversation {
  id: number;
  type: string;
  name?: string;
  avatar_url?: string;
  avatar_color?: string;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  members: ConversationMember[];
  last_message?: Message;
  unread_count: number;
}

export const conversationsAPI = {
  list: () => request<Conversation[]>('/api/conversations'),

  create: (data: { type: string; name?: string; member_ids: number[]; avatar_color?: string }) =>
    request<Conversation>('/api/conversations', { method: 'POST', body: JSON.stringify(data) }),

  get: (id: number) => request<Conversation>(`/api/conversations/${id}`),

  update: (id: number, data: { name?: string; avatar_url?: string; avatar_color?: string }) =>
    request<Conversation>(`/api/conversations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  addMember: (convId: number, userId: number) =>
    request<ConversationMember>(`/api/conversations/${convId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    }),

  removeMember: (convId: number, userId: number) =>
    request<void>(`/api/conversations/${convId}/members/${userId}`, { method: 'DELETE' }),

  getMessages: (convId: number, limit = 50, beforeId?: number) => {
    let url = `/api/conversations/${convId}/messages?limit=${limit}`;
    if (beforeId) url += `&before_id=${beforeId}`;
    return request<Message[]>(url);
  },

  sendMessage: (convId: number, data: { content: string; message_type?: string; reply_to_id?: number }) =>
    request<Message>(`/api/conversations/${convId}/messages`, { method: 'POST', body: JSON.stringify(data) }),

  markRead: (convId: number) =>
    request<{ read_count: number }>(`/api/conversations/${convId}/read`, { method: 'PUT' }),
};

export default API_BASE_URL;

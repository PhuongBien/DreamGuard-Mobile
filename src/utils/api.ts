// ============================================================
// KBS Staff App — API Service Layer
// 📌 All API endpoints are marked with [API: METHOD /path]
//    so the backend team can implement matching routes.
// ============================================================

import { ApiResponse, PaginatedResponse, Task, TaskStatus, User, Notification } from '../types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const BASE_URL = 'https://api.kbs.vn/staff/v1';
// 📌 Change BASE_URL to your actual backend base URL.
//    Example: 'https://api.yourdomain.com/staff/v1'

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FETCH HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.message || `HTTP error ${response.status}`);
    }

    return json as ApiResponse<T>;
  } catch (error: any) {
    throw new Error(error.message || 'Network error. Please check your connection.');
  }
}

async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await response.json();
  if (!response.ok) throw new Error(json.message || `Upload error ${response.status}`);
  return json as ApiResponse<T>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: User;
  expiresIn: number;
}

/**
 * 📌 [API: POST /auth/login]
 * Body: { email, password }
 * Response: { token, refreshToken, user, expiresIn }
 */
export const authLogin = (payload: LoginPayload) =>
  apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/**
 * 📌 [API: POST /auth/logout]
 * Header: Authorization Bearer <token>
 * Response: { success: true }
 */
export const authLogout = () =>
  apiFetch<void>('/auth/logout', { method: 'POST' });

/**
 * 📌 [API: POST /auth/refresh]
 * Body: { refreshToken }
 * Response: { token, expiresIn }
 */
export const authRefreshToken = (refreshToken: string) =>
  apiFetch<{ token: string; expiresIn: number }>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

/**
 * 📌 [API: GET /auth/me]
 * Header: Authorization Bearer <token>
 * Response: User object
 */
export const authGetMe = () => apiFetch<User>('/auth/me');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  status?: TaskStatus | 'all';
  date?: string;           // ISO date string
  search?: string;
}

/**
 * 📌 [API: GET /tasks]
 * Query params: page, pageSize, status, date, search
 * Header: Authorization Bearer <token>
 * Response: PaginatedResponse<Task>
 * NOTE: Backend should filter tasks by the logged-in user's assignment (from token).
 */
export const fetchTasks = (params: TaskListParams = {}) => {
  const query = new URLSearchParams();
  if (params.page)     query.append('page', String(params.page));
  if (params.pageSize) query.append('pageSize', String(params.pageSize));
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.date)     query.append('date', params.date);
  if (params.search)   query.append('search', params.search);

  return apiFetch<PaginatedResponse<Task>>(`/tasks?${query.toString()}`);
};

/**
 * 📌 [API: GET /tasks/:taskId]
 * Header: Authorization Bearer <token>
 * Response: Task (full detail)
 */
export const fetchTaskById = (taskId: string) =>
  apiFetch<Task>(`/tasks/${taskId}`);

/**
 * 📌 [API: PATCH /tasks/:taskId/status]
 * Body: { status: TaskStatus, note?: string }
 * Header: Authorization Bearer <token>
 * Response: Task (updated)
 */
export const updateTaskStatus = (
  taskId: string,
  status: TaskStatus,
  note?: string
) =>
  apiFetch<Task>(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  });

/**
 * 📌 [API: POST /tasks/:taskId/notes]
 * Body: { content: string }
 * Header: Authorization Bearer <token>
 * Response: Task (updated with new note)
 */
export const addTaskNote = (taskId: string, content: string) =>
  apiFetch<Task>(`/tasks/${taskId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHOTO UPLOAD API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface UploadPhotoPayload {
  taskId: string;
  type: 'before' | 'after' | 'evidence';
  imageUri: string;    // local file URI from camera/gallery
  fileName?: string;
  mimeType?: string;
}

/**
 * 📌 [API: POST /tasks/:taskId/photos]
 * Body: multipart/form-data { photo (file), type }
 * Header: Authorization Bearer <token>
 * Response: Task (updated with new photo)
 */
export const uploadTaskPhoto = async (payload: UploadPhotoPayload) => {
  const formData = new FormData();
  formData.append('photo', {
    uri: payload.imageUri,
    name: payload.fileName || `photo_${Date.now()}.jpg`,
    type: payload.mimeType || 'image/jpeg',
  } as any);
  formData.append('type', payload.type);

  return apiUpload<Task>(`/tasks/${payload.taskId}/photos`, formData);
};

/**
 * 📌 [API: DELETE /tasks/:taskId/photos/:photoId]
 * Header: Authorization Bearer <token>
 * Response: Task (updated)
 */
export const deleteTaskPhoto = (taskId: string, photoId: string) =>
  apiFetch<Task>(`/tasks/${taskId}/photos/${photoId}`, { method: 'DELETE' });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECK-IN / CHECK-OUT API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CheckInPayload {
  latitude?: number;
  longitude?: number;
  address?: string;
}

/**
 * 📌 [API: POST /tasks/:taskId/checkin]
 * Body: { latitude?, longitude?, address? }
 * Header: Authorization Bearer <token>
 * Response: Task (updated with checkIn time)
 */
export const taskCheckIn = (taskId: string, payload: CheckInPayload = {}) =>
  apiFetch<Task>(`/tasks/${taskId}/checkin`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/**
 * 📌 [API: POST /tasks/:taskId/checkout]
 * Body: { latitude?, longitude?, address?, completionNote? }
 * Header: Authorization Bearer <token>
 * Response: Task (updated with checkOut time)
 */
export const taskCheckOut = (
  taskId: string,
  payload: CheckInPayload & { completionNote?: string } = {}
) =>
  apiFetch<Task>(`/tasks/${taskId}/checkout`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATIONS API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 📌 [API: GET /notifications]
 * Query: page, pageSize, isRead (optional filter)
 * Header: Authorization Bearer <token>
 * Response: PaginatedResponse<Notification>
 */
export const fetchNotifications = (page = 1, pageSize = 20) =>
  apiFetch<PaginatedResponse<Notification>>(
    `/notifications?page=${page}&pageSize=${pageSize}`
  );

/**
 * 📌 [API: PATCH /notifications/:notificationId/read]
 * Header: Authorization Bearer <token>
 * Response: { success: true }
 */
export const markNotificationRead = (notificationId: string) =>
  apiFetch<void>(`/notifications/${notificationId}/read`, { method: 'PATCH' });

/**
 * 📌 [API: PATCH /notifications/read-all]
 * Header: Authorization Bearer <token>
 * Response: { success: true }
 */
export const markAllNotificationsRead = () =>
  apiFetch<void>('/notifications/read-all', { method: 'PATCH' });

/**
 * 📌 [API: GET /notifications/unread-count]
 * Header: Authorization Bearer <token>
 * Response: { count: number }
 */
export const fetchUnreadCount = () =>
  apiFetch<{ count: number }>('/notifications/unread-count');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUSH NOTIFICATION REGISTRATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 📌 [API: POST /devices/register]
 * Body: { token: string, platform: 'android' | 'ios' }
 * Header: Authorization Bearer <token>
 * Response: { success: true }
 * NOTE: Used to register device push token (FCM/APNs) for push notifications.
 */
export const registerDeviceToken = (pushToken: string, platform: 'android' | 'ios') =>
  apiFetch<void>('/devices/register', {
    method: 'POST',
    body: JSON.stringify({ token: pushToken, platform }),
  });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SCHEDULE API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 📌 [API: GET /tasks/schedule]
 * Query: startDate (ISO), endDate (ISO)
 * Header: Authorization Bearer <token>
 * Response: Task[] (tasks within date range for logged-in user)
 */
export const fetchSchedule = (startDate: string, endDate: string) =>
  apiFetch<Task[]>(`/tasks/schedule?startDate=${startDate}&endDate=${endDate}`);

// KBS Staff App — API Service Layer

import {
  ApiResponse,
  PaginatedResponse,
  Task,
  TaskStatus,
  User,
  Notification,
} from "../types";

// CONFIG

const BASE_URL = "https://cohabit.vn";

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  if (!token) {
    authToken = null;
    return;
  }

  // Accept both raw JWT and `Bearer <JWT>` inputs.
  authToken = token.replace(/^Bearer\s+/i, "").trim();
};

// FETCH HELPER

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const rawText = await response.text();
    let json: any = null;
    if (rawText) {
      try {
        json = JSON.parse(rawText);
      } catch {
        json = null;
      }
    }

    if (!response.ok) {
      const message =
        (json &&
          typeof json === "object" &&
          "message" in json &&
          (json as any).message) ||
        rawText ||
        `HTTP error ${response.status} at ${endpoint}`;
      throw new Error(message);
    }

    // Normalize API response shape: some backends return { success, data },
    // others return raw object.
    if (json && typeof json === "object" && "success" in json) {
      return json as ApiResponse<T>;
    }

    return {
      success: true,
      data: (json ?? null) as T,
    } as ApiResponse<T>;
  } catch (error: any) {
    throw new Error(
      error.message || "Network error. Please check your connection.",
    );
  }
}

async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    // Let React Native set multipart boundary automatically.
    headers,
    body: formData,
  });

  const rawText = await response.text();
  let json: any = null;
  if (rawText) {
    try {
      json = JSON.parse(rawText);
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const message =
      (json && typeof json === "object" && json.message) ||
      rawText ||
      `Upload error ${response.status} at ${endpoint}`;
    throw new Error(message);
  }

  if (json && typeof json === "object" && "success" in json) {
    return json as ApiResponse<T>;
  }

  return {
    success: true,
    data: (json ?? null) as T,
  } as ApiResponse<T>;
}

// AUTH API

export interface AuthLoginPayload {
  phoneNumber: string;
  password: string;
}

export interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  user?: User;
  roleName?: string;
  expiresIn?: number;
}

// login

export const authLogin = (payload: AuthLoginPayload) =>
  apiFetch<AuthLoginResponse>("/api/auths/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export interface AuthForgotPayload {
  phoneNumber: string;
}

// forgotpassword

// export const authForgotPassword = (payload: AuthForgotPayload) =>
//   apiFetch<{ message: string }>("/api/auths/forgotpassword", {
//     method: "POST",
//     body: JSON.stringify(payload),
//   });

// export interface AuthResetPayload {
//   phoneNumber: string;
//   otpCode: string;
//   newPassword: string;
// }

// resetpassword

// export const authResetPassword = (payload: AuthResetPayload) =>
//   apiFetch<{ message: string }>("/api/auths/resetpassword", {
//     method: "POST",
//     body: JSON.stringify(payload),
//   });

//  logout

export const authLogout = () =>
  apiFetch<void>("/api/auths/logout", { method: "POST" });

//  auth/refresh

export const authRefreshToken = (refreshToken: string) =>
  apiFetch<{ token: string; expiresIn: number }>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

// auth/me

export const authGetMe = () => apiFetch<User>("/auth/me");

// STAFF API

export interface StaffListParams {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
}

export const fetchStaffProfile = () => apiFetch<any>("/api/staffs");

export const fetchStaffs = (params: StaffListParams = {}) => {
  const query = new URLSearchParams();

  if (params.pageNumber) query.append("pageNumber", String(params.pageNumber));
  if (params.pageSize) query.append("pageSize", String(params.pageSize));
  if (params.search) query.append("search", params.search);

  const queryString = query.toString();
  const endpoint = queryString ? `/api/staffs?${queryString}` : "/api/staffs";

  return apiFetch<any>(endpoint);
};

// TASK API

export interface TaskListParams {
  page?: number;
  pageSize?: number;
  status?: TaskStatus | "all";
  date?: string; // ISO date string
  search?: string;
  staffId?: string;
}

export interface ShippingTaskStatusPayload {
  evidenceUrls?: string[];
  reason?: string;
}

const taskStatusToBackendStatus = (
  status: TaskStatus,
):
  | "Pending"
  | "CheckedIn"
  | "Processing"
  | "CheckedOut"
  | "Completed"
  | "ForcedCancelled"
  | "OnHold" => {
  const mapping: Partial<Record<TaskStatus, ReturnType<typeof taskStatusToBackendStatus>>> = {
    pending: "Pending",
    checked_in: "CheckedIn",
    in_progress: "Processing",
    checked_out: "CheckedOut",
    completed: "Completed",
    cancelled: "ForcedCancelled",
    on_hold: "OnHold",
  };

  return mapping[status] ?? "Pending";
};

const isGuid = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

//  ServiceTasks/GetByStaffId

export const fetchTasks = async (params: TaskListParams = {}) => {
  const query = new URLSearchParams();
  const pageNumber = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  query.append("pageNumber", String(pageNumber));
  query.append("pageSize", String(pageSize));
  if (params.status && params.status !== "all")
    query.append("status", taskStatusToBackendStatus(params.status));
  if (params.date) query.append("date", params.date);
  if (params.search) query.append("search", params.search);

  if (isGuid(params.staffId)) {
    query.append("staffId", params.staffId as string);
  }

  const queryString = query.toString();

  return apiFetch<PaginatedResponse<Task>>(
    queryString
      ? `/api/ServiceTasks/GetByStaffId?${queryString}`
      : "/api/ServiceTasks/GetByStaffId",
  );
};

const taskStatusToShippingBackendStatus = (
  status: TaskStatus,
): "Pending" | "Delivering" | "Arrived" | "Delivered" | "Returned" => {
  const mapping: Partial<Record<TaskStatus, "Pending" | "Delivering" | "Arrived" | "Delivered" | "Returned">> = {
    pending: "Pending",
    delivering: "Delivering",
    arrived: "Arrived",
    delivered: "Delivered",
    returned: "Returned",
  };

  return mapping[status] ?? "Pending";
};

export const fetchShippingTasks = (params: TaskListParams = {}) => {
  const query = new URLSearchParams();
  const pageNumber = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;

  query.append("pageNumber", String(pageNumber));
  query.append("pageSize", String(pageSize));

  if (params.status && params.status !== "all") {
    query.append("status", taskStatusToShippingBackendStatus(params.status));
  }

  if (params.search) query.append("search", params.search);
  if (params.date) query.append("date", params.date);

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/ShippingTasks?${queryString}`
    : "/api/ShippingTasks";

  return apiFetch<PaginatedResponse<Task>>(endpoint);
};

export const fetchShippingTaskById = (taskId: string) =>
  apiFetch<Task>(`/api/ShippingTasks/${taskId}`);

export const fetchOrderById = (orderId: string) =>
  apiFetch<any>(`/api/order/${orderId}`);

// export const fetchPaymentByOrderId = (orderId: string) =>
//   apiFetch<any>(`/api/payment/order/${orderId}`);

export const fetchPaymentByOrderId = async (orderId: string) => {
  // Payment method/status are provided by order detail endpoint.
  try {
    return await apiFetch<any>(`/api/order/${orderId}`);
  } catch {
    // Keep compatibility with older backends exposing payment by separate route.
    return apiFetch<any>(`/api/payment/order/${orderId}`);
  }
};

export const updateShippingTaskDelivering = (
  taskId: string,
  payload: ShippingTaskStatusPayload = {},
) =>
  apiFetch<Task>(`/api/ShippingTasks/${taskId}/delivering`, {
    method: "PUT",
    body: JSON.stringify({ evidenceUrls: payload.evidenceUrls ?? [] }),
  });

export const updateShippingTaskArrived = (taskId: string) =>
  apiFetch<Task>(`/api/ShippingTasks/${taskId}/arrived`, {
    method: "PUT",
  });

export const updateShippingTaskDelivered = (
  taskId: string,
  payload: ShippingTaskStatusPayload = {},
) =>
  apiFetch<Task>(`/api/ShippingTasks/${taskId}/delivered`, {
    method: "PUT",
    body: JSON.stringify({ evidenceUrls: payload.evidenceUrls ?? [] }),
  });

export const updateShippingTaskReturned = (
  taskId: string,
  payload: ShippingTaskStatusPayload,
) =>
  apiFetch<Task>(`/api/ShippingTasks/${taskId}/returned`, {
    method: "PUT",
    body: JSON.stringify({
      reason: payload.reason ?? "",
      evidenceUrls: payload.evidenceUrls ?? [],
    }),
  });

//  ServiceTasks/:taskId

export const fetchTaskById = (taskId: string) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}`);

export const fetchServicePackageMappingById = (mappingId: string) =>
  apiFetch<any>(`/api/ServicePackageMappings/${mappingId}`);

export const fetchServiceTaskEvidences = (
  taskId: string,
  params?: { pageNumber?: number; pageSize?: number },
) => {
  const query = new URLSearchParams();

  if (params?.pageNumber) {
    query.append("pageNumber", String(params.pageNumber));
  }

  if (params?.pageSize) {
    query.append("pageSize", String(params.pageSize));
  }

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/ServiceEvidences/service-tasks/${taskId}/service-evidences?${queryString}`
    : `/api/ServiceEvidences/service-tasks/${taskId}/service-evidences`;

  return apiFetch<any>(endpoint);
};

//  ServiceTasks/:taskId/update{status}Status

export const updateTaskStatus = (
  taskId: string,
  status: TaskStatus,
  note?: string,
) => {
  const mapping: Partial<Record<TaskStatus, string>> = {
    pending: "Pending",
    in_progress: "Processing",
    checked_in: "CheckedIn",
    completed: "Completed",
    cancelled: "ForcedCancelled",
    on_hold: "OnHold",
    checked_out: "CheckedOut",
  };

  const statusPt = mapping[status] ?? "Processing";
  const path = `/api/ServiceTasks/${taskId}/update${statusPt}Status`;

  const body = note ? { staffNote: note } : undefined;

  return apiFetch<Task>(path, {
    method: "PATCH",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
};

export const updateTaskCheckedInStatus = (taskId: string) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/updateCheckedInStatus`, {
    method: "PATCH",
  });

export const updateTaskProcessingStatus = (taskId: string) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/updateProcessingStatus`, {
    method: "PATCH",
  });

export const updateTaskCheckedOutStatus = (taskId: string, note?: string) => {
  const body = note ? { staffNote: note } : undefined;

  return apiFetch<Task>(`/api/ServiceTasks/${taskId}/updateCheckedOutStatus`, {
    method: "PATCH",
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
};

//  ServiceTasks/:taskId/notes

export const addTaskNote = (taskId: string, content: string) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

// PHOTO UPLOAD API

export interface UploadPhotoPayload {
  taskId: string;
  type: "before" | "after" | "evidence";
  imageUri: string; // local file URI from camera/gallery
  fileName?: string;
  mimeType?: string;
}

export interface UploadDeliveryPhotoPayload extends UploadPhotoPayload {
  orderId?: string;
}

interface EvidenceUploadCandidate {
  key: "serviceTaskId" | "shippingTaskId" | "soId" | "orderId";
  value?: string;
}

//  tasks/:taskId/photos

const getEvidenceDescription = (type: UploadPhotoPayload["type"]) =>
  type === "before" ? "before" : type === "after" ? "after" : "evidence";

const createEvidenceFileName = (rawName?: string) => {
  const resolved = rawName || `photo_${Date.now()}`;
  return /\.(jpe?g|png|gif|webp)$/i.test(resolved) ? resolved : `${resolved}.jpg`;
};

const uploadEvidencePhoto = async (
  payload: UploadPhotoPayload,
  candidates: EvidenceUploadCandidate[],
) => {
  const rawName = payload.fileName || `photo_${Date.now()}`;
  const fileName = createEvidenceFileName(rawName);
  const description = getEvidenceDescription(payload.type);
  const uniqueCandidates = candidates.filter(
    (candidate, index, array) =>
      !!candidate.value &&
      array.findIndex(
        (item) => item.key === candidate.key && item.value === candidate.value,
      ) === index,
  );

  let lastError: Error | null = null;

  const createUploadFormData = (
    fileFieldName: "file" | "files",
    candidate: EvidenceUploadCandidate,
  ) => {
    const formData = new FormData();
    formData.append(fileFieldName, {
      uri: payload.imageUri,
      name: fileName,
      type: payload.mimeType || "image/jpeg",
    } as any);

    formData.append("type", payload.type);
    formData.append("description", description);
    if (candidate.value) {
      formData.append(candidate.key, candidate.value);
    }
    return formData;
  };

  for (const candidate of uniqueCandidates) {
    const query = new URLSearchParams({ description });
    query.append(candidate.key, candidate.value as string);

    const endpoint = `/api/ServiceEvidences?${query.toString()}`;

    try {
      return await apiUpload<Task | string | number>(
        endpoint,
        createUploadFormData("file", candidate),
      );
    } catch (firstError: any) {
      const firstMessage = String(firstError?.message || "");
      const shouldRetryWithFilesField =
        firstMessage.toLowerCase().includes("at least one file is required") ||
        firstMessage.toLowerCase().includes("file is required");

      if (shouldRetryWithFilesField) {
        try {
          return await apiUpload<Task | string | number>(
            endpoint,
            createUploadFormData("files", candidate),
          );
        } catch (secondError: any) {
          lastError = new Error(
            secondError?.message ||
              `Khong the tai anh len qua /api/ServiceEvidences cho task ${payload.taskId}`,
          );
          continue;
        }
      }

      lastError = new Error(
        firstError?.message ||
          `Khong the tai anh len qua /api/ServiceEvidences cho task ${payload.taskId}`,
      );
    }
  }

  throw lastError ||
    new Error(`Khong the tai anh len qua /api/ServiceEvidences cho task ${payload.taskId}`);
};

export const uploadTaskPhoto = async (payload: UploadPhotoPayload) => {
  return uploadEvidencePhoto(payload, [
    { key: "serviceTaskId", value: payload.taskId },
  ]);
};

export const uploadDeliveryTaskPhoto = async (
  payload: UploadDeliveryPhotoPayload,
) => {
  return uploadEvidencePhoto(payload, [
    { key: "shippingTaskId", value: payload.taskId },
    { key: "serviceTaskId", value: payload.taskId },
    { key: "soId", value: payload.orderId },
    { key: "orderId", value: payload.orderId },
  ]);
};

// RATINGS API

export const getRatingsByStaffId = (
  staffId: string,
  params?: { pageNumber?: number; pageSize?: number },
) => {
  const query = new URLSearchParams();
  if (params?.pageNumber) query.append("pageNumber", String(params.pageNumber));
  if (params?.pageSize) query.append("pageSize", String(params.pageSize));

  const queryString = query.toString();
  const endpoint = queryString
    ? `/api/Ratings/GetAllRatingsByStaffId/${staffId}?${queryString}`
    : `/api/Ratings/GetAllRatingsByStaffId/${staffId}`;

  return apiFetch<any>(endpoint);
};

// [API: DELETE /tasks/:taskId/photos/:photoId]

export const deleteTaskPhoto = (taskId: string, photoId: string) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/photo/${photoId}`, { method: "DELETE" });

// CHECK-IN / CHECK-OUT API

export interface CheckInPayload {
  latitude?: number;
  longitude?: number;
  address?: string;
}

// [API: POST /tasks/:taskId/checkin]

export const taskCheckIn = (taskId: string, payload: CheckInPayload = {}) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/checkin`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

//  [API: POST /tasks/:taskId/checkout]

export const taskCheckOut = (
  taskId: string,
  payload: CheckInPayload & { completionNote?: string } = {},
) =>
  apiFetch<Task>(`/api/ServiceTasks/${taskId}/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

// NOTIFICATIONS API

//  [API: GET /notifications]

export const fetchNotifications = (page = 1, pageSize = 20) =>
  apiFetch<PaginatedResponse<Notification>>(
    `/notifications?page=${page}&pageSize=${pageSize}`,
  );

//  [API: PATCH /notifications/:notificationId/read]

export const markNotificationRead = (notificationId: string) =>
  apiFetch<void>(`/notifications/${notificationId}/read`, { method: "PATCH" });

//  [API: PATCH /notifications/read-all]

export const markAllNotificationsRead = () =>
  apiFetch<void>("/notifications/read-all", { method: "PATCH" });

//  [API: GET /notifications/unread-count]

export const fetchUnreadCount = () =>
  apiFetch<{ count: number }>("/notifications/unread-count");

// PUSH NOTIFICATION REGISTRATION

// [API: POST /devices/register]

export const registerDeviceToken = (
  pushToken: string,
  platform: "android" | "ios",
) =>
  apiFetch<void>("/devices/register", {
    method: "POST",
    body: JSON.stringify({ token: pushToken, platform }),
  });

// SCHEDULE API

//  [API: GET /tasks/schedule]

export const fetchSchedule = (startDate: string, endDate: string) =>
  apiFetch<Task[]>(`/tasks/schedule?startDate=${startDate}&endDate=${endDate}`);

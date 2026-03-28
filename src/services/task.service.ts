import {
  Task,
  TaskNote,
  TaskPhoto,
  TaskStatus,
  TaskType,
  TaskPriority,
} from "../types";
import {
  fetchTasks,
  fetchTaskById as apiFetchTaskById,
  updateTaskStatus as apiUpdateTaskStatus,
  updateTaskCheckedInStatus,
  updateTaskProcessingStatus,
  updateTaskCheckedOutStatus,
  addTaskNote as apiAddTaskNote,
  uploadTaskPhoto as apiUploadTaskPhoto,
} from "../utils/api";

const DEFAULT_PAGE_SIZE = 20;

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

const toIso = (value: unknown, fallback = new Date().toISOString()) => {
  if (!value) return fallback;

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
};

const splitDateTime = (
  value: unknown,
): { dueDate: string; dueTime?: string } => {
  const raw = String(value ?? "").trim();
  // Preserve exact backend time from ISO string (avoid timezone shifting when we only need display).
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (isoMatch) {
    return {
      dueDate: isoMatch[1],
      dueTime: isoMatch[2],
    };
  }

  const parsed = new Date(String(value ?? ""));
  if (Number.isNaN(parsed.getTime())) {
    return {
      dueDate: String(value || new Date().toISOString().slice(0, 10)).slice(
        0,
        10,
      ),
      dueTime: undefined,
    };
  }

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const min = String(parsed.getMinutes()).padStart(2, "0");

  return {
    dueDate: `${yyyy}-${mm}-${dd}`,
    dueTime: `${hh}:${min}`,
  };
};

const normalizeStatus = (value: unknown): TaskStatus => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();

  // Backend exact values: Pending / CheckedIn / Processing / CheckedOut / Completed / ForcedCancelled
  if (raw === "checkedin") return "checked_in";
  if (raw === "inprogress") return "in_progress";
  if (raw === "processing") return "in_progress";
  if (raw === "checkedout") return "checked_out";
  if (raw === "completed") return "completed";

  if (raw === "cancelled" || raw === "canceled" || raw === "forcedcancelled") {
    return "cancelled";
  }

  return "pending";
};

const normalizeType = (value: unknown): TaskType => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "delivery") return "delivery";
  if (raw === "pickup") return "pickup";
  if (raw === "cleaning") return "cleaning";
  if (raw === "repair") return "repair";
  if (raw === "trade_in" || raw === "tradein") return "trade_in";
  return "cleaning";
};

const normalizePriority = (value: unknown): TaskPriority => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "urgent") return "urgent";
  if (raw === "high") return "high";
  if (raw === "low") return "low";
  return "medium";
};

// Infer task type from service package name returned by backend
const inferTaskType = (name?: string): TaskType => {
  const lower = (name ?? "").toLowerCase();
  if (
    lower.includes("clean") ||
    lower.includes("wash") ||
    lower.includes("giặt") ||
    lower.includes("vệ sinh")
  )
    return "cleaning";
  if (
    lower.includes("repair") ||
    lower.includes("sửa") ||
    lower.includes("fix")
  )
    return "repair";
  if (lower.includes("delivery") || lower.includes("giao")) return "delivery";
  if (lower.includes("pickup") || lower.includes("thu")) return "pickup";
  return "cleaning";
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const normalizeMultilineText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .trim();
  return normalized || undefined;
};

const inferPhotoType = (
  item: unknown,
  url: string,
  index: number,
): "before" | "after" | "evidence" => {
  const source = isRecord(item) ? item : {};
  const hint = String(
    source.type ??
      source.photoType ??
      source.description ??
      source.note ??
      source.tag ??
      "",
  )
    .toLowerCase()
    .trim();

  const combinedHint = `${hint} ${url}`.toLowerCase();

  if (
    combinedHint.includes("before") ||
    combinedHint.includes("truoc") ||
    combinedHint.includes("tr\u01b0\u1edbc")
  ) {
    return "before";
  }

  if (
    combinedHint.includes("after") ||
    combinedHint.includes("sau") ||
    combinedHint.includes("hoanthanh")
  ) {
    return "after";
  }

  if (index === 0) return "before";
  if (index === 1) return "after";
  return "evidence";
};

const normalizeTask = (input: unknown): Task => {
  const raw = isRecord(input) ? input : {};
  // console.log("RAW STATUS FROM API:", raw.status);
  const nowIso = new Date().toISOString();

  // ── Primary ID (backend uses serviceTaskId) ────────────────────────────────
  const taskId =
    String(
      raw.serviceTaskId ?? raw.id ?? raw.taskId ?? `task_${Date.now()}`,
    ).trim() || `task_${Date.now()}`;

  // ── Service order items → products + title ─────────────────────────────────
  const orderItems: any[] = Array.isArray(raw.serviceOrderItems)
    ? raw.serviceOrderItems
    : [];
  const firstItem = orderItems.length > 0 ? orderItems[0] : null;
  const servicePackageMapping = firstItem
    ? {
        servicePackageMappingId: String(
          firstItem?.servicePackageMappingId ?? "",
        ),

        price: toNumberOrUndefined(firstItem.totalPrice),

        duration: undefined, // BE chưa có thì để undefined

        servicePackage: {
          servicePackageId: "", // BE chưa trả
          packageName: String(firstItem?.servicePackageName ?? ""),
          status: "-",
          suitableFor: "-",
        },

        productType: {
          productTypeId: "",
          productTypeName: String(firstItem?.productTypeName ?? ""),
        },
      }
    : undefined;
  const servicePackageName = String(
    firstItem?.servicePackageName ?? raw.serviceName ?? "",
  ).trim();
  const productTypeName = String(firstItem?.productTypeName ?? "").trim();

  // ── Customer (top-level fields from backend, no nested customer object) ─────
  const customerName =
    raw.receiverName || raw.customerName || raw.phoneNumber || "Khách hàng";

  const customerPhone = String(
    raw.phoneNumber ?? raw.customerPhone ?? "",
  ).trim();
  const customerAddress =
    raw.address || raw.serviceAddress || "Chưa có địa chỉ";
  const customerNote =
    typeof raw.customerNote === "string" ? raw.customerNote.trim() : "";

  // ── Title constructed from service name + customer ─────────────────────────
  const titleParts = [
    servicePackageName || raw.serviceName || "Dịch vụ",
    productTypeName,
  ]
    .filter(Boolean)
    .join(" · ");
  const title = titleParts
    ? `${titleParts} — ${customerName}`
    : `Nhiệm vụ — ${customerName}`;

  // ── Appointment date ───────────────────────────────────────────────────────
  const dueSplit = splitDateTime(
    raw.appointmentDate ?? raw.dueDate ?? raw.scheduledDate,
  );

  // ── Check-in / Check-out (direct ISO string fields from backend) ───────────
  // Backend: { checkIn: "2026-03-28T10:21:05Z", checkOut: null }
  const rawCheckIn = raw.checkIn;
  const rawCheckOut = raw.checkOut;
  const checkInTime =
    rawCheckIn && typeof rawCheckIn === "string" && rawCheckIn !== "null"
      ? rawCheckIn
      : isRecord(rawCheckIn) && rawCheckIn.time
        ? rawCheckIn.time
        : null;
  const checkOutTime =
    rawCheckOut && typeof rawCheckOut === "string" && rawCheckOut !== "null"
      ? rawCheckOut
      : isRecord(rawCheckOut) && rawCheckOut.time
        ? rawCheckOut.time
        : null;

  // ── Photos from serviceOrderImageUrl and evidence arrays ──────────────────
  const rawPhotoItems: unknown[] = [
    ...(Array.isArray(raw.serviceOrderImageUrl) ? raw.serviceOrderImageUrl : []),
    ...(Array.isArray(raw.serviceEvidences) ? raw.serviceEvidences : []),
    ...(Array.isArray(raw.evidences) ? raw.evidences : []),
  ];

  const seenPhotoUrls = new Set<string>();
  const photos: TaskPhoto[] = rawPhotoItems
    .map((item: any, index: number) => {
      const url =
        typeof item === "string"
          ? item
          : String(item?.url ?? item?.imageUrl ?? item?.fileUrl ?? "");

      if (!url || seenPhotoUrls.has(url)) {
        return null;
      }
      seenPhotoUrls.add(url);

      return {
        id: String(item?.id ?? item?.serviceEvidenceId ?? `photo_${taskId}_${index}`),
        url,
        type: inferPhotoType(item, url, index),
        uploadedAt: toIso(item?.createdAt ?? item?.uploadedAt ?? nowIso, nowIso),
        uploadedBy: String(item?.uploadedBy ?? raw.staffId ?? ""),
      } as TaskPhoto;
    })
    .filter((item): item is TaskPhoto => !!item);

  // ── Products from serviceOrderItems ───────────────────────────────────────
  const products = orderItems.map((item: any, index: number) => ({
    id: String(
      item?.serviceOrderItemId ?? item?.id ?? `product_${taskId}_${index}`,
    ),
    name:
      [item?.servicePackageName, item?.productTypeName]
        .filter(Boolean)
        .join(" – ") || "Dịch vụ",
    type: String(item?.productTypeName ?? "service"),
    quantity: Number(item?.quantity) || 1,
    description:
      item?.totalPrice !== undefined
        ? `${Number(item.totalPrice).toLocaleString("vi-VN")} ₫`
        : undefined,
  }));

  return {
    id: taskId,
    taskCode: raw.soId
      ? String(raw.soId).slice(0, 8).toUpperCase()
      : `ST-${taskId.slice(0, 6).toUpperCase()}`,
    title,
    description: String(raw.staffNote ?? raw.description ?? raw.note ?? ""),
    type: inferTaskType(servicePackageName || productTypeName) || "cleaning",
    status: normalizeStatus(raw.status ?? raw.taskStatus),
    priority: "medium",
    assignedTo: String(raw.staffId ?? raw.assignedTo ?? ""),
    assignedToName: "",
    createdAt: toIso(raw.createdAt ?? nowIso, nowIso),
    updatedAt: toIso(raw.updatedAt ?? nowIso, nowIso),
    dueDate: dueSplit.dueDate || new Date().toISOString().slice(0, 10),
    dueTime: dueSplit.dueTime,
    orderRef: raw.soId ? String(raw.soId) : undefined,
    serviceOrderStatus:
      typeof raw.serviceOrderStatus === "string"
        ? raw.serviceOrderStatus
        : undefined,
    paymentMethod:
      typeof raw.paymentMethod === "string" ? raw.paymentMethod : undefined,
    paymentStatus:
      typeof raw.paymentStatus === "string" ? raw.paymentStatus : undefined,
    totalPrice: toNumberOrUndefined(raw.totalPrice),
    customerNote: customerNote || undefined,
    appointmentDateRaw:
      typeof raw.appointmentDate === "string" ? raw.appointmentDate : undefined,
    customer: {
      id: String(raw.customerId ?? raw.soId ?? ""),
      name: customerName,
      phone: customerPhone,
      address: customerAddress,
      note: customerNote || undefined,
    },
    products,
    servicePackageMapping,
    photos,
    notes: Array.isArray(raw.notes)
      ? raw.notes.map((item: any, index: number) => ({
          id: String(item?.id ?? `note_${taskId}_${index}`),
          content: String(item?.content ?? item?.note ?? ""),
          createdAt: toIso(item?.createdAt ?? nowIso, nowIso),
          createdBy: String(item?.createdBy ?? ""),
          authorName: String(item?.authorName ?? item?.createdByName ?? ""),
        }))
      : [],
    checkInOut: {
      checkIn: checkInTime
        ? { time: toIso(checkInTime, nowIso), address: customerAddress }
        : undefined,
      checkOut: checkOutTime
        ? {
            time: toIso(checkOutTime, nowIso),
            address: customerAddress,
            note: typeof raw.staffNote === "string" ? raw.staffNote : undefined,
            durationMinutes:
              typeof raw.durationMinutes === "number" ? raw.durationMinutes : 0,
          }
        : undefined,
    },
    isSynced: true,
  };
};

const extractTaskItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;

  if (isRecord(payload.data)) {
    const nested = payload.data;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.results)) return nested.results;
    if (Array.isArray(nested)) return nested;
  }
  if (isRecord(payload)) return [payload];

  return [];
};

const parseTaskFromAny = (payload: unknown): Task | null => {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    return payload.length ? normalizeTask(payload[0]) : null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (isRecord(payload.data)) {
    return normalizeTask(payload.data);
  }

  return normalizeTask(payload);
};

export const TaskService = {
  // ================= GET =================

  async getTasks(params?: {
    page?: number;
    pageSize?: number;
    status?: TaskStatus | "all";
    date?: string;
    search?: string;
    staffId?: string;
  }): Promise<Task[]> {
    const response = await fetchTasks(params);
    // console.log("RAW RESPONSE:", response);
    // console.log("PAYLOAD:", response.data ?? response);

    const payload = response.data ?? response;

    return extractTaskItems(payload).map(normalizeTask);
  },

  async getTaskById(taskId: string): Promise<Task | undefined> {
    const response = await apiFetchTaskById(taskId);
    return parseTaskFromAny(response.data) ?? undefined;
  },

  // ================= UPDATE STATUS =================

  async updateStatus(taskId: string, status: TaskStatus): Promise<Task> {
    const response = await apiUpdateTaskStatus(taskId, status);
    const updated = parseTaskFromAny(response.data);
    if (updated) return updated;

    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after update");
    return refreshed;
  },

  // ================= ADD NOTE =================

  async addNote(taskId: string, note: TaskNote): Promise<Task> {
    const response = await apiAddTaskNote(taskId, note.content);
    const updated = parseTaskFromAny(response.data);
    if (updated) return updated;

    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after add note");
    return refreshed;
  },

  // ================= ADD PHOTO =================

  async addPhoto(
    taskId: string,
    photo: TaskPhoto & { fileName?: string; mimeType?: string },
  ): Promise<Task> {
    const response = await apiUploadTaskPhoto({
      taskId,
      type: photo.type,
      imageUri: photo.url,
      fileName: photo.fileName || photo.id,
      mimeType: photo.mimeType || "image/jpeg",
    });

    const updated = parseTaskFromAny(response.data);
    if (updated) return updated;

    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after upload photo");
    return refreshed;
  },

  // ================= CHECK IN =================

  async checkIn(taskId: string): Promise<Task> {
    const current = await this.getTaskById(taskId);
    if (!current) throw new Error("Task not found before check-in");

    // Idempotent behavior: if task is already beyond pending, return latest.
    if (
      current.status === "checked_in" ||
      current.status === "in_progress" ||
      current.status === "checked_out" ||
      current.status === "completed"
    ) {
      return current;
    }

    // Pending → CheckedIn
    await updateTaskCheckedInStatus(taskId);
    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after check-in");
    return refreshed;
  },

  // ================= START PROCESSING =================

  async startProcessing(taskId: string): Promise<Task> {
    const current = await this.getTaskById(taskId);
    if (!current) throw new Error("Task not found before start processing");

    const hasCheckedIn = !!current.checkInOut?.checkIn;
    const hasCheckedOut = !!current.checkInOut?.checkOut;
    const effectiveStatus: TaskStatus =
      current.status === "pending" && hasCheckedIn
        ? "checked_in"
        : current.status === "in_progress" && hasCheckedOut
          ? "checked_out"
          : current.status;

    // Idempotent behavior if backend already moved ahead.
    if (
      effectiveStatus === "in_progress" ||
      effectiveStatus === "checked_out" ||
      effectiveStatus === "completed"
    ) {
      return current;
    }

    if (effectiveStatus !== "checked_in") {
      throw new Error("Task chưa ở trạng thái checked-in.");
    }

    // CheckedIn → Processing
    await updateTaskProcessingStatus(taskId);
    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after start processing");
    return refreshed;
  },

  // ================= CHECK OUT =================

  async checkOut(taskId: string, note?: string): Promise<Task> {
    const current = await this.getTaskById(taskId);
    if (!current) throw new Error("Task not found before check-out");

    const hasCheckedIn = !!current.checkInOut?.checkIn;
    const hasCheckedOut = !!current.checkInOut?.checkOut;
    const effectiveStatus: TaskStatus =
      current.status === "pending" && hasCheckedIn
        ? "checked_in"
        : current.status === "in_progress" && hasCheckedOut
          ? "checked_out"
          : current.status;

    if (effectiveStatus === "checked_out" || effectiveStatus === "completed") {
      return current;
    }

    if (effectiveStatus === "checked_in") {
      await updateTaskProcessingStatus(taskId);
    }

    // Processing → CheckedOut
    await updateTaskCheckedOutStatus(taskId, note);
    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after check-out");
    return refreshed;
  },

  // ================= COMPLETE TASK =================

  async completeTask(taskId: string): Promise<Task> {
    // CheckedOut → Completed
    await apiUpdateTaskStatus(taskId, "completed");
    const refreshed = await this.getTaskById(taskId);
    if (!refreshed) throw new Error("Task not found after complete");
    return refreshed;
  },
};

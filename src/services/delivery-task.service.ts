import { Task, TaskNote, TaskPhoto, TaskStatus, UserRole } from "../types";
import {
  fetchOrderById,
  fetchShippingTaskById,
  fetchShippingTasks,
  TaskListParams,
  updateShippingTaskArrived,
  updateShippingTaskDelivered,
  updateShippingTaskDelivering,
  updateShippingTaskReturned,
  updateShippingTaskShippingDate,
  updateShippingTaskDeliveringForTradeIn,
  updateShippingTaskDeliveredForTradeIn,
  updateShippingTaskReturnedForTradeIn,
  updateShippingTaskForceCancelledForTradeIn,
  processReturnedForTradeIn,
  processExchangeForTradeIn,
} from "../utils/api";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { toIsoUtcOrEmpty } from "../utils/date";

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const toNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
};

const normalizeAssignedRole = (value?: string): UserRole | undefined => {
  const normalized = (value ?? "").trim().toLowerCase();

  if (!normalized) return undefined;
  if (normalized.includes("delivery")) return "delivery_driver";
  if (normalized.includes("clean")) return "cleaner";
  if (normalized.includes("warehouse")) return "warehouse_staff";
  if (normalized.includes("technic")) return "technician";
  if (normalized.includes("manager")) return "manager";
  if (normalized.includes("sale")) return "sales_staff";

  return undefined;
};

const collectAssignmentKeys = (raw: Record<string, any>): string[] => {
  const candidates = [
    raw.staffId,
    raw.assignedTo,
    raw.deliveryStaffId,
    raw.shipperId,
    raw.driverId,
    raw.staffName,
    raw.assignedToName,
    raw.driverName,
    raw.shipperName,
    raw.staff?.staffId,
    raw.staff?.id,
    raw.staff?.userId,
    raw.staff?.employeeCode,
    raw.staff?.phone,
    raw.staff?.phoneNumber,
    raw.staff?.email,
    raw.staff?.fullName,
    raw.staff?.name,
    raw.assignee?.staffId,
    raw.assignee?.id,
    raw.assignee?.userId,
    raw.assignee?.employeeCode,
    raw.assignee?.phone,
    raw.assignee?.phoneNumber,
    raw.assignee?.email,
    raw.assignee?.fullName,
    raw.assignee?.name,
  ];

  return candidates
    .map((value) => toTrimmedString(value)?.toLowerCase())
    .filter(
      (value, index, items): value is string =>
        !!value && items.indexOf(value) === index,
    );
};

const pickAssignedBackendRole = (raw: Record<string, any>): string =>
  String(
    toTrimmedString(raw.assignedRole) ??
      toTrimmedString(raw.staffRole) ??
      toTrimmedString(raw.roleName) ??
      toTrimmedString(raw.position) ??
      toTrimmedString(raw.staff?.role) ??
      toTrimmedString(raw.staff?.roleName) ??
      toTrimmedString(raw.staff?.position) ??
      toTrimmedString(raw.assignee?.role) ??
      toTrimmedString(raw.assignee?.roleName) ??
      toTrimmedString(raw.assignee?.position) ??
      "delivery_driver",
  );

const pickAssignedStaffId = (raw: Record<string, any>): string =>
  String(
    toTrimmedString(raw.staffId) ??
      toTrimmedString(raw.assignedTo) ??
      toTrimmedString(raw.deliveryStaffId) ??
      toTrimmedString(raw.shipperId) ??
      toTrimmedString(raw.driverId) ??
      toTrimmedString(raw.staff?.staffId) ??
      toTrimmedString(raw.staff?.id) ??
      toTrimmedString(raw.staff?.userId) ??
      toTrimmedString(raw.assignee?.staffId) ??
      toTrimmedString(raw.assignee?.id) ??
      toTrimmedString(raw.assignee?.userId) ??
      "",
  );

const pickAssignedStaffName = (raw: Record<string, any>): string =>
  String(
    toTrimmedString(raw.staffName) ??
      toTrimmedString(raw.assignedToName) ??
      toTrimmedString(raw.driverName) ??
      toTrimmedString(raw.shipperName) ??
      toTrimmedString(raw.staff?.fullName) ??
      toTrimmedString(raw.staff?.name) ??
      toTrimmedString(raw.assignee?.fullName) ??
      toTrimmedString(raw.assignee?.name) ??
      "",
  );

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
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

  if (isoMatch) {
    return { dueDate: isoMatch[1], dueTime: isoMatch[2] };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return {
      dueDate: new Date().toISOString().slice(0, 10),
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

const pickTimelineAt = (raw: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = raw[key];
    const iso = toTrimmedString(value);
    if (iso) return toIso(iso, iso);
  }

  return undefined;
};

const normalizeStatus = (value: unknown): TaskStatus => {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  if (raw === "pending") return "pending";
  if (raw === "delivering") return "delivering";
  if (raw === "arrived") return "arrived";
  if (raw === "delivered") return "delivered";
  if (raw === "returned" || raw === "returning" || raw === "failed") {
    return "returned";
  }
  if (raw === "exchangerequested" || raw === "exchange_requested") {
    return "exchange_requested";
  }
  if (raw === "cancelled" || raw === "canceled" || raw === "forcedcancelled") {
    return "cancelled";
  }
  if (raw.includes("return")) return "returned";
  if (raw.includes("exchange") && raw.includes("request")) {
    return "exchange_requested";
  }
  if (raw.includes("cancel")) return "cancelled";

  return "pending";
};
const mapEvidenceTypeToStage = (type?: string) => {
  const t = String(type || "").toLowerCase();

  if (t === "pickedup") return "start_delivery";
  if (t === "delivered") return "delivery_success";
  if (t === "failed" || t === "returned") return "delivery_failed";

  return undefined;
};
const normalizePhotos = (taskId: string, payload: Record<string, any>) => {
  const photoSources: unknown[] = [
    ...(Array.isArray(payload.evidenceUrls) ? payload.evidenceUrls : []),
    ...(Array.isArray(payload.relatedImageUrls)
      ? payload.relatedImageUrls
      : []),
    ...(Array.isArray(payload.imageUrls) ? payload.imageUrls : []),
    ...(Array.isArray(payload.orderImageUrls) ? payload.orderImageUrls : []),
    ...(Array.isArray(payload.shippingOrderImageUrls)
      ? payload.shippingOrderImageUrls
      : []),
    ...(Array.isArray(payload.serviceOrderImageUrl)
      ? payload.serviceOrderImageUrl
      : []),
    ...(Array.isArray(payload.images) ? payload.images : []),
    ...(Array.isArray(payload.evidences) ? payload.evidences : []),
    ...(Array.isArray(payload.photos) ? payload.photos : []),
  ];

  const seen = new Set<string>();

  return photoSources
    .map((item, index) => {
      const rawEvidenceType = String(
        typeof item === "string"
          ? ""
          : (item as any)?.evidenceType ?? (item as any)?.type ?? "",
      )
        .trim()
        .toLowerCase();
      const url =
        typeof item === "string"
          ? item
          : String(
              (item as any)?.url ??
                (item as any)?.imageUrl ??
                (item as any)?.fileUrl ??
                (item as any)?.evidenceUrl ?? // 👈 THÊM DÒNG NÀY
                "",
            );

      if (!url || seen.has(url)) return null;
      seen.add(url);

      return {
        id: String(
          (item as any)?.id ??
            (item as any)?.evidenceId ?? // 👈 thêm
            `delivery_photo_${taskId}_${index}`,
        ),
        url,
        type: rawEvidenceType.includes("payment") ? "payment" : "evidence",
        uploadedAt:
          typeof item === "string"
            ? ""
            : toIsoUtcOrEmpty(
                (item as any)?.createdAt ?? (item as any)?.uploadedAt,
              ),
        uploadedBy: pickAssignedStaffId(payload),
        captureStage:
          (item as any)?.captureStage ??
          (item as any)?.stage ??
          mapEvidenceTypeToStage((item as any)?.evidenceType),
      } as TaskPhoto;
    })
    .filter((item): item is TaskPhoto => !!item);
};

const normalizeNotes = (
  taskId: string,
  raw: Record<string, any>,
): TaskNote[] => {
  if (!Array.isArray(raw.notes)) return [];

  return raw.notes
    .map((item: any, index: number) => {
      const content = String(
        item?.content ?? item?.note ?? item?.description ?? "",
      ).trim();
      if (!content) return null;

      return {
        id: String(item?.id ?? item?.noteId ?? `${taskId}_note_${index}`),
        content,
        createdAt: toIso(item?.createdAt ?? new Date().toISOString()),
        createdBy: String(item?.createdBy ?? item?.staffId ?? ""),
        authorName: String(
          item?.authorName ?? item?.createdByName ?? item?.staffName ?? "",
        ),
      } as TaskNote;
    })
    .filter((item): item is TaskNote => !!item);
};

const normalizeProducts = (taskId: string, raw: Record<string, any>) => {
  const sources = Array.isArray(raw.orderItems)
    ? raw.orderItems
    : Array.isArray(raw.shippingOrderItems)
      ? raw.shippingOrderItems
      : Array.isArray(raw.products)
        ? raw.products
        : [];

  return sources.map((item: any, index: number) => {
    const unitPrice = toNumberOrUndefined(
      item?.unitPrice ?? item?.price ?? item?.totalPrice,
    );

    const totalQuantity =
      toNumberOrUndefined(
        item?.totalQuantity ??
          item?.totalQty ??
          item?.total ??
          item?.quantity,
      ) ?? 1;

    const exchangeQuantity =
      toNumberOrUndefined(
        item?.exchangeQuantity ??
          item?.exchangeQty ??
          item?.exchangeRequestedQuantity ??
          item?.exchangeRequestedQty ??
          item?.exchangeRequested ??
          item?.exchange ??
          item?.tradeInUsedAmount,
      ) ?? 0;

    const requestedQuantity =
      toNumberOrUndefined(item?.requestedQuantity ?? item?.requestQuantity) ??
      exchangeQuantity;

    const returnedQuantity =
      toNumberOrUndefined(
        item?.returnedQuantity ??
          item?.returnQuantity ??
          item?.returnQty ??
          item?.returnedQty ??
          item?.returnRequestedQuantity ??
          item?.returnRequestedQty ??
          item?.returnRequested ??
          item?.return,
      ) ?? 0;

    return {
      id: String(
        item?.id ??
          item?.orderItemId ??
          item?.shippingOrderItemId ??
          `${taskId}_item_${index}`,
      ),
      orderItemId: String(
        item?.orderItemId ?? item?.order_item_id ?? item?.id ?? "",
      ).trim() || undefined,
      name: String(
        item?.name ?? item?.productName ?? item?.itemName ?? "Product",
      ),
      type: String(item?.type ?? item?.sku ?? item?.productType ?? "delivery"),
      quantity: Number(item?.quantity ?? totalQuantity ?? 1) || 1,
      totalQuantity,
      exchangeQuantity,
      requestedQuantity,
      returnedQuantity,
      description:
        unitPrice !== undefined
          ? `${new Intl.NumberFormat("en-US").format(unitPrice)} ₫`
          : undefined,
    };
  });
};

const normalizeRelatedProducts = (taskId: string, raw: Record<string, any>) => {
  const sources = Array.isArray(raw.relatedProducts) ? raw.relatedProducts : [];
  if (!sources.length) return [];

  return sources.map((item: any, index: number) => {
    const unitPrice = toNumberOrUndefined(
      item?.unitPrice ?? item?.price ?? item?.totalPrice ?? item?.totalAmount,
    );

    const totalQuantity =
      toNumberOrUndefined(
        item?.totalQuantity ??
          item?.totalQty ??
          item?.total ??
          item?.quantity,
      ) ?? 1;

    return {
      id: String(
        item?.id ??
          item?.orderItemId ??
          item?.productVariantId ??
          item?.variantId ??
          `${taskId}_related_${index}`,
      ),
      orderItemId: String(
        item?.orderItemId ?? item?.order_item_id ?? item?.orderItemID ?? "",
      ).trim() || undefined,
      name: String(
        item?.name ??
          item?.productName ??
          item?.itemName ??
          item?.title ??
          "Product",
      ),
      type: String(item?.type ?? item?.sku ?? item?.productType ?? "delivery"),
      quantity: Number(item?.quantity ?? totalQuantity ?? 1) || 1,
      totalQuantity,
      description:
        unitPrice !== undefined
          ? `${new Intl.NumberFormat("en-US").format(unitPrice)} ₫`
          : undefined,
    };
  });
};

const buildAddress = (...parts: Array<string | undefined>) =>
  parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(", ");

const mergeOrderIntoTask = (task: Task, payload: unknown): Task => {
  const raw = isRecord(payload)
    ? isRecord(payload.data)
      ? payload.data
      : payload
    : {};

  const receiverName = String(
    raw.receiverName ??
      raw.receiveName ??
      raw.customerName ??
      task.customer.name ??
      "",
  ).trim();
  const phoneNumber = String(
    raw.phoneNumber ?? raw.customerPhone ?? task.customer.phone ?? "",
  ).trim();
  const address = buildAddress(
    toTrimmedString(raw.street),
    toTrimmedString(raw.ward),
    toTrimmedString(raw.district),
    toTrimmedString(raw.city) ?? toTrimmedString(raw.province),
  );
  const orderItems = Array.isArray(raw.items) ? raw.items : [];
  const products = orderItems.length
    ? orderItems.map((item: any, index: number) => {
        const unitPrice = toNumberOrUndefined(
          item?.totalAmount ?? item?.price ?? item?.unitPrice,
        );

        const totalQuantity =
          toNumberOrUndefined(
            item?.totalQuantity ??
              item?.totalQty ??
              item?.total ??
              item?.quantity,
          ) ?? 1;

        const exchangeQuantity =
          toNumberOrUndefined(
            item?.exchangeQuantity ??
              item?.exchangeQty ??
              item?.exchangeRequestedQuantity ??
              item?.exchangeRequestedQty ??
              item?.exchangeRequested ??
              item?.exchange ??
              item?.tradeInUsedAmount,
          ) ?? 0;

        const requestedQuantity =
          toNumberOrUndefined(item?.requestedQuantity ?? item?.requestQuantity) ??
          exchangeQuantity;

      const returnedQuantity =
        toNumberOrUndefined(
          item?.returnedQuantity ??
            item?.returnQuantity ??
            item?.returnQty ??
            item?.returnedQty ??
            item?.returnRequestedQuantity ??
            item?.returnRequestedQty ??
            item?.returnRequested ??
            item?.return,
        ) ?? 0;

        return {
          id: String(
            item?.id ?? item?.orderItemId ?? `${task.id}_order_item_${index}`,
          ),
          orderItemId: String(
            item?.orderItemId ?? item?.order_item_id ?? item?.id ?? "",
          ).trim() || undefined,
          name: String(
            item?.itemName ??
              item?.productName ??
              item?.name ??
              item?.title ??
              "Product",
          ),
          type: String(
            item?.productType ?? item?.sku ?? item?.type ?? "delivery",
          ),
          quantity: Number(item?.quantity ?? totalQuantity ?? 1) || 1,
          totalQuantity,
          exchangeQuantity,
          requestedQuantity,
        returnedQuantity,
          description:
            unitPrice !== undefined
              ? `${new Intl.NumberFormat("en-US").format(unitPrice)} ₫`
              : undefined,
        };
      })
    : task.products;

  return {
    ...task,
    taskCode:
      String(raw.orderCode ?? task.taskCode ?? "").trim() || task.taskCode,
    title:
      receiverName && !task.title.includes(receiverName)
        ? `Deliver to ${receiverName}`
        : task.title,
    customer: {
      ...task.customer,
      id: String(raw.id ?? task.customer.id ?? task.orderId ?? ""),
      name: receiverName || task.customer.name,
      phone: phoneNumber || task.customer.phone,
      address: address || task.customer.address,
      note:
        String(raw.note ?? task.customer.note ?? "").trim() ||
        task.customer.note,
    },
    orderId: String(raw.id ?? task.orderId ?? "").trim() || task.orderId,
    serviceOrderStatus:
      String(raw.status ?? task.serviceOrderStatus ?? "").trim() ||
      task.serviceOrderStatus,
    paymentMethod:
      String(
        raw.paymentMethod ?? raw.paymentType ?? task.paymentMethod ?? "",
      ).trim() || task.paymentMethod,
    totalPrice:
      toNumberOrUndefined(raw.totalAmount ?? raw.subTotal ?? raw.totalPrice) ??
      task.totalPrice,
    paymentStatus:
      String(raw.paymentStatus ?? task.paymentStatus ?? "").trim() ||
      task.paymentStatus,
    updatedAt: toTrimmedString(raw.updatedAt) ?? task.updatedAt,
    createdAt: toTrimmedString(raw.createdAt) ?? task.createdAt,
    products,
  };
};

async function hydrateTaskWithOrder(task: Task | undefined) {
  if (!task?.orderId) return task;

  try {
    const orderResponse = await fetchOrderById(task.orderId);
    return mergeOrderIntoTask(task, orderResponse.data);
  } catch {
    return task;
  }
}

const extractTaskItems = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  if (isRecord(payload.data)) {
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.results)) return payload.data.results;
  }
  return [];
};

const parseTask = (payload: unknown): Task | undefined => {
  if (isRecord(payload) && isRecord(payload.data)) {
    const parsed = normalizeTask(payload.data);
    return parsed;
  }
  if (!payload) return undefined;
  if (Array.isArray(payload))
    return payload.length ? normalizeTask(payload[0]) : undefined;
  if (isRecord(payload) && isRecord(payload.data))
    return normalizeTask(payload.data);
  if (isRecord(payload)) return normalizeTask(payload);
  return undefined;
};

const normalizeTask = (input: unknown): Task => {
  const raw = isRecord(input) ? input : {};
  const taskId = String(
    raw.shippingTaskId ?? raw.id ?? raw.taskId ?? `shipping_${Date.now()}`,
  );
  const customer = isRecord(raw.customer) ? raw.customer : {};
  const schedule = splitDateTime(
    raw.shippingDate ?? raw.deliveryDate ?? raw.expectedDeliveryTime,
  );
  const rawShippingStatus = String(raw.status ?? "").trim() || undefined;
  const customerName = String(
    raw.receiverName ??
      customer.name ??
      raw.customerName ??
      "No recipient available",
  ).trim();
  const customerPhone = String(
    raw.phoneNumber ??
      customer.phoneNumber ??
      customer.phone ??
      raw.customerPhone ??
      "",
  ).trim();
  const customerAddress = String(
    raw.address ?? raw.deliveryAddress ?? customer.address ?? "",
  ).trim();
  const taskCode = String(
    raw.orderCode ??
      raw.shippingCode ??
      raw.code ??
      raw.soId ??
      taskId.slice(0, 8),
  ).trim();
  const title =
    String(raw.title ?? raw.productName ?? raw.orderName ?? "").trim() ||
    `Delivery ${taskCode || taskId.slice(0, 8)}`;
  const description = String(
    raw.staffNote ?? raw.description ?? raw.note ?? "",
  ).trim();
  const photos = normalizePhotos(taskId, raw);
  const paymentPhotoUrl =
    photos.find((p) => p.type === "payment")?.url ?? undefined;
  const relatedImageUrls = photos.map((item) => item.url);
  const products = normalizeProducts(taskId, raw);
  const relatedProducts = normalizeRelatedProducts(taskId, raw);
  const assignedBackendRole = pickAssignedBackendRole(raw);
  const assignedRole =
    normalizeAssignedRole(assignedBackendRole) ?? "delivery_driver";
  const customerNote =
    String(
      raw.customerNote ?? customer.note ?? raw.noteFromCustomer ?? "",
    ).trim() || undefined;
  const completionAt = toTrimmedString(raw.completionDate);
  const shippingAt = toTrimmedString(raw.shippingDate);
  const deliveryTimeline = {
    deliveringAt:
      pickTimelineAt(raw, [
        "deliveringAt",
        "startDeliveringAt",
        "pickedUpAt",
      ]) ??
      (normalizeStatus(raw.status) === "delivering"
        ? toIso(shippingAt, shippingAt)
        : undefined),
    arrivedAt: pickTimelineAt(raw, ["arrivedAt", "arrivalAt"]),
    deliveredAt:
      pickTimelineAt(raw, ["deliveredAt", "completedAt", "finishedAt"]) ??
      (normalizeStatus(raw.status) === "delivered"
        ? toIso(completionAt, completionAt)
        : undefined),
    returnedAt:
      pickTimelineAt(raw, ["returnedAt", "failedAt", "cancelledAt"]) ??
      (normalizeStatus(raw.status) === "returned"
        ? toIso(completionAt, completionAt)
        : undefined),
  };
  const hasTimeline = Object.values(deliveryTimeline).some(Boolean);

  const damagedItems = Array.isArray(raw.damagedItems)
    ? raw.damagedItems
        .map((item: any) => ({
          orderItemId: String(item?.orderItemId ?? item?.id ?? "").trim(),
          damagedQuantity: Number(item?.damagedQuantity ?? item?.quantity ?? 0),
        }))
        .filter(
          (item: any) =>
            !!item.orderItemId && Number(item.damagedQuantity ?? 0) > 0,
        )
    : [];

  return {
    id: taskId,
    taskCode,
    title,
    description,
    type: "delivery",
    status: normalizeStatus(raw.status),
    rawShippingStatus,
    priority:
      raw.priority === "urgent" || raw.priority === "high"
        ? raw.priority
        : "medium",
    assignedTo: pickAssignedStaffId(raw),
    assignedToName: pickAssignedStaffName(raw),
    assignmentKeys: collectAssignmentKeys(raw),
    assignedRole,
    assignedBackendRole: assignedBackendRole || undefined,
    createdAt: toTrimmedString(raw.createdAt),
    updatedAt: toTrimmedString(raw.updatedAt),
    dueDate: schedule.dueDate,
    dueTime: schedule.dueTime,
    estimatedDuration: toNumberOrUndefined(
      raw.estimatedDuration ?? raw.durationMinutes,
    ),
    orderId:
      String(raw.orderId ?? raw.orderCode ?? raw.soId ?? "").trim() ||
      undefined,
    tradeInOrderId:
      toTrimmedString(raw.tradeInOrderId) ??
      toTrimmedString(raw.tradeInOrderID) ??
      toTrimmedString(raw.tradeInId) ??
      null,
    serviceOrderStatus:
      String(
        raw.shippingOrderStatus ??
          raw.orderStatus ??
          raw.serviceOrderStatus ??
          "",
      ).trim() || undefined,
    paymentMethod:
      String(raw.paymentMethod ?? raw.paymentType ?? "").trim() || undefined,
    paymentStatus:
      String(raw.paymentStatus ?? raw.paymentState ?? "").trim() || undefined,
    paymentEvidenceUrl:
      toTrimmedString(raw.PaymentEvidenceUrl) ??
      toTrimmedString(raw.paymentEvidenceUrl) ??
      toTrimmedString(raw.paymentEvidenceURL) ??
      toTrimmedString((raw as any)?.payment?.PaymentEvidenceUrl) ??
      toTrimmedString((raw as any)?.payment?.paymentEvidenceUrl) ??
      paymentPhotoUrl ??
      undefined,
    totalPrice: toNumberOrUndefined(
      raw.totalPrice ?? raw.totalAmount ?? raw.orderValue,
    ),
    customerNote,
    appointmentDateRaw:
      String(
        raw.shippingDate ?? raw.deliveryDate ?? raw.expectedDeliveryTime ?? "",
      ).trim() || undefined,
    customer: {
      id: String(raw.customerId ?? customer.id ?? raw.orderId ?? ""),
      name: customerName,
      phone: customerPhone,
      address: customerAddress || "",
      note: customerNote,
    },
    products,
    relatedProducts: relatedProducts.length ? relatedProducts : undefined,
    damagedItems,
    photos,
    notes: normalizeNotes(taskId, raw),
    deliveryTimeline: hasTimeline ? deliveryTimeline : undefined,
    deliveryFailureReason:
      String(raw.reason ?? raw.returnReason ?? raw.failedReason ?? "").trim() ||
      undefined,
    relatedImageUrls,
    isSynced: true,
  };
};

async function refreshDeliveryTask(taskId: string) {
  const detail = await DeliveryTaskService.getTaskById(taskId);
  if (!detail) throw new Error("Task not found after status update");
  return detail;
}

export const DeliveryTaskService = {
  async getTasks(params?: TaskListParams): Promise<Task[]> {
    const response = await fetchShippingTasks(params);
    const payload = response.data ?? response;
    const tasks = extractTaskItems(payload).map(normalizeTask);
    const hydratedTasks = await Promise.all(
      tasks.map((task) => hydrateTaskWithOrder(task)),
    );
    return hydratedTasks.filter((task): task is Task => !!task);
  },

  async getTaskById(taskId: string): Promise<Task | undefined> {
    const response = await fetchShippingTaskById(taskId);
    return hydrateTaskWithOrder(parseTask(response.data));
  },

  async startDelivery(
    taskId: string,
    evidenceUrls: string[] = [],
  ): Promise<Task> {
    const response = await updateShippingTaskDelivering(taskId, {
      evidenceUrls,
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markArrived(taskId: string): Promise<Task> {
    const response = await updateShippingTaskArrived(taskId);
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markDelivered(
    taskId: string,
    evidenceUrls: string[],
    options?: { paymentEvidenceUrl?: string },
  ): Promise<Task> {
    const response = await updateShippingTaskDelivered(taskId, {
      evidenceUrls,
      paymentEvidenceUrl: options?.paymentEvidenceUrl,
    });

    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markReturned(
    taskId: string,
    payload: {
      reason: string;
      evidenceUrls: string[];
      damagedItems?: Array<{ orderItemId: string; damagedQuantity: number }>;
    },
  ): Promise<Task> {
    const response = await updateShippingTaskReturned(taskId, {
      reason: payload.reason,
      evidenceUrls: payload.evidenceUrls,
      damagedItems: payload.damagedItems ?? [],
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  // Trade-in specific methods
  async startDeliveringForTradeIn(
    taskId: string,
    evidenceUrls: string[] = [],
  ): Promise<Task> {
    const response = await updateShippingTaskDeliveringForTradeIn(taskId, {
      evidenceUrls,
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markDeliveredForTradeIn(
    taskId: string,
    evidenceUrls: string[] = [],
  ): Promise<Task> {
    const response = await updateShippingTaskDeliveredForTradeIn(taskId, {
      evidenceUrls,
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markReturnedForTradeIn(
    taskId: string,
    reason: string,
    evidenceUrls: string[],
  ): Promise<Task> {
    const response = await updateShippingTaskReturnedForTradeIn(taskId, {
      reason,
      evidenceUrls,
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async markForcedCancelledForTradeIn(
    taskId: string,
    reason: string,
    evidenceUrls: string[],
  ): Promise<Task> {
    const response = await updateShippingTaskForceCancelledForTradeIn(taskId, {
      reason,
      evidenceUrls,
    });
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async updateShippingDate(
    taskId: string,
    payload: { shippingDate: string; note?: string },
  ): Promise<Task> {
    const response = await updateShippingTaskShippingDate(taskId, payload);
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async processReturnedForTradeIn(
    taskId: string,
    payload: {
      damageNote?: string;
      evidenceUrls?: string[];
      productVariantId?: string;
    },
  ): Promise<Task> {
    const response = await processReturnedForTradeIn(taskId, payload ?? {});
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async processExchangeForTradeIn(
    taskId: string,
    payload: {
      newStaffId?: string;
      exchangeNote?: string;
      evidenceUrls?: string[];
      productVariantId?: string;
    },
  ): Promise<Task> {
    const response = await processExchangeForTradeIn(taskId, payload ?? {});
    return (
      (await hydrateTaskWithOrder(parseTask(response.data))) ??
      (await refreshDeliveryTask(taskId))
    );
  },

  async addPhoto(
    task: Task,
    photo: {
      id?: string;
      url: string;
      type?: string;
      fileName?: string;
      mimeType?: string;
    },
  ): Promise<string> {
    return uploadImageToCloudinary(photo.url, {
      fileName:
        photo.fileName ||
        photo.id ||
        `${task.taskCode || task.id}_${Date.now()}`,
      mimeType: photo.mimeType || "image/jpeg",
    });
  },
};

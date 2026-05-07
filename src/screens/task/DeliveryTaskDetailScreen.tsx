import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTask } from "../../context/TaskContext";
import { Task, TaskStatus, TradeInOrder } from "../../types";
import { TaskStackParamList } from "../../types/navigation";
import {
  BorderRadius,
  Colors,
  Shadow,
  Spacing,
  Typography,
} from "../../constants/theme";
import { fetchPaymentByOrderId, updateOrderProcessing } from "../../utils/api";
import { formatDate } from "../../utils/date";
import { uploadImageToCloudinary } from "../../utils/cloudinary";
import { TradeInOrderService } from "../../services/trade-in-order.service";
type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

const DELIVERY_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  reschedule: "Reschedule",
  delivering: "Delivering",
  arrived: "Arrived",
  delivered: "Delivered",
  returned: "Returned",
  checked_in: "Checked In",
  in_progress: "In Progress",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  exchange_requested: "Exchange Requested",
};

function normalizeStatus(status?: string): TaskStatus {
  switch (status?.toLowerCase()) {
    case "pending":
      return "pending";
    case "delivering":
      return "delivering";
    case "arrived":
      return "arrived";
    case "delivered":
      return "delivered";
    case "returned":
      return "returned";

    case "exchangerequested":
      return "pending";

    default:
      return "pending";
  }
}

const DELIVERY_IMAGE_GROUP_LABELS = {
  start_delivery: "Captured Before Start Delivery",
  delivery_success: "Captured For Successful Delivery",
  delivery_failed: "Captured For Failed Delivery",
  other: "Other Related Images",
} as const;

type PaymentInfo = {
  paymentMethod?: string;
  paymentStatus?: string;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

const toTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed || undefined;
};

/** Backend allows start delivering only when order is Processing or ExchangeRequested */
function isServiceOrderReadyForDeliverStart(status?: string): boolean {
  const s = (status ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return (
    s === "processing" ||
    s === "inprogress" ||
    s === "exchangerequested"
  );
}

const extractPaymentInfo = (payload: unknown): PaymentInfo => {
  const source = isRecord(payload)
    ? isRecord(payload.data)
      ? payload.data
      : payload
    : {};

  const candidates = [
    source,
    source.payment,
    source.orderPayment,
    Array.isArray(source.items) ? source.items[0] : null,

    // ✅ THÊM DÒNG NÀY
    {
      paymentMethod: source.paymentMethod,
      paymentStatus: source.paymentStatus,
    },
  ];

  for (const item of candidates) {
    const paymentMethod =
      toTrimmedString(item.paymentMethod) ||
      toTrimmedString(item.payment_method) || // 👈 thêm
      toTrimmedString(item.method) ||
      toTrimmedString(item.type);

    const paymentStatus =
      toTrimmedString(item.paymentStatus) ||
      toTrimmedString(item.payment_status) || // 👈 thêm
      toTrimmedString(item.status) ||
      toTrimmedString(item.state);

    if (paymentMethod || paymentStatus) {
      return { paymentMethod, paymentStatus };
    }
  }

  return {};
};

export default function DeliveryTaskDetailScreen({ route, navigation }: Props) {
  const { shippingTaskId, type } = route.params;

  const { tasks, getTaskById, startDelivery, markArrived } =
    useTask();

  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [evidenceImageUri, setEvidenceImageUri] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({});
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const getTaskByIdRef = useRef(getTaskById);
  const taskRef = useRef<Task | undefined>(undefined);
  const paymentRequestIdRef = useRef(0);
  const loadTaskInFlightRef = useRef(false);
  const lastLoadTaskAtRef = useRef(0);
  const lastPaymentOrderIdRef = useRef<string | null>(null);

  const task = useMemo(
    () => tasks.find((item) => item.id === shippingTaskId),
    [shippingTaskId, tasks],
  );

  useEffect(() => {
    getTaskByIdRef.current = getTaskById;
  }, [getTaskById]);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  const loadPaymentInfo = useCallback(async (orderId?: string) => {
    const requestId = ++paymentRequestIdRef.current;

    if (!orderId) {
      setPaymentInfo({});
      return;
    }

    // Avoid spamming the same payment lookup when task refreshes rapidly.
    if (lastPaymentOrderIdRef.current === orderId) {
      return;
    }
    lastPaymentOrderIdRef.current = orderId;

    try {
      const response = await fetchPaymentByOrderId(orderId);

      if (paymentRequestIdRef.current !== requestId) return;

      setPaymentInfo(extractPaymentInfo(response.data ?? response));
    } catch (err) {
      if (paymentRequestIdRef.current !== requestId) return;

      setPaymentInfo({});
    }
  }, []);

  const loadTask = useCallback(async () => {
    if (!shippingTaskId) return; // 👈 chặn undefined

    // Dedupe + throttle focus-driven refreshes (prevents bursty reload loops).
    if (loadTaskInFlightRef.current) return;
    const now = Date.now();
    if (now - lastLoadTaskAtRef.current < 1500) return;
    lastLoadTaskAtRef.current = now;
    loadTaskInFlightRef.current = true;

    const shouldShowLoader = !taskRef.current;

    try {
      if (shouldShowLoader) {
        setDetailLoading(true);
      }

      const refreshedTask = await getTaskByIdRef.current(shippingTaskId, {
        forceRefresh: true,
      });

      await loadPaymentInfo(refreshedTask?.orderId ?? taskRef.current?.orderId);
    } finally {
      loadTaskInFlightRef.current = false;
      if (shouldShowLoader) {
        setDetailLoading(false);
      }
    }
  }, [loadPaymentInfo, shippingTaskId]);

  useFocusEffect(
    useCallback(() => {
      void loadTask();
    }, [loadTask]),
  );

  const imageUrls = useMemo(() => {
    const merged = [
      ...(task?.relatedImageUrls || []),
      ...(task?.photos || []).map((photo) => photo.url),
    ];

    return Array.from(
      new Set(merged.map((url) => String(url ?? "").trim()).filter(Boolean)),
    );
  }, [task]);

  const groupedImageSections = useMemo(() => {
    const photos = (task?.photos || []).map((p) => ({
      ...p,
      url: String(p?.url ?? "").trim(),
    }));
    const photoUrls = new Set(photos.map((photo) => photo.url).filter(Boolean));
    const sections = [
      {
        key: "start_delivery",
        title: DELIVERY_IMAGE_GROUP_LABELS.start_delivery,
        items: photos.filter(
          (photo) => photo.captureStage === "start_delivery",
        ),
      },
      {
        key: "delivery_success",
        title: DELIVERY_IMAGE_GROUP_LABELS.delivery_success,
        items: photos.filter(
          (photo) => photo.captureStage === "delivery_success",
        ),
      },
      {
        key: "delivery_failed",
        title: DELIVERY_IMAGE_GROUP_LABELS.delivery_failed,
        items: photos.filter(
          (photo) => photo.captureStage === "delivery_failed",
        ),
      },
      {
        key: "other",
        title: DELIVERY_IMAGE_GROUP_LABELS.other,
        items: [
          ...photos.filter((photo) => !photo.captureStage),

          ...(task?.relatedImageUrls || [])
            .map((url) => String(url ?? "").trim())
            .filter((url) => !!url && !photoUrls.has(url))
            .map((url, index) => ({
              id: `related_${index}_${url}`,
              url,
              type: "evidence" as const,
              uploadedAt: "",
              uploadedBy: "",
            })),

          ...((task as any)?.evidenceUrls || [])
            .map((url: string) => String(url ?? "").trim())
            .filter((url: string) => !!url && !photoUrls.has(url))
            .map((url: string, index: number) => ({
              id: `evidence_${index}_${url}`,
              url,
              type: "evidence" as const,
              uploadedAt: "",
              uploadedBy: "",
            })),
        ],
      },
    ];

    const seenUrls = new Set<string>();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!item.url || seenUrls.has(item.url)) return false;
          seenUrls.add(item.url);
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [task]);

  const timelineEntries = useMemo(() => {
    if (!task?.deliveryTimeline) return [];

    return [
      task.deliveryTimeline.deliveringAt
        ? {
            key: "delivering",
            label: "Started delivering",
            value: task.deliveryTimeline.deliveringAt,
          }
        : null,
      task.deliveryTimeline.arrivedAt
        ? {
            key: "arrived",
            label: "Arrived at destination",
            value: task.deliveryTimeline.arrivedAt,
          }
        : null,
      task.deliveryTimeline.deliveredAt
        ? {
            key: "delivered",
            label: "Delivered successfully",
            value: task.deliveryTimeline.deliveredAt,
          }
        : null,
      task.deliveryTimeline.returnedAt
        ? {
            key: "returned",
            label: "Returned / failed delivery",
            value: task.deliveryTimeline.returnedAt,
          }
        : null,
    ].filter(
      (item): item is { key: string; label: string; value: string } => !!item,
    );
  }, [task]);

  const noteItems = task?.notes || [];
  const paymentMethodValue = paymentInfo.paymentMethod ?? task?.paymentMethod;
  const paymentStatusValue = paymentInfo.paymentStatus ?? task?.paymentStatus;
  const requiresCodPaymentEvidence = useMemo(() => {
    const method = String(paymentMethodValue ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return method === "cod" || method.includes("cashondelivery");
  }, [paymentMethodValue]);
  const paymentEvidenceUrl = useMemo(() => {
    const url = String(
      (task as any)?.PaymentEvidenceUrl ??
        task?.paymentEvidenceUrl ??
        (task?.photos || []).find((p) => p.type === "payment")?.url ??
        "",
    ).trim();
    return url || null;
  }, [task]);
  const showOrderSection = !!(
    task?.serviceOrderStatus ||
    paymentMethodValue ||
    paymentStatusValue ||
    task?.totalPrice ||
    task?.estimatedDuration
  );

  const displayProducts = useMemo(() => {
    const normalizeKey = (value: unknown) =>
      String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");

    const extractCandidateItemIds = (product: unknown): string[] => {
      const p: any = product as any;
      const candidates = [
        // Most common keys (delivery order items)
        p?.orderItemId,
        p?.order_item_id,
        p?.orderItemID,
        p?.orderItem?.id,
        p?.orderItem?.orderItemId,

        // Other possible BE variations
        p?.shippingOrderItemId,
        p?.shippingOrderItemID,
        p?.serviceOrderItemId,
        p?.serviceOrderItemID,
        p?.orderLineId,
        p?.orderLineID,

        // Fallback
        p?.id,
      ];

      const normalized: string[] = [];
      for (const candidate of candidates) {
        const id = String(candidate ?? "").trim();
        if (!id) continue;
        if (normalized.includes(id)) continue;
        normalized.push(id);
      }
      return normalized;
    };

    const orderStatusKey = normalizeKey(task?.serviceOrderStatus);
    const taskStatusKey = normalizeKey(task?.status);
    const rawShippingStatusKey = normalizeKey((task as any)?.rawShippingStatus);

    const parseUnitPriceFromDescription = (value: unknown): number | undefined => {
      if (typeof value !== "string") return undefined;
      const raw = value.replace(/₫/g, "").replace(/,/g, "").trim();
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    };

    // Some BE flows create a new ShippingTask row for the same order after an exchange/return
    // (e.g. ExchangeRequested -> Delivering) but the newer row may no longer include `damagedItems`.
    // To keep "Related products" stable until the end of the delivery flow, we aggregate the
    // latest known damagedItems by orderId from TaskContext. However, when the current task
    // already has damagedItems, always prefer it (so subtraction works immediately after update).
    const parseIsoMs = (value?: string) => {
      if (!value) return 0;
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const pickTaskDamageTimestampMs = (t: Task) => {
      const anyT: any = t as any;
      return Math.max(
        parseIsoMs(anyT?.completionDate),
        parseIsoMs(anyT?.shippingDate),
        parseIsoMs(t?.deliveryTimeline?.returnedAt),
        parseIsoMs(t?.deliveryTimeline?.deliveredAt),
        parseIsoMs(t?.updatedAt),
        parseIsoMs(t?.createdAt),
      );
    };
    const damagedQtyByOrderItemId = new Map<string, number>();

    const relatedProducts = Array.isArray((task as any)?.relatedProducts)
      ? ((task as any).relatedProducts as any[])
      : [];
    const hasOrderId = !!String(task?.orderId ?? "").trim();
    const currentDamagedItems = Array.isArray((task as any)?.damagedItems)
      ? ((task as any).damagedItems as any[])
      : [];

    // Follow-up exchange/return delivery task:
    // - task is meant to deliver only the exchanged items (provided in relatedProducts)
    // - task itself has no damagedItems (those belong to the original task)
    //
    // This can happen even when orderId is still present (BE change).
    const isFollowUpExchangeDeliveryTask =
      relatedProducts.length > 0 && currentDamagedItems.length === 0;

    // Requirement:
    // - original order task: show products minus damagedItems
    // - follow-up task: show relatedProducts from start to end (do NOT subtract using previous task's damagedItems)
    const renderRelatedProductsAsIs =
      (!hasOrderId && relatedProducts.length > 0) || isFollowUpExchangeDeliveryTask;

    const orderIdKey = String(task?.orderId ?? "").trim();
    const relatedOrderTasks =
      orderIdKey && !renderRelatedProductsAsIs
        ? tasks.filter((t) => String(t?.orderId ?? "").trim() === orderIdKey)
        : [];
    const sourceTaskForDamages =
      currentDamagedItems.length > 0
        ? task
        : relatedOrderTasks
            .filter(
              (t) =>
                Array.isArray((t as any)?.damagedItems) &&
                ((t as any).damagedItems.length ?? 0) > 0,
            )
            .sort((a, b) => pickTaskDamageTimestampMs(b) - pickTaskDamageTimestampMs(a))[0] ??
          task;

    for (const item of (sourceTaskForDamages as any)?.damagedItems || []) {
      const id = String(item?.orderItemId ?? "").trim();
      const qty = Number(item?.damagedQuantity ?? 0);
      if (!id) continue;
      if (!Number.isFinite(qty) || qty <= 0) continue;
      damagedQtyByOrderItemId.set(id, qty);
    }
    const hasAnyDamagedItems = damagedQtyByOrderItemId.size > 0;

    const resolveReturnedQtyForProduct = (product: unknown): number => {
      const ids = extractCandidateItemIds(product);
      for (const id of ids) {
        const qty = damagedQtyByOrderItemId.get(id);
        if (qty !== undefined) return qty;
      }
      return Number((product as any)?.damagedQuantity ?? 0) ||
        Number((product as any)?.returnedQuantity ?? 0) ||
        Number((product as any)?.returnQuantity ?? 0) ||
        Number((product as any)?.returnQty ?? 0) ||
        Number((product as any)?.returnRequestedQuantity ?? 0) ||
        Number((product as any)?.returnRequested ?? 0) ||
        Number((product as any)?.return ?? 0) ||
        0;
    };

    const isReturningRaw =
      rawShippingStatusKey === "returning" ||
      rawShippingStatusKey.includes("returning");
    const isReturnedRaw =
      rawShippingStatusKey === "returned" || rawShippingStatusKey.includes("returned");
    const isExchangeRequestedOrder =
      taskStatusKey === "exchange_requested" ||
      rawShippingStatusKey === "exchangerequested" ||
      orderStatusKey === "exchangerequested" ||
      (orderStatusKey.includes("exchange") && orderStatusKey.includes("request"));

    const isReturnOrder =
      taskStatusKey === "returned" ||
      isReturnedRaw ||
      isReturningRaw ||
      orderStatusKey === "returned" ||
      orderStatusKey === "return" ||
      orderStatusKey.includes("return");

    // Partial delivery then reschedule: BE may mark task as Reschedule while still
    // returning damagedItems for the undelivered/returned units.
    const isRescheduleWithReturnedItems =
      taskStatusKey === "reschedule" &&
      Array.isArray((task as any)?.damagedItems) &&
      (task as any).damagedItems.length > 0;

    const isRequestOrder =
      !isExchangeRequestedOrder &&
      !isReturnOrder &&
      (orderStatusKey === "request" ||
        (orderStatusKey.includes("request") && !orderStatusKey.includes("exchange")));

    // For original orders, prefer hydrated order items (task.products); if missing, fall back to relatedProducts.
    const baseProducts =
      (task?.products?.length ?? 0) > 0 ? task?.products || [] : relatedProducts;
    const products = renderRelatedProductsAsIs ? relatedProducts : baseProducts;

    let displayedQtySum = 0;
    let rawQtySum = 0;
    let computedTotalByUnitPrice = 0;

    const computed = products
      .map((product) => {
        const p: any = product as any;
        const total = Number(p.totalQuantity ?? p.total ?? p.quantity ?? 0);
        const exchange = Number(
          p.exchangeQuantity ??
            p.exchangeRequestedQuantity ??
            p.exchangeRequested ??
            p.exchange ??
            0,
        );
        const requested = Number(
          p.requestedQuantity ??
            p.requestQuantity ??
            p.exchangeRequestedQuantity ??
            p.exchangeQuantity ??
            p.exchangeRequested ??
            p.exchange ??
            0,
        );
        const returned = resolveReturnedQtyForProduct(product);

        let displayQty = Number(p.quantity ?? 0);

        if (!renderRelatedProductsAsIs) {
        // Logic:
        // - Return / Failed / Returning: displayQty = total - returned
        // - Reschedule có hoàn trả (có damagedItems): displayQty = total - returned
        // - Exchange requested: BE now stores the exchanged/returned qty in damagedItems.damagedQuantity
        //   so prefer total - returned (fallback total - exchange for older payloads)
        // - Request: displayQty = requested
          // NOTE: In some deployments, BE may not reliably reflect Exchange/Returning status
          // on the same task row right after update, but damagedItems is already present.
          // When we have damagedItems, always subtract based on returned qty (per item),
          // regardless of status, to make UI stable.
          if (hasAnyDamagedItems && returned > 0) {
            displayQty = total - returned;
          } else if (isRequestOrder) {
            displayQty = requested;
          } else if (isExchangeRequestedOrder) {
          const effectiveReturned = returned > 0 ? returned : exchange;
          displayQty = total - effectiveReturned;
          } else if (isReturnOrder || isReturningRaw || isRescheduleWithReturnedItems) {
            displayQty = total - returned;
          } else {
            displayQty = Number(p.quantity ?? 0);
          }
        } else {
          // When backend provides `relatedProducts` (new shipping task after exchange),
          // render it as-is from start to end of the task.
          displayQty = Number(p.quantity ?? total ?? 0);
        }

        const safeDisplayQty = Number.isFinite(displayQty) ? Math.max(0, displayQty) : 0;
        const safeRawTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
        displayedQtySum += safeDisplayQty;
        rawQtySum += safeRawTotal;

        const unitPrice =
          ((): number | undefined => {
            const direct = Number(
              p.unitPrice ??
                p.unit_price ??
                p.price ??
                p.itemPrice ??
                p.amount ??
                p.value ??
                0,
            );
            if (Number.isFinite(direct) && direct > 0) return direct;
            return parseUnitPriceFromDescription(p.description);
          })() ?? 0;
        if (unitPrice > 0 && safeDisplayQty > 0) {
          computedTotalByUnitPrice += unitPrice * safeDisplayQty;
        }

        return { ...product, quantity: displayQty };
      })
      .filter((p) => Number(p.quantity ?? 0) > 0);

    const shouldAvoidShowingOrderTotal =
      renderRelatedProductsAsIs ||
      isReturnOrder ||
      isExchangeRequestedOrder ||
      isRequestOrder ||
      isRescheduleWithReturnedItems;

    // Total value = sum(unitPrice * displayQty) (only the "deliveredQty" that is displayed).
    const totalValue = computedTotalByUnitPrice;

    return {
      computed,
      hadAny: products.length > 0,
      totalValue,
      shouldAvoidShowingOrderTotal,
    };
  }, [task, tasks]);

  const needsReceiveOrderForDelivery = useMemo(() => {
    if (!task || task.status !== "pending") return false;
    if (!task.orderId?.trim()) return false;
    return !isServiceOrderReadyForDeliverStart(task.serviceOrderStatus);
  }, [task]);

  const handleOpenImage = useCallback((uri: string) => {
    const normalized = String(uri ?? "").trim();
    if (!normalized) return;
    setCurrentImage(normalized);
    setViewerVisible(true);
  }, []);

  if (!task) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centerWrap}>
          {detailLoading ? (
            <>
              <ActivityIndicator color={Colors.primary700} />
              <Text style={styles.centerText}>Loading task details...</Text>
            </>
          ) : (
            <Text style={styles.centerText}>Task not found.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const handleReceiveOrder = async () => {
    if (!task.orderId?.trim()) {
      Alert.alert(
        "Cannot receive order",
        "This delivery task is not linked to a service order.",
      );
      return;
    }

    try {
      setActionLoading(true);
      const res = await updateOrderProcessing(task.orderId);
      if (!res.success) {
        throw new Error(
          res.message || res.error || "Could not move order to Processing.",
        );
      }
      await getTaskById(task.id, { forceRefresh: true });
      await loadPaymentInfo(task.orderId);
      Alert.alert(
        "Order received",
        "The order is now in Processing. Capture evidence, then tap Start delivery.",
      );
    } catch (error: any) {
      Alert.alert(
        "Cannot update",
        error?.message || "Could not receive order.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDelivery = async () => {
    if (!isServiceOrderReadyForDeliverStart(task.serviceOrderStatus)) {
      Alert.alert(
        "Receive order first",
        "Tap Receive order below to set the order to Processing (or wait until it is Exchange requested), then start delivery.",
      );
      return;
    }

    if (!evidenceImageUri) {
      Alert.alert(
        "Missing evidence",
        "Please capture an evidence photo before starting delivery.",
      );
      return;
    }

    try {
      setActionLoading(true);

      const cloudinaryUrl = await uploadImageToCloudinary(evidenceImageUri);
      await startDelivery(task.id, [cloudinaryUrl]);

      await getTaskById(task.id, { forceRefresh: true });

      setEvidenceImageUri(null);
    } catch (error: any) {
      Alert.alert("Cannot update", error?.message || "Cannot start delivery.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCaptureEvidence = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Missing camera permission",
          "Camera permission is required to capture evidence.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setEvidenceImageUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        "Cannot open camera",
        error?.message || "An error occurred while opening the camera.",
      );
    }
  };

  const handleMarkArrived = async () => {
    try {
      setActionLoading(true);
      await markArrived(task.id);
      await getTaskById(task.id, { forceRefresh: true });
    } catch (error: any) {
      Alert.alert("Cannot update", error?.message || "Cannot mark as arrived.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backRow}
            activeOpacity={0.8}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.heroMetaRow}>
            <Text style={styles.taskCode}>{task.taskCode}</Text>
            <View
              style={[
                styles.statusBadge,
                getStatusBadgeStyle(normalizeStatus(task.status)),
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  getStatusBadgeTextStyle(normalizeStatus(task.status)),
                ]}
              >
                {DELIVERY_STATUS_LABELS[normalizeStatus(task.status)] ||
                  task.status}
              </Text>
            </View>
          </View>

          <Text style={styles.taskTitle}>{task.title}</Text>
          {!!task.description && (
            <Text style={styles.taskDescription}>{task.description}</Text>
          )}
        </View>

        <Section title="Delivery Information">
          <InfoRow
            icon="person-outline"
            label="Recipient"
            value={task.customer?.name || "-"}
          />
          <InfoRow
            icon="call-outline"
            label="Phone"
            value={task.customer?.phone || "-"}
          />
          <InfoRow
            icon="location-outline"
            label="Address"
            value={task.customer?.address || "-"}
          />

          <InfoRow
            icon="receipt-outline"
            label="Order Code"
            value={task.taskCode || "-"}
          />
          <InfoRow
            icon="time-outline"
            label="Shipping Date"
            value={formatSchedule(task)}
          />
          <InfoRow
            icon="checkmark-done-outline"
            label="Completion Date"
            value={
              task.deliveryTimeline?.deliveredAt ||
              task.deliveryTimeline?.returnedAt
                ? formatDateTimeDisplay(
                    task.deliveryTimeline?.deliveredAt ||
                      task.deliveryTimeline?.returnedAt,
                  )
                : "-"
            }
          />
        </Section>

        {showOrderSection ? (
          <Section title="Order & Payment">
            <KeyValueRow
              label="Order status"
              value={task.serviceOrderStatus || "-"}
            />
            <KeyValueRow
              label="Total value"
              value={
                displayProducts.totalValue !== undefined
                  ? formatCurrency(displayProducts.totalValue)
                  : displayProducts.shouldAvoidShowingOrderTotal
                    ? "-"
                    : formatCurrency(task.totalPrice)
              }
            />
            <KeyValueRow
              label="Payment method"
              value={paymentMethodValue || "-"}
            />
            <KeyValueRow
              label="Payment status"
              value={paymentStatusValue || "-"}
            />
            {paymentEvidenceUrl ? (
              <View style={{ marginTop: Spacing.base }}>
                <Text style={styles.imageSectionTitle}>Payment proof (COD)</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => handleOpenImage(paymentEvidenceUrl)}
                  style={{ marginTop: Spacing.sm }}
                >
                  <Image
                    source={{ uri: paymentEvidenceUrl }}
                    style={styles.capturePreviewImage}
                  />
                </TouchableOpacity>
              </View>
            ) : null}
          </Section>
        ) : null}

        {displayProducts.computed.length ? (
          <Section title="Related Products">
            {displayProducts.computed.map((product, index) => (
              <View key={product.id || index} style={styles.productRow}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  {!!product.description && (
                    <Text style={styles.productDescription}>
                      {product.description}
                    </Text>
                  )}
                </View>
                <Text style={styles.productQty}>x{product.quantity}</Text>
              </View>
            ))}
          </Section>
        ) : displayProducts.hadAny ? (
          <Section title="Related Products">
            <Text style={styles.centerText}>No products to deliver.</Text>
          </Section>
        ) : null}

        {!!task.description ? (
          <Section title="Staff Note">
            <Text style={styles.noteText}>{task.description}</Text>
          </Section>
        ) : null}

        {task.status === "pending" && needsReceiveOrderForDelivery ? (
          <Section title="Receive order">
            <Text style={styles.ruleText}>
              The service order must be in Processing (or Exchange requested)
              before you can start delivery. Tap &quot;Receive order&quot; at the
              bottom, then capture evidence and tap &quot;Start delivery&quot;.
            </Text>
            {!task.orderId?.trim() ? (
              <Text style={styles.warningText}>
                This task has no linked order ID. Contact the office if this
                message appears.
              </Text>
            ) : null}
          </Section>
        ) : null}

        {task.status === "pending" && !needsReceiveOrderForDelivery ? (
          <Section title="Start Delivery Evidence">
            <Text style={styles.ruleText}>
              Capture an evidence photo from the camera before starting
              delivery.
            </Text>

            <TouchableOpacity
              style={styles.captureBox}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={handleCaptureEvidence}
            >
              {evidenceImageUri ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => handleOpenImage(evidenceImageUri)}
                  style={{ width: "100%", height: 220 }}
                >
                  <Image
                    source={{ uri: evidenceImageUri }}
                    style={styles.capturePreviewImage}
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.capturePlaceholderWrap}>
                  <Ionicons
                    name="camera-outline"
                    size={40}
                    color={Colors.gray400}
                  />
                  <Text style={styles.capturePlaceholderTitle}>
                    Camera only
                  </Text>
                  <Text style={styles.capturePlaceholderSubtitle}>
                    Tap here to take an evidence photo before starting delivery.
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeButton}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={handleCaptureEvidence}
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={Colors.primary700}
              />
              <Text style={styles.retakeText}>
                {evidenceImageUri ? "Retake photo" : "Open camera"}
              </Text>
            </TouchableOpacity>
          </Section>
        ) : null}

        {noteItems.length ? (
          <Section title="Internal Notes">
            {noteItems.map((note) => (
              <View key={note.id} style={styles.noteItem}>
                <Text style={styles.noteText}>{note.content}</Text>
                <Text style={styles.noteMeta}>
                  {note.authorName || note.createdBy || "System"} •{" "}
                  {formatDateTimeDisplay(note.createdAt)}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}

        {timelineEntries.length ? (
          <Section title="Delivery Timeline">
            {timelineEntries.map((entry, index) => (
              <View
                key={entry.key}
                style={[
                  styles.timelineRow,
                  index === timelineEntries.length - 1 &&
                    styles.timelineRowLast,
                ]}
              >
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.infoLabel}>{entry.label}</Text>
                  <Text style={styles.infoValue}>
                    {formatDateTimeDisplay(entry.value)}
                  </Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {!!task.deliveryFailureReason && (
          <Section title="Delivery Failure Reason">
            <Text style={styles.failureReason}>
              {task.deliveryFailureReason}
            </Text>
          </Section>
        )}

        <Section title={`Related Images (${imageUrls.length})`}>
          {groupedImageSections.length ? (
            <View style={styles.groupedImageWrap}>
              {groupedImageSections.map((section) => (
                <View key={section.key} style={styles.imageSectionWrap}>
                  <Text style={styles.imageSectionTitle}>{section.title}</Text>
                  <View style={styles.imageGrid}>
                    {section.items.map((photo, index) => (
                      <View
                        key={`${photo.url}_${index}`}
                        style={styles.imageCard}
                      >
                        {photo.url ? (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => handleOpenImage(photo.url)}
                          >
                            <Image
                              source={{ uri: photo.url }}
                              style={styles.imageItem}
                            />
                          </TouchableOpacity>
                        ) : null}
                        {photo.uploadedAt ? (
                          <Text style={styles.imageMetaText}>
                            {formatDateTimeDisplay(photo.uploadedAt)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyPhotoWrap}>
              <Ionicons name="image-outline" size={28} color={Colors.gray400} />
              <Text style={styles.emptyPhotoText}>
                No related images for this task.
              </Text>
            </View>
          )}
        </Section>
      </ScrollView>

      {detailLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={Colors.primary700} />
        </View>
      ) : null}

      <View style={styles.bottomBar}>
        {task.status === "pending" && needsReceiveOrderForDelivery ? (
          <PrimaryButton
            title="Receive order"
            loading={actionLoading}
            onPress={handleReceiveOrder}
          />
        ) : null}

        {task.status === "pending" && !needsReceiveOrderForDelivery ? (
          <PrimaryButton
            title="Start Delivery"
            loading={actionLoading}
            onPress={handleStartDelivery}
          />
        ) : null}

        {task.status === "delivering" ? (
          <PrimaryButton
            title="Mark as Arrived"
            loading={actionLoading}
            onPress={handleMarkArrived}
          />
        ) : null}

        {task.status === "arrived" ? (
          <View style={styles.dualActionWrap}>
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                actionLoading && styles.buttonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={() =>
                navigation.navigate("DeliveryPhotoCapture", {
                  shippingTaskId: task.id,
                  mode: "returned",
                })
              }
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={Colors.error}
              />
              <Text style={styles.secondaryButtonText}>Delivery Failed</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                actionLoading && styles.buttonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={() =>
                navigation.navigate("DeliveryPhotoCapture", {
                  shippingTaskId: task.id,
                  mode: "delivered",
                  requiresCodPaymentEvidence,
                })
              }
            >
              <Ionicons name="camera-outline" size={18} color={Colors.white} />
              <Text style={styles.primaryButtonText}>Delivery Successful</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {task.status === "delivered" ? (
          <StatusMessage
            text="Task has been successfully delivered and evidence is available."
            tone="success"
          />
        ) : null}

        {task.status === "returned" ? (
          <StatusMessage
            text="Task has been marked as delivery failed."
            tone="error"
          />
        ) : null}
      </View>

      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setViewerVisible(false)}
            activeOpacity={0.9}
          >
            <Ionicons name="close-circle" size={40} color={Colors.white} />
          </TouchableOpacity>

          {currentImage ? (
            <Image
              source={{ uri: currentImage }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.primary700} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function PrimaryButton({
  title,
  loading,
  onPress,
}: {
  title: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryButton, loading && styles.buttonDisabled]}
      activeOpacity={0.85}
      disabled={loading}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <Text style={styles.primaryButtonText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.keyValueRow}>
      <Text style={styles.keyValueLabel}>{label}</Text>
      <Text style={styles.keyValueValue}>{value}</Text>
    </View>
  );
}

function StatusMessage({
  text,
  tone,
}: {
  text: string;
  tone: "success" | "error";
}) {
  return (
    <View
      style={[
        styles.statusMessage,
        tone === "success"
          ? styles.statusMessageSuccess
          : styles.statusMessageError,
      ]}
    >
      <Text
        style={[
          styles.statusMessageText,
          tone === "success"
            ? styles.statusMessageTextSuccess
            : styles.statusMessageTextError,
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

function getStatusBadgeStyle(status: TaskStatus) {
  switch (status) {
    case "reschedule":
      return { backgroundColor: "#EDE9FE" };
    case "delivering":
      return { backgroundColor: "#DBEAFE" };
    case "arrived":
      return { backgroundColor: "#E0F2FE" };
    case "delivered":
      return { backgroundColor: "#DCFCE7" };
    case "returned":
      return { backgroundColor: "#FEE2E2" };
    default:
      return { backgroundColor: "#FEF3C7" };
  }
}

function getStatusBadgeTextStyle(status: TaskStatus) {
  switch (status) {
    case "reschedule":
      return { color: "#6D28D9" };
    case "delivering":
      return { color: "#1D4ED8" };
    case "arrived":
      return { color: "#0369A1" };
    case "delivered":
      return { color: "#166534" };
    case "returned":
      return { color: "#B91C1C" };
    default:
      return { color: "#92400E" };
  }
}

function formatSchedule(task: Task) {
  const date = task.dueDate || (task as any).shippingDate;

  if (!date) return "No delivery schedule";

  const dateText = formatDate(date);
  return task.dueTime ? `${dateText} • ${task.dueTime}` : dateText;
}

function formatDateTimeDisplay(value?: string) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${formatDate(parsed.toISOString())} • ${hours}:${minutes}`;
}

function formatCurrency(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("en-US").format(value)} ₫`;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EDF2F7",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  centerText: {
    color: Colors.gray600,
    fontSize: Typography.base,
  },
  content: {
    paddingBottom: 140,
  },
  hero: {
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  backText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  heroMetaRow: {
    marginTop: Spacing.base,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  taskCode: {
    color: Colors.primary100,
    fontSize: Typography.sm,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  taskTitle: {
    marginTop: 12,
    color: Colors.white,
    fontSize: Typography["2xl"],
    fontWeight: "700",
    lineHeight: 30,
  },
  taskDescription: {
    marginTop: 8,
    color: "#D8E7FA",
    fontSize: Typography.base,
    lineHeight: 22,
  },
  section: {
    marginTop: Spacing.base,
    marginHorizontal: Spacing.base,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#DAE4EF",
    ...Shadow.sm,
  },
  sectionTitle: {
    color: Colors.primary900,
    fontSize: Typography.lg,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: Colors.gray500,
    fontSize: Typography.sm,
    marginBottom: 4,
  },
  infoValue: {
    color: Colors.gray800,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    color: Colors.gray800,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  productDescription: {
    marginTop: 4,
    color: Colors.gray500,
    fontSize: Typography.sm,
  },
  productQty: {
    color: Colors.primary700,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  noteText: {
    color: Colors.gray800,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  failureReason: {
    color: Colors.error,
    fontSize: Typography.base,
    lineHeight: 22,
    fontWeight: "600",
  },
  noteItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  noteMeta: {
    marginTop: 6,
    color: Colors.gray500,
    fontSize: Typography.sm,
  },
  ruleText: {
    color: Colors.gray800,
    fontSize: Typography.base,
    lineHeight: 22,
    fontWeight: "600",
  },
  warningText: {
    marginTop: Spacing.sm,
    color: Colors.error,
    fontSize: Typography.sm,
    lineHeight: 20,
    fontWeight: "600",
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    paddingBottom: 14,
  },
  timelineRowLast: {
    paddingBottom: 0,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: Colors.primary700,
  },
  timelineContent: {
    flex: 1,
  },
  keyValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  keyValueLabel: {
    color: Colors.gray500,
    fontSize: Typography.base,
  },
  keyValueValue: {
    flex: 1,
    textAlign: "right",
    color: Colors.gray800,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  groupedImageWrap: {
    gap: 16,
  },
  imageSectionWrap: {
    gap: 10,
  },
  imageSectionTitle: {
    color: Colors.primary900,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  imageCard: {
    width: 96,
    gap: 6,
  },
  captureBox: {
    marginTop: Spacing.base,
    minHeight: 220,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  capturePreviewImage: {
    width: "100%",
    height: 220,
  },
  capturePlaceholderWrap: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  capturePlaceholderTitle: {
    marginTop: 12,
    color: Colors.primary900,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  capturePlaceholderSubtitle: {
    marginTop: 6,
    color: Colors.gray500,
    fontSize: Typography.base,
    textAlign: "center",
    lineHeight: 20,
  },
  retakeButton: {
    marginTop: Spacing.base,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retakeText: {
    color: Colors.primary700,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  imageItem: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
  },
  imageMetaText: {
    color: Colors.gray500,
    fontSize: Typography.xs,
    lineHeight: 16,
  },
  emptyPhotoWrap: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.gray300,
    gap: 8,
  },
  emptyPhotoText: {
    color: Colors.gray500,
    fontSize: Typography.base,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor: "rgba(237,242,247,0.98)",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(237,242,247,0.2)",
  },
  primaryButton: {
    minHeight: 54,
    // width: "100%",
    borderRadius: 14,
    backgroundColor: Colors.primary700,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#F5C2C7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: Colors.error,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  dualActionWrap: {
    flexDirection: "row",
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  statusMessage: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  statusMessageSuccess: {
    backgroundColor: "#DCFCE7",
  },
  statusMessageError: {
    backgroundColor: "#FEE2E2",
  },
  statusMessageText: {
    fontSize: Typography.base,
    fontWeight: "700",
    textAlign: "center",
  },
  statusMessageTextSuccess: {
    color: "#166534",
  },
  statusMessageTextError: {
    color: "#B91C1C",
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: "100%",
    height: "80%",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
});

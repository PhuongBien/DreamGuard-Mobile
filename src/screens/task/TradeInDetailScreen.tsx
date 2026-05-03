import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { TradeInOrder, Task, TaskStatus } from "../../types";
import {
  normalizeTradeInStatus,
  type TradeInUIStatus,
} from "../../utils/tradeIn";
import { TaskStackParamList } from "../../types/navigation";
import { Colors, Shadow, Spacing, Typography } from "../../constants/theme";
import { formatDate, formatTime } from "../../utils/date";
import { TradeInOrderService } from "../../services/trade-in-order.service";
import { uploadImageToCloudinary } from "../../utils/cloudinary";
import { DeliveryTaskService } from "../../services/delivery-task.service";
import { fetchShippingTasksByTradeInOrderId } from "../../utils/api";

type Props = NativeStackScreenProps<TaskStackParamList, "TradeInDetail">;

const TRADEIN_STATUS_LABELS: Record<TradeInUIStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  processing: "Processing",
  delivered: "Delivered",
  returning: "Returning",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DELIVERY_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Awaiting processing",
  checked_in: "Checked In",
  in_progress: "In Progress",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  delivering: "Delivering",
  arrived: "Arrived",
  delivered: "Delivered",
  returned: "Returned",
  exchange_requested: "Exchange Requested",
};

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: "#F8B84A", text: "#1E293B" },
  checked_in: { bg: "#A3C4F3", text: "#1A3A6C" },
  in_progress: { bg: "#79A8E8", text: Colors.white },
  checked_out: { bg: "#A7D4FF", text: "#0F2854" },
  completed: { bg: "#7BCB8F", text: Colors.white },
  cancelled: { bg: "#E48787", text: Colors.white },
  on_hold: { bg: "#A6B1C6", text: Colors.white },
  delivering: { bg: "#DBEAFE", text: "#1D4ED8" },
  arrived: { bg: "#E0F2FE", text: "#0369A1" },
  delivered: { bg: "#DCFCE7", text: "#166534" },
  returned: { bg: "#FEE2E2", text: "#B91C1C" },
  exchange_requested: { bg: "#A6B1C6", text: Colors.white },
};

const ORDER_STATUS_COLORS: Record<
  TradeInUIStatus,
  { bg: string; text: string }
> = {
  pending: { bg: "#F8B84A", text: "#1E293B" },
  confirmed: { bg: "#A3C4F3", text: "#1A3A6C" },
  ready_for_delivery: { bg: "#A7D4FF", text: "#0F2854" },
  processing: { bg: "#79A8E8", text: Colors.white },
  delivered: { bg: "#A7D4FF", text: "#0F2854" },
  returning: { bg: "#FED7AA", text: "#9A3412" },
  completed: { bg: "#7BCB8F", text: Colors.white },
  cancelled: { bg: "#E48787", text: Colors.white },
};

function formatVnd(amount?: number | null) {
  if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
    return "—";
  }
  return `${new Intl.NumberFormat("en-US").format(Number(amount))} VND`;
}

function paymentStatusPillStyle(status: string): { bg: string; text: string } {
  const s = (status ?? "").trim().toLowerCase();
  if (s === "paid" || s === "completed" || s === "success") {
    return { bg: "#DDF4E6", text: "#2C8B52" };
  }
  if (s === "cod") {
    return { bg: "#DBEAFE", text: "#1D4ED8" };
  }
  if (s === "pending" || s === "unpaid") {
    return { bg: "#FEF3C7", text: "#92400E" };
  }
  if (s === "failed" || s === "cancelled") {
    return { bg: "#FEE2E2", text: "#B91C1C" };
  }
  return { bg: "#ECEEF2", text: "#475569" };
}

function normalizeShippingStatus(status?: string): TaskStatus {
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
    case "returning":
    case "failed":
      return "returned";
    case "exchangerequested":
      return "exchange_requested";
    default:
      return "pending";
  }
}

function formatDateTimeDisplay(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return `${formatDate(parsed.toISOString())} • ${formatTime(parsed.toISOString())}`;
}

function isPastIsoDateTime(value?: string | null): boolean {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

/** Backend Processing / InProgress — required before delivering-for-tradeIn */
function isTradeInOrderInProcessing(status?: string): boolean {
  const s = (status ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return s === "processing" || s === "inprogress";
}

export default function TradeInDetailScreen({ route, navigation }: Props) {
  const { tradeInOrderId, shippingTaskId: routeShippingTaskId } = route.params;
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<TradeInOrder | null>(null);
  const [shippingTask, setShippingTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [evidenceImageUri, setEvidenceImageUri] = useState<string | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);

  // Post-delivery unhappy-case processing (after RETURNED / FORCED_CANCELLED)
  const [processModalVisible, setProcessModalVisible] = useState(false);
  const [processMode, setProcessMode] = useState<"returned" | "exchange">(
    "returned",
  );
  const [processReasonNote, setProcessReasonNote] = useState<string>("");
  const [processNewStaffId, setProcessNewStaffId] = useState<string>("");
  const [processProductVariantId, setProcessProductVariantId] =
    useState<string>("");
  const [processEvidenceUris, setProcessEvidenceUris] = useState<string[]>([]);

  // Shipping schedule (ShippingTask.shippingDate) — required before Processing on BE
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<string>(""); // YYYY-MM-DD
  const [scheduleTime, setScheduleTime] = useState<string>(""); // HH:mm
  const [scheduleNote, setScheduleNote] = useState<string>("");
  const [scheduleShippingDateIso, setScheduleShippingDateIso] = useState<string | null>(
    null,
  );

  const activeTaskId = shippingTask?.id ?? routeShippingTaskId;

  const reloadShippingTask = useCallback(async () => {
    try {
      if (routeShippingTaskId) {
        const t = await DeliveryTaskService.getTaskById(routeShippingTaskId);
        setShippingTask(t ?? null);
        return;
      }
      if (!tradeInOrderId) {
        setShippingTask(null);
        return;
      }
      const res = await fetchShippingTasksByTradeInOrderId(tradeInOrderId);
      const id = res.success ? res.data?.items?.[0]?.shippingTaskId : undefined;
      if (!id) {
        setShippingTask(null);
        return;
      }
      const t = await DeliveryTaskService.getTaskById(id);
      setShippingTask(t ?? null);
    } catch {
      setShippingTask(null);
    }
  }, [routeShippingTaskId, tradeInOrderId]);

  const loadAll = useCallback(async () => {
    if (!tradeInOrderId) return;
    setLoading(true);
    try {
      const loaded = await TradeInOrderService.fetchById(tradeInOrderId);
      setOrder(loaded);
      await reloadShippingTask();
    } catch {
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [tradeInOrderId, reloadShippingTask]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
    }, [loadAll]),
  );

  const taskStatus = useMemo(
    () =>
      shippingTask
        ? normalizeShippingStatus(shippingTask.status)
        : ("pending" as TaskStatus),
    [shippingTask],
  );

  const timelineEntries = useMemo(() => {
    if (!shippingTask?.deliveryTimeline) return [];
    const tl = shippingTask.deliveryTimeline;
    return [
      tl.deliveringAt
        ? {
            key: "delivering",
            label: "Started delivering",
            value: tl.deliveringAt,
          }
        : null,
      tl.arrivedAt
        ? {
            key: "arrived",
            label: "Arrived at destination",
            value: tl.arrivedAt,
          }
        : null,
      tl.deliveredAt
        ? {
            key: "delivered",
            label: "Delivered successfully",
            value: tl.deliveredAt,
          }
        : null,
      tl.returnedAt
        ? {
            key: "returned",
            label: "Returned / failed delivery",
            value: tl.returnedAt,
          }
        : null,
    ].filter(
      (item): item is { key: string; label: string; value: string } => !!item,
    );
  }, [shippingTask]);

  const deliveryImageUrls = useMemo(() => {
    if (!shippingTask) return [];
    const merged = [
      ...(shippingTask.relatedImageUrls || []),
      ...(shippingTask.photos || []).map((p) => p.url),
    ];
    return Array.from(new Set(merged.filter(Boolean)));
  }, [shippingTask]);

  const sortedPayments = useMemo(() => {
    if (!order?.payments?.length) return [];
    return [...order.payments].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [order?.payments]);

  /** Shipping task still pending and trade-in order not yet in Processing (e.g. CONFIRMED) */
  const needsReceiveForDelivery = useMemo(
    () =>
      !!activeTaskId &&
      taskStatus === "pending" &&
      !!order &&
      !isTradeInOrderInProcessing(order.status),
    [activeTaskId, taskStatus, order],
  );

  const handleOpenImage = (uri: string) => {
    setCurrentImage(uri);
    setViewerVisible(true);
  };

  const handleCaptureDevicePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Missing camera permission",
          "Camera permission is required to capture device photos.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setSelectedPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (error: any) {
      Alert.alert(
        "Cannot open camera",
        error?.message || "An error occurred while opening the camera.",
      );
    }
  }, []);

  const handleUploadDevicePhotos = useCallback(async () => {
    if (!selectedPhotos.length) {
      Alert.alert("No photos selected");
      return;
    }
    if (!order?.tradeInOrderId) {
      Alert.alert("Error", "Missing trade-in order");
      return;
    }
    try {
      setActionLoading(true);
      for (const uri of selectedPhotos) {
        const updated = await TradeInOrderService.uploadImage(
          order.tradeInOrderId,
          uri,
        );
        if (updated) setOrder(updated);
      }
      setSelectedPhotos([]);
      Alert.alert("Success", "Photos uploaded to the trade-in order.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Upload failed");
    } finally {
      setActionLoading(false);
    }
  }, [selectedPhotos, order?.tradeInOrderId]);

  const handleReceiveOrder = async () => {
    if (!order?.tradeInOrderId) return;
    if (isPastIsoDateTime(shippingTask?.appointmentDateRaw)) {
      Alert.alert(
        "Shipping date invalid",
        "Shipping date cannot be in the past. Please update ShippingDate for this shipping task to today/future, then try again.",
      );
      return;
    }
    if (!scheduleShippingDateIso) {
      Alert.alert(
        "Missing shipping date",
        "Please set ShippingDate first, then click Receive Order.",
      );
      return;
    }
    try {
      setActionLoading(true);
      const updated = await TradeInOrderService.updateProcessing(
        order.tradeInOrderId,
        { shippingDate: scheduleShippingDateIso },
      );
      if (!updated) {
        throw new Error(
          "Unable to move the order to Processing. Please check the order status with the office.",
        );
      }
      setOrder(updated);
      Alert.alert(
        "Order Received",
        "The order has been moved to Processing. Next, take a photo as proof and click Start Delivery.",
      );
      await loadAll();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to receive order");
    } finally {
      setActionLoading(false);
    }
  };

  const openScheduleModal = useCallback(() => {
    const existing =
      shippingTask?.appointmentDateRaw ??
      (shippingTask?.dueDate
        ? `${shippingTask.dueDate}${shippingTask.dueTime ? `T${shippingTask.dueTime}:00` : ""}`
        : "");

    const parsed = existing ? new Date(existing) : null;
    const fallback = new Date();
    const base = parsed && !Number.isNaN(parsed.getTime()) ? parsed : fallback;

    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, "0");
    const dd = String(base.getDate()).padStart(2, "0");
    const hh = String(base.getHours()).padStart(2, "0");
    const min = String(base.getMinutes()).padStart(2, "0");

    setScheduleDate(`${yyyy}-${mm}-${dd}`);
    setScheduleTime(`${hh}:${min}`);
    setScheduleNote("");
    setScheduleModalVisible(true);
  }, [shippingTask?.appointmentDateRaw, shippingTask?.dueDate, shippingTask?.dueTime]);

  const handleSubmitSchedule = useCallback(async () => {
    const date = scheduleDate.trim();
    const time = scheduleTime.trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      Alert.alert("Invalid date", "Use format YYYY-MM-DD");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      Alert.alert("Invalid time", "Use format HH:mm");
      return;
    }

    const iso = `${date}T${time}:00`;
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) {
      Alert.alert("Invalid datetime", "Please check date/time values.");
      return;
    }
    if (parsed.getTime() < Date.now()) {
      Alert.alert(
        "Shipping date invalid",
        "Shipping date cannot be in the past.",
      );
      return;
    }

    try {
      setActionLoading(true);
      // Backend expects shippingDate on TradeInOrders/:id/processing payload.
      // Store it locally and let "Receive Order" submit it.
      setScheduleShippingDateIso(parsed.toISOString());
      setScheduleModalVisible(false);
      Alert.alert("Saved", "ShippingDate has been set. Now click Receive Order.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to set shipping date");
    } finally {
      setActionLoading(false);
    }
  }, [
    scheduleDate,
    scheduleNote,
    scheduleTime,
  ]);

  const handleCaptureEvidence = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
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
      if (!result.canceled && result.assets?.length > 0) {
        setEvidenceImageUri(result.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert("Camera error", err?.message);
    }
  }, []);

  const handleCaptureProcessEvidence = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
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
      if (!result.canceled && result.assets?.length > 0) {
        setProcessEvidenceUris((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (err: any) {
      Alert.alert("Camera error", err?.message);
    }
  }, []);

  const handleStartDelivering = async () => {
    if (!activeTaskId || !order) return;
    if (!isTradeInOrderInProcessing(order.status)) {
      Alert.alert(
        "Order Not Received",
        "Please click 'Receive Order' first to move the order to Processing, then you can start delivery.",
      );
      return;
    }
    if (!evidenceImageUri) {
      Alert.alert(
        "Missing Evidence Image",
        "Please take a photo as proof before starting the delivery.",
      );
      return;
    }
    try {
      setActionLoading(true);
      const url = await uploadImageToCloudinary(evidenceImageUri);
      if (!url) throw new Error("Upload failed");
      await DeliveryTaskService.startDeliveringForTradeIn(activeTaskId, [url]);
      setEvidenceImageUri(null);
      await loadAll();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to start delivery");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkArrived = async () => {
    if (!activeTaskId) return;
    try {
      setActionLoading(true);
      await DeliveryTaskService.markArrived(activeTaskId);
      await reloadShippingTask();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Cannot mark as arrived");
    } finally {
      setActionLoading(false);
    }
  };

  const openProcessModal = useCallback(
    (mode: "returned" | "exchange") => {
      setProcessMode(mode);
      setProcessReasonNote("");
      setProcessNewStaffId("");
      setProcessProductVariantId("");
      setProcessEvidenceUris([]);
      setProcessModalVisible(true);
    },
    [],
  );

  const handleSubmitPostReturnProcess = useCallback(async () => {
    if (!activeTaskId) return;
    if (!processProductVariantId.trim()) {
      Alert.alert("Missing productVariantId", "Please input productVariantId.");
      return;
    }
    if (!processReasonNote.trim()) {
      Alert.alert("Missing note", "Please input a note for this action.");
      return;
    }
    if (!processEvidenceUris.length) {
      Alert.alert(
        "Missing evidence",
        "Please capture at least one evidence photo.",
      );
      return;
    }
    if (processMode === "exchange" && !processNewStaffId.trim()) {
      Alert.alert("Missing newStaffId", "Please input newStaffId.");
      return;
    }

    try {
      setActionLoading(true);
      const evidenceUrls: string[] = [];
      for (const uri of processEvidenceUris) {
        const uploaded = await uploadImageToCloudinary(uri);
        if (uploaded) evidenceUrls.push(uploaded);
      }
      if (!evidenceUrls.length) throw new Error("Upload evidence failed");

      if (processMode === "returned") {
        await DeliveryTaskService.processReturnedForTradeIn(activeTaskId, {
          damageNote: processReasonNote.trim(),
          evidenceUrls,
          productVariantId: processProductVariantId.trim(),
        });
      } else {
        await DeliveryTaskService.processExchangeForTradeIn(activeTaskId, {
          newStaffId: processNewStaffId.trim(),
          exchangeNote: processReasonNote.trim(),
          evidenceUrls,
          productVariantId: processProductVariantId.trim(),
        });
      }

      setProcessModalVisible(false);
      await loadAll();
      Alert.alert("Success", "Submitted successfully.");
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Submit failed");
    } finally {
      setActionLoading(false);
    }
  }, [
    activeTaskId,
    processEvidenceUris,
    processMode,
    processNewStaffId,
    processProductVariantId,
    processReasonNote,
    loadAll,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.primary900}
        />
        <View style={styles.notFoundWrap}>
          <ActivityIndicator color={Colors.primary700} />
          <Text style={styles.notFound}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={Colors.primary900}
        />
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFound}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const uiStatus = normalizeTradeInStatus(order.status);
  const orderColors =
    ORDER_STATUS_COLORS[uiStatus] ?? ORDER_STATUS_COLORS.pending;
  const deliveryColors =
    STATUS_COLORS[taskStatus] ?? STATUS_COLORS.pending;
  const heroTitleText =
    order.orderItem?.itemName?.trim() || `Trade-in · ${order.orderCode}`;

  const unitPrice = order.orderItem?.unitPrice;
  const salePrice = order.productVariant?.salePrice;
  const depositAmount = order.depositAmount;

  const maxTradeInPriceByUnitMinusDeposit =
    unitPrice != null && depositAmount != null ? unitPrice - depositAmount : undefined;

  // Range rule:
  // - tradeInPrice in [minTradeInPrice, unitPrice - deposit]
  // - also ensure unitPrice <= salePrice so amountToPay (at max) won't go negative.
  const allowedMinTradeInPriceRaw = order.minTradeInPrice ?? 0;
  const allowedMaxTradeInPrice =
    unitPrice != null && depositAmount != null && salePrice != null
      ? unitPrice <= salePrice
        ? maxTradeInPriceByUnitMinusDeposit
        : salePrice - depositAmount
      : maxTradeInPriceByUnitMinusDeposit ?? order.maxTradeInPrice;

  // Defensive: ensure min <= max to avoid producing negative balance.
  const effectiveAllowedMinTradeInPrice =
    allowedMaxTradeInPrice != null
      ? Math.min(allowedMinTradeInPriceRaw, allowedMaxTradeInPrice)
      : allowedMinTradeInPriceRaw;

  const tradeInPriceForBalance =
    order.tradeInPrice != null && allowedMaxTradeInPrice != null
      ? Math.max(
          effectiveAllowedMinTradeInPrice,
          Math.min(allowedMaxTradeInPrice, order.tradeInPrice),
        )
      : order.tradeInPrice;

  const computedAmountToPay =
    salePrice != null &&
    depositAmount != null &&
    tradeInPriceForBalance != null
      ? salePrice - depositAmount - tradeInPriceForBalance
      : undefined;
  const amountToPayForDisplay =
    computedAmountToPay != null ? Math.max(0, computedAmountToPay) : order.amountToPay;

  const maxTradeInPriceForConfirm =
    allowedMaxTradeInPrice != null ? Math.max(0, allowedMaxTradeInPrice) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 110 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.headerMetaRow}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={styles.taskCode}>ORDER CODE: {order.orderCode}</Text>
              <Text style={styles.heroMetaLine}>
                {order.createdAt
                  ? `${formatDate(order.createdAt)} • ${formatTime(order.createdAt)}`
                  : "-"}
              </Text>
              {!!shippingTask?.taskCode && (
                <Text style={styles.heroMetaLine}>
                  SHIPPING TASK: {shippingTask.taskCode}
                </Text>
              )}
            </View>
            <View style={{ alignItems: "flex-end", gap: 8 }}>
              <View
                style={[styles.statusPill, { backgroundColor: orderColors.bg }]}
              >
                <Text
                  style={[styles.statusPillText, { color: orderColors.text }]}
                >
                  {TRADEIN_STATUS_LABELS[uiStatus] ?? order.status}
                </Text>
              </View>
              {activeTaskId ? (
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: deliveryColors.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: deliveryColors.text },
                    ]}
                  >
                    {DELIVERY_STATUS_LABELS[taskStatus]}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.heroTitle}>{heroTitleText}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CUSTOMER INFORMATION</Text>
          <View style={styles.infoRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>{order.receiverName || "N/A"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={Colors.primary500} />
            <Text style={[styles.infoText, styles.linkText]}>
              {order.phoneNumber || "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>{order.address || "N/A"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>PRODUCT INFORMATION</Text>
          <View style={styles.infoRow}>
            <Ionicons name="cube-outline" size={18} color={Colors.primary500} />
            <Text style={styles.infoText}>
              {order.orderItem?.itemName || "N/A"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons
              name="layers-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>
              Quantity: {String(order.orderItem?.quantity ?? 0)}
            </Text>
          </View>
          {order.orderItem?.unitPrice != null ? (
            <View style={styles.infoRow}>
              <Ionicons
                name="pricetag-outline"
                size={18}
                color={Colors.primary500}
              />
              <Text style={styles.infoText}>
                Unit price: {formatVnd(order.orderItem.unitPrice)}
              </Text>
            </View>
          ) : null}
          {order.orderItem?.totalPrice != null ? (
            <View style={styles.infoRow}>
              <Ionicons
                name="receipt-outline"
                size={18}
                color={Colors.primary500}
              />
              <Text style={styles.infoText}>
                Line total: {formatVnd(order.orderItem.totalPrice)}
              </Text>
            </View>
          ) : null}
          {order.orderItem?.tradeInUsedAmount != null ? (
            <View style={styles.infoRow}>
              <Ionicons
                name="swap-horizontal-outline"
                size={18}
                color={Colors.primary500}
              />
              <Text style={styles.infoText}>
                Trade-in units applied:{" "}
                {String(order.orderItem.tradeInUsedAmount)}
              </Text>
            </View>
          ) : null}
        </View>

        {order.productVariant ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PRODUCT VARIANT (NEW)</Text>
            <View style={styles.infoRow}>
              <Ionicons name="barcode-outline" size={18} color={Colors.primary500} />
              <Text style={styles.infoText}>SKU: {order.productVariant.sku}</Text>
            </View>
            {order.productVariant.size ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="resize-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>Size: {order.productVariant.size}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Ionicons name="cash-outline" size={18} color={Colors.primary500} />
              <Text style={styles.infoText}>
                Base / sale: {formatVnd(order.productVariant.basePrice)} →{" "}
                {formatVnd(order.productVariant.salePrice)}
              </Text>
            </View>
          </View>
        ) : null}

        {(order.oldProductVariantUrl || order.newProductVariantUrl) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>VARIANT IMAGES</Text>
            <View style={styles.variantPhotoRow}>
              {order.oldProductVariantUrl ? (
                <View style={styles.variantPhotoCol}>
                  <Text style={styles.variantPhotoCaption}>Trade-in (old)</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenImage(order.oldProductVariantUrl!)}
                  >
                    <Image
                      source={{ uri: order.oldProductVariantUrl }}
                      style={styles.variantPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
              {order.newProductVariantUrl ? (
                <View style={styles.variantPhotoCol}>
                  <Text style={styles.variantPhotoCaption}>New variant</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleOpenImage(order.newProductVariantUrl!)}
                  >
                    <Image
                      source={{ uri: order.newProductVariantUrl }}
                      style={styles.variantPhoto}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {(order.tradeInPrice != null ||
          order.amountToPay != null ||
          order.depositAmount != null ||
          order.isGood !== undefined) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PRICING & BALANCE</Text>
            {tradeInPriceForBalance != null ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="trending-down-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Trade-in credit: {formatVnd(tradeInPriceForBalance)}
                </Text>
              </View>
            ) : null}

            {allowedMaxTradeInPrice != null ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Allowed trade-in:{" "}
                  {formatVnd(effectiveAllowedMinTradeInPrice)} →{" "}
                  {formatVnd(allowedMaxTradeInPrice)}
                </Text>
              </View>
            ) : null}

            {maxTradeInPriceForConfirm != null ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Max confirm: {formatVnd(maxTradeInPriceForConfirm)}
                </Text>
              </View>
            ) : null}
            {order.depositAmount != null ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="wallet-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Deposit paid: {formatVnd(order.depositAmount)}
                </Text>
              </View>
            ) : null}
            {amountToPayForDisplay != null ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Amount to pay (COD / balance): {formatVnd(amountToPayForDisplay)}
                </Text>
              </View>
            ) : null}
            {order.isGood !== undefined ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name={order.isGood ? "checkmark-circle" : "alert-circle-outline"}
                  size={18}
                  color={Colors.primary500}
                />
                <Text style={styles.infoText}>
                  Device condition: {order.isGood ? "Good" : "Needs review"}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {sortedPayments.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>PAYMENTS</Text>
            {sortedPayments.map((p, index) => {
              const pill = paymentStatusPillStyle(p.status);
              return (
              <View
                key={p.id || `${p.paymentType}-${index}`}
                style={[
                  styles.paymentBlock,
                  index === sortedPayments.length - 1 && styles.paymentBlockLast,
                ]}
              >
                <View style={styles.paymentHeaderRow}>
                  <Text style={styles.paymentTypeText}>{p.paymentType}</Text>
                  <View
                    style={[styles.paymentStatusPill, { backgroundColor: pill.bg }]}
                  >
                    <Text
                      style={[styles.paymentStatusPillText, { color: pill.text }]}
                    >
                      {p.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons
                    name="phone-portrait-outline"
                    size={18}
                    color={Colors.primary500}
                  />
                  <Text style={styles.infoText}>
                    Method: {p.paymentMethod || "—"}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" size={18} color={Colors.primary500} />
                  <Text style={styles.infoText}>Amount: {formatVnd(p.amount)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="time-outline" size={18} color={Colors.primary500} />
                  <Text style={styles.infoText}>
                    {p.createdAt
                      ? formatDateTimeDisplay(p.createdAt)
                      : "—"}
                  </Text>
                </View>
                {p.orderCode ? (
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={Colors.primary500}
                    />
                    <Text style={styles.infoText}>Order ref: {p.orderCode}</Text>
                  </View>
                ) : null}
              </View>
            );
            })}
          </View>
        ) : null}

        {!activeTaskId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SHIPPING TASK</Text>
            <Text style={styles.descriptionText}>
              No shipping task is linked to this trade-in order. Open this screen
              from the delivery task list or ensure a task exists in the system.
            </Text>
          </View>
        ) : null}

        {activeTaskId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SHIPPING SCHEDULE</Text>
            <Text style={styles.descriptionText}>
              ShippingDate:{" "}
              {shippingTask?.appointmentDateRaw
                ? formatDateTimeDisplay(shippingTask.appointmentDateRaw)
                : scheduleShippingDateIso
                  ? formatDateTimeDisplay(scheduleShippingDateIso)
                  : "Not set"}
            </Text>
            <TouchableOpacity
              style={[
                styles.photoActionButton,
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={openScheduleModal}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={Colors.primary500}
              />
              <Text style={styles.uploadLinkText}>Set ShippingDate</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {timelineEntries.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>DELIVERY TIMELINE</Text>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>{entry.label}</Text>
                  <Text style={styles.timelineValue}>
                    {formatDateTimeDisplay(entry.value)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {!!shippingTask?.deliveryFailureReason && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>DELIVERY FAILURE REASON</Text>
            <Text style={styles.descriptionText}>
              {shippingTask.deliveryFailureReason}
            </Text>
          </View>
        )}

        {activeTaskId && (taskStatus === "returned" || taskStatus === "cancelled") ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>POST-RETURN PROCESSING</Text>
            <Text style={styles.descriptionText}>
              Use these actions after the task is returned / forced-cancelled to
              process the trade-in flow (returned/exchange).
            </Text>
            <View style={styles.dualActionWrap}>
              <TouchableOpacity
                style={[styles.secondaryActionButton, styles.dualActionButton]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() => openProcessModal("returned")}
              >
                <Ionicons
                  name="return-down-back-outline"
                  size={16}
                  color={Colors.error}
                />
                <Text style={styles.secondaryActionText}>Process returned</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.bottomActionButton, styles.dualActionButton]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() => openProcessModal("exchange")}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={16}
                  color={Colors.white}
                />
                <Text style={styles.bottomActionText}>Process exchange</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {deliveryImageUrls.length > 0 ? (
          <View style={styles.card}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.photoLabel}>
                Delivery evidence ({deliveryImageUrls.length})
              </Text>
            </View>
            <View style={styles.photoGrid}>
              {deliveryImageUrls.map((url) => (
                <TouchableOpacity
                  key={url}
                  onPress={() => handleOpenImage(url)}
                  style={styles.photoItem}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {taskStatus === "pending" && activeTaskId && needsReceiveForDelivery ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>RECEIVE ORDER</Text>
            <Text style={styles.descriptionText}>
              Press the &quot;Receive Order&quot; button at the bottom of the
              screen to move the order to Processing. Then take a photo as
              evidence and press &quot;Start Delivery&quot;.
            </Text>
          </View>
        ) : null}

        {taskStatus === "pending" &&
        activeTaskId &&
        !needsReceiveForDelivery ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>EVIDENCE — START DELIVERY</Text>
            <Text style={styles.descriptionText}>
              Take a photo as evidence and then tap &quot;Start Delivery&quot;
              below (same flow as a regular delivery order).
            </Text>
            <TouchableOpacity
              style={styles.captureBox}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={handleCaptureEvidence}
            >
              {evidenceImageUri ? (
                <Image
                  source={{ uri: evidenceImageUri }}
                  style={styles.capturePreviewImage}
                />
              ) : (
                <View style={styles.capturePlaceholderWrap}>
                  <Ionicons
                    name="camera-outline"
                    size={36}
                    color={Colors.gray400}
                  />
                  <Text style={styles.capturePlaceholderText}>
                    Tap to take a photo as evidence
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
                color={Colors.primary500}
              />
              <Text style={styles.uploadLinkText}>
                {evidenceImageUri ? "Take again" : "Open camera"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>DEVICE PHOTOS (TRADE-IN)</Text>

          {selectedPhotos.length > 0 && (
            <>
              <View style={styles.photoHeaderRow}>
                <Text style={styles.photoLabel}>
                  Pending upload ({selectedPhotos.length})
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {selectedPhotos.map((uri, idx) => (
                  <View key={`selected-${idx}`} style={styles.photoItem}>
                    <TouchableOpacity onPress={() => handleOpenImage(uri)}>
                      <Image
                        source={{ uri }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() =>
                        setSelectedPhotos((p) => p.filter((_, i) => i !== idx))
                      }
                    >
                      <Ionicons name="close" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}

          {order.tradeInImages && order.tradeInImages.length > 0 && (
            <>
              <View style={styles.photoHeaderRow}>
                <Text style={styles.photoLabel}>
                  Uploaded ({order.tradeInImages.length})
                </Text>
              </View>
              <View style={styles.photoGrid}>
                {order.tradeInImages.map((photo, idx) => (
                  <TouchableOpacity
                    key={`uploaded-${idx}`}
                    style={styles.photoItem}
                    onPress={() => handleOpenImage(photo.imageUrl)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: photo.imageUrl }}
                      style={styles.photoImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {selectedPhotos.length === 0 &&
            (!order.tradeInImages || order.tradeInImages.length === 0) && (
              <Text style={styles.descriptionText}>No photos yet.</Text>
            )}

          <View style={styles.photoActionRow}>
            <TouchableOpacity
              style={styles.photoActionButton}
              onPress={handleCaptureDevicePhoto}
              disabled={loading || actionLoading}
              activeOpacity={0.8}
            >
              <Ionicons
                name="camera-outline"
                size={16}
                color={Colors.primary500}
              />
              <Text style={styles.uploadLinkText}>Capture photo</Text>
            </TouchableOpacity>
          </View>

          {selectedPhotos.length > 0 ? (
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                { marginTop: Spacing.sm },
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              onPress={handleUploadDevicePhotos}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>
                    Upload to trade-in order
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {order.description ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOTES</Text>
            <Text style={styles.descriptionText}>{order.description}</Text>
          </View>
        ) : null}
      </ScrollView>

      {activeTaskId ? (
        <View
          style={[
            styles.bottomActionWrapper,
            { paddingBottom: 10 + insets.bottom },
          ]}
        >
          {taskStatus === "pending" && needsReceiveForDelivery ? (
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              onPress={handleReceiveOrder}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>Receive Order</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {taskStatus === "pending" && !needsReceiveForDelivery ? (
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              onPress={handleStartDelivering}
              disabled={actionLoading}
              activeOpacity={0.85}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="car-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>Start Delivery</Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}

          {taskStatus === "delivering" ? (
            <View style={styles.dualActionWrap}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  styles.dualActionButton,
                  actionLoading && styles.bottomActionButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() =>
                  navigation.navigate("DeliveryPhotoCapture", {
                    shippingTaskId: activeTaskId,
                    mode: "returned",
                    tradeInFlow: true,
                    tradeInOrderId: order.tradeInOrderId,
                  })
                }
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={Colors.error}
                />
                <Text style={styles.secondaryActionText}>Cannot deliver</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.bottomActionButton,
                  styles.dualActionButton,
                  actionLoading && styles.bottomActionButtonDisabled,
                ]}
                onPress={handleMarkArrived}
                disabled={actionLoading}
                activeOpacity={0.85}
              >
                {actionLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="location-outline"
                      size={16}
                      color={Colors.white}
                    />
                    <Text style={styles.bottomActionText}>Mark as arrived</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {taskStatus === "arrived" ? (
            <View style={styles.dualActionWrap}>
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  styles.dualActionButton,
                  actionLoading && styles.bottomActionButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() =>
                  navigation.navigate("DeliveryPhotoCapture", {
                    shippingTaskId: activeTaskId,
                    mode: "returned",
                    tradeInFlow: true,
                    tradeInOrderId: order.tradeInOrderId,
                  })
                }
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={Colors.error}
                />
                <Text style={styles.secondaryActionText}>Delivery failed</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.bottomActionButton,
                  styles.dualActionButton,
                  actionLoading && styles.bottomActionButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() =>
                  navigation.navigate("DeliveryPhotoCapture", {
                    shippingTaskId: activeTaskId,
                    mode: "delivered",
                    tradeInFlow: true,
                    tradeInOrderId: order.tradeInOrderId,
                  })
                }
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={Colors.white}
                />
                <Text style={styles.bottomActionText}>
                  Delivery successful
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {taskStatus === "delivered" ? (
            <View style={{ gap: 10 }}>
              <View style={styles.photoReminder}>
                <Ionicons name="checkmark-circle" size={20} color="#0284C7" />
                <Text style={styles.photoReminderText}>
                  Task delivered successfully. Evidence was submitted.
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  actionLoading && styles.bottomActionButtonDisabled,
                ]}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={() =>
                  navigation.navigate("DeliveryPhotoCapture", {
                    shippingTaskId: activeTaskId,
                    mode: "forced_cancelled",
                    tradeInFlow: true,
                    tradeInOrderId: order.tradeInOrderId,
                  })
                }
              >
                <Ionicons
                  name="warning-outline"
                  size={16}
                  color={Colors.error}
                />
                <Text style={styles.secondaryActionText}>
                  Forced cancel (trade-in mismatch)
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {taskStatus === "returned" ? (
            <View style={[styles.photoReminder, styles.photoReminderError]}>
              <Ionicons name="alert-circle" size={20} color="#B91C1C" />
              <Text
                style={[styles.photoReminderText, styles.photoReminderTextError]}
              >
                This delivery was marked as failed / returned.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={() => setViewerVisible(false)}
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

      <Modal visible={processModalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.processModalCard}>
            <View style={styles.processModalHeader}>
              <Text style={styles.processModalTitle}>
                {processMode === "returned"
                  ? "Process returned trade-in"
                  : "Process exchange trade-in"}
              </Text>
              <TouchableOpacity
                onPress={() => setProcessModalVisible(false)}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={22} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <Text style={styles.processHint}>
              Required: productVariantId, note, and evidence photos.
            </Text>

            {processMode === "exchange" ? (
              <TextInput
                value={processNewStaffId}
                onChangeText={setProcessNewStaffId}
                editable={!actionLoading}
                placeholder="newStaffId"
                placeholderTextColor={Colors.gray400}
                style={styles.processInput}
                autoCapitalize="none"
              />
            ) : null}

            <TextInput
              value={processProductVariantId}
              onChangeText={setProcessProductVariantId}
              editable={!actionLoading}
              placeholder="productVariantId"
              placeholderTextColor={Colors.gray400}
              style={styles.processInput}
              autoCapitalize="none"
            />

            <TextInput
              value={processReasonNote}
              onChangeText={setProcessReasonNote}
              editable={!actionLoading}
              placeholder={
                processMode === "returned" ? "damageNote" : "exchangeNote"
              }
              placeholderTextColor={Colors.gray400}
              style={[styles.processInput, styles.processTextArea]}
              multiline
            />

            <View style={styles.processEvidenceRow}>
              <TouchableOpacity
                style={styles.processEvidenceBtn}
                activeOpacity={0.85}
                disabled={actionLoading}
                onPress={handleCaptureProcessEvidence}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={Colors.primary700}
                />
                <Text style={styles.processEvidenceBtnText}>Add evidence</Text>
              </TouchableOpacity>
              <Text style={styles.processEvidenceCount}>
                {processEvidenceUris.length} photo(s)
              </Text>
            </View>

            {processEvidenceUris.length ? (
              <View style={styles.photoGrid}>
                {processEvidenceUris.map((uri, idx) => (
                  <View key={`${uri}-${idx}`} style={styles.photoItem}>
                    <TouchableOpacity onPress={() => handleOpenImage(uri)}>
                      <Image
                        source={{ uri }}
                        style={styles.photoImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.photoRemoveBtn}
                      onPress={() =>
                        setProcessEvidenceUris((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                    >
                      <Ionicons name="close" size={14} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={handleSubmitPostReturnProcess}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>Submit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={scheduleModalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <View style={styles.processModalCard}>
            <View style={styles.processModalHeader}>
              <Text style={styles.processModalTitle}>Set ShippingDate</Text>
              <TouchableOpacity
                onPress={() => setScheduleModalVisible(false)}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={22} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <Text style={styles.processHint}>
              Enter delivery date/time (must be now or future).
            </Text>

            <TextInput
              value={scheduleDate}
              onChangeText={setScheduleDate}
              editable={!actionLoading}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.gray400}
              style={styles.processInput}
              autoCapitalize="none"
            />

            <TextInput
              value={scheduleTime}
              onChangeText={setScheduleTime}
              editable={!actionLoading}
              placeholder="HH:mm"
              placeholderTextColor={Colors.gray400}
              style={styles.processInput}
              autoCapitalize="none"
            />

            <TextInput
              value={scheduleNote}
              onChangeText={setScheduleNote}
              editable={!actionLoading}
              placeholder="Note (optional)"
              placeholderTextColor={Colors.gray400}
              style={[styles.processInput, styles.processTextArea]}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                actionLoading && styles.bottomActionButtonDisabled,
              ]}
              activeOpacity={0.85}
              disabled={actionLoading}
              onPress={handleSubmitSchedule}
            >
              {actionLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="save-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#E9EEF3",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  notFound: {
    fontSize: Typography.base,
    color: Colors.gray700,
    padding: Spacing.base,
  },
  notFoundWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  heroCard: {
    backgroundColor: Colors.primary900,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
    ...Shadow.base,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  backText: {
    color: Colors.white,
    marginLeft: 6,
    fontSize: Typography.base,
    fontWeight: "500",
  },
  headerMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  taskCode: {
    color: Colors.primary100,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  heroMetaLine: {
    marginTop: 6,
    color: Colors.primary100,
    fontSize: Typography.xs,
    fontWeight: "500",
  },
  statusPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: Typography.xs,
    fontWeight: "700",
  },
  heroTitle: {
    marginTop: 8,
    color: Colors.white,
    fontSize: Typography.xl,
    fontWeight: "700",
    lineHeight: 28,
  },
  card: {
    backgroundColor: "#F8FAFD",
    borderRadius: 16,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#D8E1EB",
  },
  cardTitle: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: "#49658A",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 10,
  },
  infoText: {
    flex: 1,
    color: "#23364D",
    fontSize: Typography.md,
    lineHeight: 22,
  },
  linkText: {
    color: Colors.primary500,
  },
  descriptionText: {
    color: "#24364F",
    fontSize: Typography.md,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  timelineLabel: {
    fontSize: Typography.base,
    color: "#49658A",
    fontWeight: "600",
  },
  timelineValue: {
    fontSize: Typography.base,
    color: "#24364F",
    lineHeight: 21,
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#D8E1EB",
  },
  timelineRowLast: {
    borderBottomWidth: 0,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary700,
    marginTop: 6,
  },
  photoHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  photoLabel: {
    color: "#23364D",
    fontSize: Typography.lg,
    fontWeight: "600",
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  photoActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B9CDE2",
    backgroundColor: "#ECF4FC",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  uploadLinkText: {
    color: Colors.primary500,
    fontSize: Typography.base,
    fontWeight: "500",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoItem: {
    width: 74,
    height: 74,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#F3F6FB",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoRemoveBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  captureBox: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F6FB",
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  capturePreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  capturePlaceholderWrap: {
    alignItems: "center",
  },
  capturePlaceholderText: {
    color: Colors.gray500,
    fontSize: Typography.sm,
    marginTop: Spacing.sm,
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    gap: 6,
  },
  bottomActionWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    backgroundColor: "rgba(233,238,243,0.98)",
  },
  bottomActionButton: {
    backgroundColor: "#163667",
    borderRadius: 12,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  dualActionButton: {
    flex: 1,
  },
  bottomActionButtonDisabled: {
    opacity: 0.7,
  },
  bottomActionText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  dualActionWrap: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#F5C2C7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryActionText: {
    color: Colors.error,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  photoReminder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: "#E0F2FE",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0284C7",
  },
  photoReminderError: {
    backgroundColor: "#FEE2E2",
    borderColor: "#B91C1C",
  },
  photoReminderText: {
    color: "#0284C7",
    fontSize: Typography.base,
    fontWeight: "500",
    flex: 1,
  },
  photoReminderTextError: {
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
  variantPhotoRow: {
    flexDirection: "row",
    gap: Spacing.md,
    flexWrap: "wrap",
  },
  variantPhotoCol: {
    flex: 1,
    minWidth: 120,
  },
  variantPhotoCaption: {
    fontSize: Typography.xs,
    fontWeight: "600",
    color: "#49658A",
    marginBottom: 6,
  },
  variantPhoto: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  paymentBlock: {
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#D8E1EB",
  },
  paymentBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingBottom: 0,
  },
  paymentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  paymentTypeText: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: "700",
    color: "#1F3C65",
  },
  paymentStatusPill: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentStatusPillText: {
    fontSize: Typography.xs,
    fontWeight: "700",
  },
  closeBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },

  processModalCard: {
    width: "92%",
    maxWidth: 520,
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#D8E1EB",
  },
  processModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  processModalTitle: {
    flex: 1,
    color: Colors.primary900,
    fontSize: Typography.lg,
    fontWeight: "800",
  },
  processHint: {
    marginTop: 6,
    color: Colors.gray600,
    fontSize: Typography.sm,
    lineHeight: 18,
    marginBottom: Spacing.base,
  },
  processInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFD",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.gray800,
    fontSize: Typography.base,
    marginBottom: 10,
  },
  processTextArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  processEvidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: Spacing.sm,
  },
  processEvidenceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B9CDE2",
    backgroundColor: "#ECF4FC",
  },
  processEvidenceBtnText: {
    color: Colors.primary700,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  processEvidenceCount: {
    color: Colors.gray600,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Colors, Typography, Spacing, Shadow } from "../../constants/theme";
import { TaskStackParamList } from "../../types/navigation";
import { Rating, Task, TaskPhoto, TaskStatus } from "../../types";
import { useTask } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { getRatingsByStaffId } from "../../utils/api";
import { rescheduleServiceOrder } from "../../utils/api";
import { formatVietnamAddress } from "../../utils/address";
import { formatDate, formatTime, parseDate } from "../../utils/date";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

const STATUS_TEXT: Record<TaskStatus, string> = {
  pending: "Awaiting processing",
  reschedule: "Reschedule",
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

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = {
  pending: ["checked_in"],
  reschedule: [],
  checked_in: ["in_progress"],
  in_progress: ["checked_out"],
  on_hold: ["in_progress"],
  checked_out: ["completed"],
  completed: [],
  cancelled: [],
  delivering: [],
  arrived: [],
  delivered: [],
  returned: [],
  exchange_requested: [],
};

const TASK_IMAGE_GROUP_LABELS = {
  before: "Imgae Before",
  after: "Images After",
  orderReference: "Order reference",
  payment: "Payment / COD proof",
  other: "Other images",
} as const;

/** Service order must be confirmed or already processing (pending / other statuses → no reschedule). */
function serviceOrderStatusAllowsReschedule(raw: unknown): boolean {
  const s = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return s === "confirmed" || s === "processing" || s === "inprogress";
}

function getNextStatuses(status: TaskStatus, taskType?: string): TaskStatus[] {
  return NEXT_STATUSES[status] || [];
}

/** Same ordering/dedupe as task detail photos list — use explicit task object (e.g. return from getTaskById) so evidence URL is correct before React state catches up. */
function buildDedupedSortedPhotosFromTask(
  source: Task | null | undefined,
): TaskPhoto[] {
  const sortedPhotoSource = source?.photos ?? [];
  const sorted = [...sortedPhotoSource].sort((a, b) => {
    const aTime = new Date(a.uploadedAt || 0).getTime();
    const bTime = new Date(b.uploadedAt || 0).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return String(a.url || "").localeCompare(String(b.url || ""));
  });

  const bestTypeByKey = new Map<string, string>();
  for (const p of sorted) {
    const rawUrl = String(p?.url ?? "").trim();
    if (!rawUrl) continue;
    const key = rawUrl.split("?")[0];
    const currentBest = bestTypeByKey.get(key);
    if (!currentBest || currentBest === "evidence") {
      if (p.type && p.type !== "evidence") {
        bestTypeByKey.set(key, p.type);
      } else if (!currentBest) {
        bestTypeByKey.set(key, p.type || "evidence");
      }
    }
  }

  const seen = new Set<string>();
  const out: TaskPhoto[] = [];
  for (const p of sorted) {
    const rawUrl = String(p?.url ?? "").trim();
    if (!rawUrl) continue;
    const key = rawUrl.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    
    const bestType = bestTypeByKey.get(key) || p.type;
    out.push({ ...p, url: rawUrl, type: bestType as any });
  }
  return out;
}

function guessEvidenceUrlFromTask(source: Task | null | undefined): string {
  const list = buildDedupedSortedPhotosFromTask(source);
  const payment = list
    .filter((p) => p?.type === "payment")
    .map((p) => String(p?.url ?? "").trim())
    .filter(Boolean);
  if (payment.length) return payment[0]!;

  const after = list
    .filter((p) => p?.type === "after")
    .map((p) => String(p?.url ?? "").trim())
    .filter(Boolean);
  if (after.length) return after[0]!;

  const any = list
    .map((p) => String(p?.url ?? "").trim())
    .filter(Boolean);
  return any[0] || "";
}

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: "#F8B84A", text: "#1E293B" },
  reschedule: { bg: "#DDD6FE", text: "#5B21B6" },
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

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { user } = useAuth();
  const canViewTaskRating = user?.role === "cleaner";
  const isCleaner = user?.role === "cleaner";
  const {
    tasks,
    getTaskById,
    checkIn,
    checkInWithEvidence,
    startProcessing,
    checkOut,
    checkOutWithEvidence,
    completeTask,
    forcedCancel,
  } = useTask();

  const task = useMemo(
    () => tasks.find((item) => item.id === taskId),
    [tasks, taskId],
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [taskRating, setTaskRating] = useState<Rating | null>(null);
  const [showPhotoReminder, setShowPhotoReminder] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [forcedCancelNote, setForcedCancelNote] = useState("");
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [rescheduleDatePart, setRescheduleDatePart] = useState("");
  const [rescheduleTimePart, setRescheduleTimePart] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("");
  /** After successful reschedule: BE may spin a new task row; hide actions until manager assigns. */
  const [awaitingManagerReassignUi, setAwaitingManagerReassignUi] =
    useState(false);
  const [completeEvidenceModalVisible, setCompleteEvidenceModalVisible] =
    useState(false);
  const [completeEvidenceUrl, setCompleteEvidenceUrl] = useState("");
  const [viewerVisible, setViewerVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [pendingEvidenceAction, setPendingEvidenceAction] = useState<
    null | "checkin" | "checkout"
  >(null);
  const [pendingEvidenceTaskId, setPendingEvidenceTaskId] = useState<
    string | null
  >(null);
  const [pendingEvidenceBaselineUrls, setPendingEvidenceBaselineUrls] = useState<
    string[]
  >([]);
  const focusRefetchInFlightRef = useRef(false);
  const lastFocusRefetchAtRef = useRef(0);
  const lastFocusSuccessfulRefreshAtRef = useRef(0);
  const pendingEvidenceAttemptsRef = useRef(0);
  const lastPendingEvidenceCheckAtRef = useRef(0);

  // Keep photo UI stable across refresh/hydration (avoid reordering "jumps").
  const photoStableOrderRef = useRef<Map<string, number>>(new Map());
  const photoStableOrderCounterRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    const loadTaskDetail = async () => {
      if (!taskId) return;
      if (task) {
        return;
      }

      try {
        setDetailLoading(true);
        await getTaskById(taskId);
      } finally {
        if (mounted) {
          setDetailLoading(false);
        }
      }
    };

    loadTaskDetail();

    return () => {
      mounted = false;
    };
  }, [task, taskId, getTaskById]);

  useFocusEffect(
    useCallback(() => {
      if (!taskId) return;
      if (focusRefetchInFlightRef.current) return;
      const now = Date.now();
      if (now - lastFocusRefetchAtRef.current < 1500) return;

      // Avoid hammering API/DB on frequent focus toggles.
      // Only force refresh if data is "stale enough".
      const STALE_MS = 10_000;
      if (task && now - lastFocusSuccessfulRefreshAtRef.current < STALE_MS) {
        return;
      }

      lastFocusRefetchAtRef.current = now;
      focusRefetchInFlightRef.current = true;

      const forceRefresh = !task || now - lastFocusSuccessfulRefreshAtRef.current >= STALE_MS;
      getTaskById(taskId, forceRefresh ? { forceRefresh: true } : undefined)
        .catch(() => undefined)
        .finally(() => {
          focusRefetchInFlightRef.current = false;
          if (forceRefresh) {
            lastFocusSuccessfulRefreshAtRef.current = Date.now();
          }
        });
    }, [getTaskById, taskId, task]),
  );

  const getEvidenceUrlsFromTask = useCallback(
    (kind: "checkin" | "checkout", sourceTask: Task) => {
      const preferredType = kind === "checkin" ? "before" : "after";
      const urls = [...(sourceTask?.photos || [])]
        .filter(
          (p) => p?.type === preferredType && p?.source !== "order_reference",
        )
        .sort((a, b) => {
          const at = a?.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
          const bt = b?.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
          return bt - at;
        })
        .map((p) => String(p?.url ?? "").trim())
        .filter(Boolean);
      return Array.from(new Set(urls));
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const maybeFinalizePendingEvidence = async () => {
        if (!taskId) return;
        if (!pendingEvidenceAction) return;
        if (pendingEvidenceTaskId && pendingEvidenceTaskId !== taskId) return;

        // Throttle + cap retries to avoid spamming API/DB if the upload is slow
        // or the backend doesn't reflect the new photo immediately.
        const now = Date.now();
        if (now - lastPendingEvidenceCheckAtRef.current < 2000) return;
        lastPendingEvidenceCheckAtRef.current = now;

        pendingEvidenceAttemptsRef.current += 1;
        const MAX_ATTEMPTS = 3;
        if (pendingEvidenceAttemptsRef.current > MAX_ATTEMPTS) {
          setPendingEvidenceAction(null);
          setPendingEvidenceTaskId(null);
          setPendingEvidenceBaselineUrls([]);
          pendingEvidenceAttemptsRef.current = 0;
          return;
        }

        // Refetch (camera screen may upload then pop back).
        let latestTask: Task | null = null;
        try {
          latestTask =
            (await getTaskById(taskId, { forceRefresh: true })) ?? null;
        } catch {
          latestTask = task ?? null;
        }

        if (cancelled || !latestTask) return;

        const latestHasCheckedIn = !!latestTask.checkInOut?.checkIn;
        const latestHasCheckedOut = !!latestTask.checkInOut?.checkOut;
        const latestEffectiveStatus: TaskStatus =
          latestTask.status === "pending" && latestHasCheckedIn
            ? "checked_in"
            : latestTask.status === "in_progress" && latestHasCheckedOut
              ? "checked_out"
              : latestTask.status;

        // If user already progressed, clear pending.
        if (
          (pendingEvidenceAction === "checkin" &&
            latestEffectiveStatus !== "pending") ||
          (pendingEvidenceAction === "checkout" &&
            latestEffectiveStatus !== "in_progress")
        ) {
          setPendingEvidenceAction(null);
          setPendingEvidenceTaskId(null);
          setPendingEvidenceBaselineUrls([]);
          return;
        }

        const currentUrls = getEvidenceUrlsFromTask(
          pendingEvidenceAction,
          latestTask,
        );
        const baseline = pendingEvidenceBaselineUrls || [];
        const baselineKeySet = new Set(baseline.map((u) => u.split("?")[0]));
        const baselineFullSet = new Set(baseline);

        const byKey = currentUrls.filter(
          (u) => !baselineKeySet.has(u.split("?")[0]),
        );
        const byFull = currentUrls.filter((u) => !baselineFullSet.has(u));

        // Primary: key diff (stable across query strings). Fallback: full URL diff.
        // Last resort: if user just returned from camera/upload, do not trap them in a loop.
        const newEvidenceUrls =
          (byKey.length ? byKey : byFull.length ? byFull : currentUrls).slice(
            0,
            5,
          );

        if (!newEvidenceUrls.length) {
          // Still pending: user must capture at least one new photo.
          return;
        }

        try {
          setStatusLoading(true);
          if (pendingEvidenceAction === "checkin") {
            await checkInWithEvidence(taskId, newEvidenceUrls);
          } else {
            await checkOutWithEvidence(taskId, newEvidenceUrls);
            setShowPhotoReminder(true);
          }
          setPendingEvidenceAction(null);
          setPendingEvidenceTaskId(null);
          setPendingEvidenceBaselineUrls([]);
          pendingEvidenceAttemptsRef.current = 0;
        } catch (e: any) {
          Alert.alert("Error", e?.message || "Unable to update status.");
          // Stop the auto-loop on hard failures (e.g. 500).
          setPendingEvidenceAction(null);
          setPendingEvidenceTaskId(null);
          setPendingEvidenceBaselineUrls([]);
          pendingEvidenceAttemptsRef.current = 0;
        } finally {
          setStatusLoading(false);
        }
      };

      maybeFinalizePendingEvidence();

      return () => {
        cancelled = true;
      };
    }, [
      taskId,
      pendingEvidenceAction,
      pendingEvidenceTaskId,
      pendingEvidenceBaselineUrls,
      getTaskById,
      getEvidenceUrlsFromTask,
      checkInWithEvidence,
      checkOutWithEvidence,
      task,
    ]),
  );

  useEffect(() => {
    // Reset retry counters when user starts a new evidence flow.
    pendingEvidenceAttemptsRef.current = 0;
    lastPendingEvidenceCheckAtRef.current = 0;
  }, [pendingEvidenceAction, taskId]);

  useEffect(() => {
    setAwaitingManagerReassignUi(false);
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;

    const normalizeKey = (value: unknown) =>
      String(value ?? "")
        .trim()
        .toLowerCase();

    const extractItems = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.results)) return payload.results;
      if (Array.isArray(payload?.data?.items)) return payload.data.items;
      if (Array.isArray(payload?.data?.results)) return payload.data.results;
      return [];
    };

    const findRatingByKeys = (items: any[], keys: string[]) =>
      items.find((item) => {
        const candidateKeys = [
          item?.serviceOrderId,
          item?.soId,
          item?.orderId,
          item?.serviceOrderCode,
          item?.soCode,
          item?.orderCode,
        ]
          .map((value) => normalizeKey(value))
          .filter(Boolean);

        return candidateKeys.some((key) => keys.includes(key));
      });

    const loadRating = async () => {
      if (!canViewTaskRating || !user?.id) {
        setTaskRating(null);
        return;
      }

      // If rating is already embedded in current task, do not refetch.
      if (task?.rating?.score) {
        setTaskRating({
          id: task.rating.id || task.id,
          score: task.rating.score,
          comment: task.rating.comment,
          createdAt: task.rating.createdAt,
        });
        return;
      }

      const baseTask =
        task ||
        (taskId ? await getTaskById(taskId, { forceRefresh: true }) : null);

      if (cancelled || !baseTask) {
        if (!cancelled) setTaskRating(null);
        return;
      }

      const orderKeys = [baseTask.orderId, baseTask.taskCode, baseTask.id]
        .map((value) => normalizeKey(value))
        .filter(Boolean);

      if (!orderKeys.length) {
        setTaskRating(null);
        return;
      }

      try {
        const first = await getRatingsByStaffId(user.id, {
          pageNumber: 1,
          pageSize: 50,
        });

        if (cancelled) return;

        const firstPayload = first.data as any;
        const firstItems = extractItems(firstPayload);
        let found = findRatingByKeys(firstItems, orderKeys);

        const totalPages = Number(
          firstPayload?.totalPages ?? firstPayload?.data?.totalPages ?? 1,
        );

        if (!found && Number.isFinite(totalPages) && totalPages > 1) {
          for (let page = 2; page <= totalPages; page += 1) {
            const pageResponse = await getRatingsByStaffId(user.id, {
              pageNumber: page,
              pageSize: 50,
            });

            if (cancelled) return;

            const match = findRatingByKeys(
              extractItems(pageResponse.data),
              orderKeys,
            );
            if (match) {
              found = match;
              break;
            }
          }
        }

        if (cancelled) return;

        if (!found) {
          setTaskRating(null);
          return;
        }

        const score = Number(found.score ?? found.stars ?? found.star ?? 0);
        if (!Number.isFinite(score) || score <= 0) {
          setTaskRating(null);
          return;
        }

        setTaskRating({
          id: String(found.id ?? found.ratingId ?? baseTask.id),
          score,
          comment:
            String(
              found.comment ?? found.feedback ?? found.note ?? "",
            ).trim() || null,
          createdAt:
            String(
              found.createdAt ?? found.createdDate ?? found.ratingDate ?? "",
            ).trim() || null,
        });
      } catch {
        if (!cancelled) setTaskRating(null);
      }
    };

    loadRating();

    return () => {
      cancelled = true;
    };
  }, [
    canViewTaskRating,
    taskId,
    // Only depend on rating presence, not whole task object (avoid refetch on every photo update).
    task?.id,
    task?.rating?.score,
    user?.id,
    getTaskById,
  ]);

  const taskDetail = useMemo(() => {
    if (!task) return null;
    const hasCheckedIn = !!task.checkInOut?.checkIn;
    const hasCheckedOut = !!task.checkInOut?.checkOut;
    const effectiveStatus: TaskStatus =
      task.status === "reschedule"
        ? "reschedule"
        : task.status === "pending" && hasCheckedIn
          ? "checked_in"
          : task.status === "in_progress" && hasCheckedOut
            ? "checked_out"
            : task.status;
    const nextStatuses = getNextStatuses(effectiveStatus, task.type);
    const primaryNextStatus: TaskStatus | undefined = nextStatuses[0];
    const mapping = task.servicePackageMapping;
    const packageInfo = mapping?.servicePackage;
    const productTypeInfo = mapping?.productType;
    const orderStatusEligibleForReschedule =
      serviceOrderStatusAllowsReschedule(task.serviceOrderStatus);
    const canRescheduleByTaskStatus =
      effectiveStatus === "checked_in" || effectiveStatus === "in_progress";
    const canReschedule =
      !!task.orderId &&
      orderStatusEligibleForReschedule &&
      canRescheduleByTaskStatus;
    const displayAddress =
      formatVietnamAddress(task.customer.address) || "No address available";

    return {
      effectiveStatus,
      primaryNextStatus,
      canReschedule,
      mapping,
      packageInfo,
      productTypeInfo,
      displayAddress,
    };
  }, [task]);

  const sortedPhotoSource = task?.photos ?? [];
  const sortedPhotoList = useMemo(
    () =>
      [...sortedPhotoSource].sort((a, b) => {
        const aTime = new Date(a.uploadedAt || 0).getTime();
        const bTime = new Date(b.uploadedAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return String(a.url || "").localeCompare(String(b.url || ""));
      }),
    [sortedPhotoSource],
  );

  const dedupedSortedPhotoList = useMemo(() => {
    const bestTypeByKey = new Map<string, string>();
    for (const p of sortedPhotoList) {
      const rawUrl = String(p?.url ?? "").trim();
      if (!rawUrl) continue;
      const key = rawUrl.split("?")[0];
      const currentBest = bestTypeByKey.get(key);
      if (!currentBest || currentBest === "evidence") {
        if (p.type && p.type !== "evidence") {
          bestTypeByKey.set(key, p.type);
        } else if (!currentBest) {
          bestTypeByKey.set(key, p.type || "evidence");
        }
      }
    }

    const seen = new Set<string>();
    const out: typeof sortedPhotoList = [];

    for (const p of sortedPhotoList) {
      const rawUrl = String(p?.url ?? "").trim();
      if (!rawUrl) continue;
      const key = rawUrl.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      
      const bestType = bestTypeByKey.get(key) || p.type;
      out.push({ ...p, url: rawUrl, type: bestType as any });
    }

    return out;
  }, [sortedPhotoList]);

  const stablePhotoList = useMemo(() => {
    const keyOf = (url: string) => String(url ?? "").trim().split("?")[0];
    const map = photoStableOrderRef.current;

    for (const p of dedupedSortedPhotoList) {
      const k = keyOf(String(p?.url ?? ""));
      if (!k) continue;
      if (!map.has(k)) {
        // New photos get smaller order => appear first, but then stay stable.
        photoStableOrderCounterRef.current -= 1;
        map.set(k, photoStableOrderCounterRef.current);
      }
    }

    return [...dedupedSortedPhotoList].sort((a, b) => {
      const ak = keyOf(String(a?.url ?? ""));
      const bk = keyOf(String(b?.url ?? ""));
      const ao = ak && map.has(ak) ? (map.get(ak) as number) : 0;
      const bo = bk && map.has(bk) ? (map.get(bk) as number) : 0;
      if (ao !== bo) return ao - bo;
      return ak.localeCompare(bk);
    });
  }, [dedupedSortedPhotoList]);

  const groupedImageSections = useMemo(() => {
    const photos = (stablePhotoList || []).map((p) => ({
      ...p,
      url: String(p?.url ?? "").trim(),
      type: String(p?.type ?? "").trim(),
    }));

    const sections = [
      {
        key: "order_reference",
        title: TASK_IMAGE_GROUP_LABELS.orderReference,
        items: photos.filter((photo) => photo.source === "order_reference"),
      },
      {
        key: "before",
        title: TASK_IMAGE_GROUP_LABELS.before,
        items: photos.filter(
          (photo) => photo.type === "before" && photo.source !== "order_reference",
        ),
      },
      {
        key: "after",
        title: TASK_IMAGE_GROUP_LABELS.after,
        items: photos.filter(
          (photo) => photo.type === "after" && photo.source !== "order_reference",
        ),
      },
      {
        key: "payment",
        title: TASK_IMAGE_GROUP_LABELS.payment,
        items: photos.filter((photo) => photo.type === "payment"),
      },
      {
        key: "other",
        title: TASK_IMAGE_GROUP_LABELS.other,
        items: photos.filter(
          (photo) =>
            photo.source !== "order_reference" &&
            photo.type !== "before" &&
            photo.type !== "after" &&
            photo.type !== "payment",
        ),
      },
    ];

    const seenUrls = new Set<string>();
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (!item.url) return false;
          const key = item.url.split("?")[0];
          if (seenUrls.has(key)) return false;
          seenUrls.add(key);
          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [stablePhotoList]);

  const getEvidenceUrlsFor = useCallback(
    (kind: "checkin" | "checkout") => {
      const preferredType = kind === "checkin" ? "before" : "after";
      const preferred = (dedupedSortedPhotoList || [])
        .filter(
          (p) => p?.type === preferredType && p?.source !== "order_reference",
        )
        .map((p) => String(p?.url ?? "").trim())
        .filter(Boolean);

      // Keep payload small but sufficient.
      return Array.from(new Set(preferred)).slice(0, 5);
    },
    [dedupedSortedPhotoList],
  );

  const getEvidenceUrlsForTask = useCallback(
    (kind: "checkin" | "checkout", sourceTask: Task) => {
      const preferredType = kind === "checkin" ? "before" : "after";
      const preferred = (sourceTask?.photos || [])
        .filter(
          (p) => p?.type === preferredType && p?.source !== "order_reference",
        )
        .map((p) => String(p?.url ?? "").trim())
        .filter(Boolean);
      return Array.from(new Set(preferred)).slice(0, 5);
    },
    [],
  );

  const handleSubmitReschedule = useCallback(async () => {
    if (!task || !taskDetail) return;
    const serviceOrderId = String(task.orderId ?? "").trim();
    if (!serviceOrderId) {
      Alert.alert("Missing order", "Service order id is missing.");
      return;
    }

    if (!serviceOrderStatusAllowsReschedule(task.serviceOrderStatus)) {
      Alert.alert(
        "Not allowed",
        "Reschedule is only allowed when order status is Confirmed or Processing (not Pending or other statuses).",
      );
      return;
    }

    if (!taskDetail.canReschedule) {
      Alert.alert(
        "Not allowed",
        "Reschedule is only allowed after check-in while the task is checked in or in progress (processing), with an eligible order status (Confirmed/Processing).",
      );
      return;
    }

    const datePart = rescheduleDatePart.trim();
    const timePart = rescheduleTimePart.trim();
    if (!datePart || !timePart) {
      Alert.alert("Missing schedule", "Please enter both date and time.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      Alert.alert(
        "Invalid date",
        "Use calendar date format YYYY-MM-DD (e.g. 2026-04-18).",
      );
      return;
    }

    if (!/^\d{2}:\d{2}$/.test(timePart)) {
      Alert.alert(
        "Invalid time",
        "Use 24-hour time HH:mm (e.g. 14:30).",
      );
      return;
    }

    // Keep UI + BE aligned: user enters UTC time, server stores UTC ISO (`...Z`).
    const newAppointmentDate = `${datePart}T${timePart}:00.000Z`;
    const parsed = parseDate(newAppointmentDate);
    if (!parsed) {
      Alert.alert("Invalid datetime", "Could not combine date and time.");
      return;
    }

    try {
      setStatusLoading(true);
      await rescheduleServiceOrder({
        serviceOrderId,
        newAppointmentDate,
        staffReason: rescheduleReason.trim(),
      });
      await getTaskById(task.id, { forceRefresh: true });
      setAwaitingManagerReassignUi(true);
      setRescheduleModalVisible(false);
      setRescheduleDatePart("");
      setRescheduleTimePart("");
      setRescheduleReason("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to reschedule.");
    } finally {
      setStatusLoading(false);
    }
  }, [
    task,
    taskDetail,
    getTaskById,
    rescheduleDatePart,
    rescheduleTimePart,
    rescheduleReason,
  ]);

  const submitCompleteWithEvidence = useCallback(async () => {
    if (!task) return;

    let fresh: Task;
    try {
      fresh =
        (await getTaskById(task.id, { forceRefresh: true })) ?? task;
    } catch {
      fresh = task;
    }

    const isCod =
      String(fresh.paymentMethod ?? "").trim().toLowerCase() === "cod";
    const evidenceUrlResolved = completeEvidenceUrl.trim();
    const fallbackEvidenceUrl = guessEvidenceUrlFromTask(fresh).trim();
    const finalEvidenceUrl = evidenceUrlResolved || fallbackEvidenceUrl;

    // COD: allow completing with either manually entered URL OR uploaded payment photo.
    if (isCod && !finalEvidenceUrl) {
      Alert.alert(
        "Missing evidence",
        "COD payment requires evidence (upload a payment photo or provide evidence URL) before completing.",
      );
      return;
    }

    try {
      setStatusLoading(true);
      await completeTask(task.id, {
        evidenceUrl: finalEvidenceUrl,
      });
      setCompleteEvidenceModalVisible(false);
      setCompleteEvidenceUrl("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to complete task.");
    } finally {
      setStatusLoading(false);
    }
  }, [completeEvidenceUrl, completeTask, getTaskById, task]);

  const handlePrimaryAction = async () => {
    if (!task) return;
    try {
      setStatusLoading(true);
      const latestTask = (await getTaskById(task.id)) || task;
      const latestHasCheckedIn = !!latestTask.checkInOut?.checkIn;
      const latestHasCheckedOut = !!latestTask.checkInOut?.checkOut;
      const latestEffectiveStatus: TaskStatus =
        latestTask.status === "pending" && latestHasCheckedIn
          ? "checked_in"
          : latestTask.status === "in_progress" && latestHasCheckedOut
            ? "checked_out"
            : latestTask.status;

      if (latestEffectiveStatus === "pending") {
        const beforeEvidenceUrls = getEvidenceUrlsFromTask(
          "checkin",
          latestTask,
        );

        // If we already have Before photos, don't force recapture.
        // Instead, try to submit evidence directly.
        if (beforeEvidenceUrls.length) {
          try {
            await checkInWithEvidence(task.id, beforeEvidenceUrls);
            return;
          } catch (e: any) {
            Alert.alert(
              "Check-in failed",
              e?.message || "Unable to check in with the current photos.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Open camera",
                  onPress: () => {
                    setPendingEvidenceAction("checkin");
                    setPendingEvidenceTaskId(task.id);
                    setPendingEvidenceBaselineUrls(beforeEvidenceUrls);
                    handleOpenPhotoUpload("before", {
                      openCameraImmediately: true,
                    });
                  },
                },
              ],
            );
            return;
          }
        }

        const baseline = beforeEvidenceUrls;
        Alert.alert(
          "Photo required — check-in",
          "You must take a new Before photo at the location to check in.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open camera",
              onPress: () => {
                setPendingEvidenceAction("checkin");
                setPendingEvidenceTaskId(task.id);
                setPendingEvidenceBaselineUrls(baseline);
                handleOpenPhotoUpload("before", {
                  openCameraImmediately: true,
                });
              },
            },
          ],
        );
        return;
      } else if (latestEffectiveStatus === "in_progress") {
        const afterEvidenceUrls = getEvidenceUrlsForTask("checkout", latestTask);
        if (afterEvidenceUrls.length) {
          await checkOutWithEvidence(task.id, afterEvidenceUrls);
          setShowPhotoReminder(true);
          return;
        }

        const baseline = getEvidenceUrlsFromTask("checkout", latestTask);
        Alert.alert(
          "Photo required — check-out",
          "You must take a new After photo at the location to check out.",
          [
            { text: "Not now", style: "cancel" },
            {
              text: "Open camera",
              onPress: () => {
                setPendingEvidenceAction("checkout");
                setPendingEvidenceTaskId(task.id);
                setPendingEvidenceBaselineUrls(baseline);
                handleOpenPhotoUpload("after", {
                  openCameraImmediately: true,
                });
              },
            },
          ],
        );
        return;
      } else if (latestEffectiveStatus === "checked_out") {
        if (task.type === "cleaning" && !isCleaner) {
          Alert.alert("Not allowed", "Only cleaning staff can complete this task.");
          return;
        }

        const afterEvidenceUrls = getEvidenceUrlsForTask("checkout", latestTask);
        if (!afterEvidenceUrls.length) {
          Alert.alert(
            "Photo required — complete",
            "Take at least one After photo before you can complete.",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Open camera",
                onPress: () =>
                  handleOpenPhotoUpload("after", {
                    openCameraImmediately: true,
                  }),
              },
            ],
          );
          return;
        }

        const isCod =
          String(latestTask.paymentMethod ?? task.paymentMethod ?? "")
            .trim()
            .toLowerCase() === "cod";
        if (isCod) {
          const refreshedForCod =
            (await getTaskById(task.id, { forceRefresh: true })) ?? latestTask;

          const list = buildDedupedSortedPhotosFromTask(refreshedForCod);
          const paymentPhoto = list.find((p) => p?.type === "payment" && String(p?.url ?? "").trim() !== "");
          
          if (paymentPhoto && paymentPhoto.url) {
            await completeTask(task.id, { evidenceUrl: paymentPhoto.url });
            return;
          }

          const suggested = guessEvidenceUrlFromTask(refreshedForCod);
          setCompleteEvidenceUrl(suggested);
          setCompleteEvidenceModalVisible(true);
          return;
        }

        await completeTask(task.id, { evidenceUrl: "" });
      } else if (latestEffectiveStatus === "checked_in") {
        // Processing is handled by the dedicated button (shown in parallel with Cancelled).
        return;
      }
    } catch (error) {
      const msg = (error as any)?.message || "Unable to update status.";
      Alert.alert("Error", msg);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleStartProcessing = useCallback(async () => {
    if (!task) return;
    try {
      setStatusLoading(true);
      await startProcessing(task.id);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to start processing.");
    } finally {
      setStatusLoading(false);
    }
  }, [startProcessing, task]);

  const submitForcedCancel = useCallback(async () => {
    if (!task) return;
    const note = forcedCancelNote.trim();
    if (!note) {
      Alert.alert("Missing notes", "Please enter the reason for canceling your order.");
      return;
    }
    try {
      setStatusLoading(true);
      await forcedCancel(task.id, { staffNote: note });
      setCancelModalVisible(false);
      setForcedCancelNote("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Task cannot be canceled.");
    } finally {
      setStatusLoading(false);
    }
  }, [forcedCancel, forcedCancelNote, task]);

  const handleOpenPhotoUpload = useCallback(
    (
      type: "before" | "after" | "payment",
      options?: { openCameraImmediately?: boolean },
    ) => {
      if (!task) return;
      navigation.navigate("PhotoUpload", {
        shippingTaskId: task.id,
        photoType: type,
        openCameraImmediately: options?.openCameraImmediately === true,
      });
    },
    [navigation, task],
  );

  const handleOpenImage = useCallback((uri: string) => {
    const normalized = String(uri ?? "").trim();
    if (!normalized) return;
    setCurrentImage(normalized);
    setViewerVisible(true);
  }, []);

  if (!task) {
    return (
      <SafeAreaView style={styles.safe}>
        {detailLoading ? (
          <View style={styles.notFoundWrap}>
            <ActivityIndicator color={Colors.primary700} />
            <Text style={styles.notFound}>Loading task details...</Text>
          </View>
        ) : (
          <Text style={styles.notFound}>Task not found</Text>
        )}
      </SafeAreaView>
    );
  }

  const {
    effectiveStatus,
    primaryNextStatus,
    canReschedule,
    mapping,
    packageInfo,
    productTypeInfo,
    displayAddress,
  } = taskDetail!;

  const taskSupersededAwaitingReassign =
    !!task.rescheduleAwaitingNewTask ||
    awaitingManagerReassignUi ||
    task.status === "reschedule";

  const statusForBadge: TaskStatus = taskSupersededAwaitingReassign
    ? "reschedule"
    : effectiveStatus;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
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
            <Text style={styles.taskCode}>TASK CODE: {task.taskCode}</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    STATUS_COLORS[statusForBadge]?.bg || Colors.gray300,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color:
                      STATUS_COLORS[statusForBadge]?.text || Colors.gray800,
                  },
                ]}
              >
                {STATUS_TEXT[statusForBadge]}
              </Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>{task.title}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CUSTOMER INFORMATION</Text>

          <View style={styles.infoRow}>
            <Ionicons
              name="person-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>{task.customer.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color={Colors.primary500} />
            <Text style={[styles.infoText, styles.linkText]}>
              {task.customer.phone}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="location-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>{displayAddress}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.primary500} />
            <Text style={styles.infoText}>
              {formatDate(task.dueDate)}
              {task.dueTime ? ` • ${formatTaskTime(task.dueTime)}` : ""}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="chatbox-ellipses-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text style={styles.infoText}>
              {task.customer.note || "No customer notes available"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons
              name="document-text-outline"
              size={18}
              color={Colors.primary500}
            />
            <Text
              style={styles.infoText}
            >{`Order Status: ${task.serviceOrderStatus || "-"}`}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={18} color={Colors.primary500} />
            <Text
              style={styles.infoText}
            >{`Payment: ${task.paymentMethod || "-"} / ${task.paymentStatus || "-"}`}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={18} color={Colors.primary500} />
            <Text
              style={styles.infoText}
            >{`Total Price: ${formatCurrency(task.totalPrice)}`}</Text>
          </View>
        </View>

        {canReschedule && !taskSupersededAwaitingReassign ? (
          <TouchableOpacity
            style={styles.rescheduleAppointmentButton}
            onPress={() => {
              const split = splitAppointmentForRescheduleInput(task);
              setRescheduleDatePart(split.date);
              setRescheduleTimePart(split.time);
              setRescheduleReason("");
              setRescheduleModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={Colors.primary700}
            />
            <Text style={styles.rescheduleAppointmentButtonText}>
              Reschedule appointment
            </Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>TASK DESCRIPTION</Text>
          <Text style={styles.descriptionText}>{task.description}</Text>

          <View style={styles.tagRow}>
            {(task.products || []).slice(0, 3).map((product) => (
              <View key={product.id} style={styles.tagItem}>
                <Text
                  style={styles.tagText}
                >{`${product.name} x${product.quantity}`}</Text>
              </View>
            ))}
          </View>
        </View>

        {!!mapping && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SERVICE PACKAGE</Text>

            {packageInfo?.packageName ? (
              <Text style={styles.packageName}>{packageInfo.packageName}</Text>
            ) : null}

            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Price:</Text>
              <Text style={styles.serviceValue}>
                {formatCurrency(mapping?.price)}
              </Text>
            </View>

            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Duration:</Text>
              <Text style={styles.serviceValue}>
                {formatDuration(mapping.duration ?? packageInfo?.duration)}
              </Text>
            </View>

            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Product Type:</Text>
              <Text style={styles.serviceValue}>
                {productTypeInfo?.productTypeName || "-"}
              </Text>
            </View>

            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Status:</Text>
              <Text style={styles.serviceValue}>
                {packageInfo?.status || "-"}
              </Text>
            </View>

            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Suitable For:</Text>
              <Text style={styles.serviceValue}>
                {packageInfo?.suitableFor || "-"}
              </Text>
            </View>

            {!!packageInfo?.serviceContent && (
              <View style={styles.serviceBlock}>
                <Text style={styles.serviceLabel}>Service Content</Text>
                <Text style={styles.serviceBlockText}>
                  {packageInfo.serviceContent}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CHECK-IN / CHECK-OUT</Text>

          {task.checkInOut?.checkIn && (
            <Text style={styles.infoText}>
              Check-in: {formatDate(task.checkInOut.checkIn.time)} •{" "}
              {formatTime(task.checkInOut.checkIn.time)}
            </Text>
          )}

          {task.checkInOut?.checkOut && (
            <Text style={styles.infoText}>
              Check-out: {formatDate(task.checkInOut.checkOut.time)} •{" "}
              {formatTime(task.checkInOut.checkOut.time)}
            </Text>
          )}

          {/* <Text style={styles.infoTextMutedSmall}>
            Before photos are needed for check-in. After photos for check-out,
            payment photos when completing COD.
          </Text> */}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>IMAGES</Text>

          <View style={styles.photoHeaderRow}>
            <Text style={styles.photoLabel}>
              All Photos ({dedupedSortedPhotoList.length})
            </Text>
          </View>

          {!taskSupersededAwaitingReassign ? (
            <View style={styles.photoActionRow}>
              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={() => handleOpenPhotoUpload("before")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={Colors.primary500}
                />
                <Text style={styles.uploadLinkText}>Upload Before</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.photoActionButton}
                onPress={() => handleOpenPhotoUpload("after")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={Colors.primary500}
                />
                <Text style={styles.uploadLinkText}>Upload After</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.photoActionsDisabledHint}>
              Cannot add photos — this task row was superseded after reschedule.
            </Text>
          )}

          {groupedImageSections.length ? (
            <View style={styles.groupedImageWrap}>
              {groupedImageSections.map((section) => (
                <View key={section.key} style={styles.imageSectionWrap}>
                  <Text style={styles.imageSectionTitle}>{section.title}</Text>
                  <View style={styles.imageGrid}>
                    {section.items.map((photo, index) => (
                      <View
                        key={String(photo.url ? photo.url.split("?")[0] : `${section.key}_${index}`)}
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
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        ) : null}
                        {photo.uploadedAt ? (
                          <Text style={styles.imageMetaText}>
                            {formatDate(photo.uploadedAt)} •{" "}
                            {formatTime(photo.uploadedAt)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : !taskSupersededAwaitingReassign ? (
            <TouchableOpacity
              style={styles.photoPlaceholder}
              onPress={() => handleOpenPhotoUpload("before")}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={24} color={Colors.gray400} />
            </TouchableOpacity>
          ) : null}

          {!taskSupersededAwaitingReassign &&
            showPhotoReminder &&
            !(task.photos || []).some(
              (photo) =>
                photo.type === "after" && photo.source !== "order_reference",
            ) && (
              <View style={styles.photoReminder}>
                <Ionicons name="camera" size={20} color={Colors.primary500} />
                <Text style={styles.photoReminderText}>
                  Please take a photo after completing the task.
                </Text>
              </View>
            )}
        </View>

        {canViewTaskRating && !!taskRating && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>RATING</Text>

            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Ionicons
                  key={i}
                  name={
                    i <= Math.round(taskRating.score) ? "star" : "star-outline"
                  }
                  size={20}
                  color={
                    i <= Math.round(taskRating.score)
                      ? Colors.warning
                      : Colors.gray300
                  }
                />
              ))}
              <Text style={styles.ratingScoreText}>
                {taskRating.score.toFixed(1)}
              </Text>
            </View>

            {!!taskRating.comment && (
              <Text style={styles.ratingComment}>{taskRating.comment}</Text>
            )}

            {!!taskRating.createdAt && (
              <Text style={styles.ratingDateText}>
                {formatDate(taskRating.createdAt)}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {taskSupersededAwaitingReassign ? (
        <View style={styles.bottomActionWrapper}>
          <View style={styles.rescheduleAwaitingBanner}>
            <Ionicons
              name="information-circle-outline"
              size={24}
              color="#92400E"
            />
            <Text style={styles.rescheduleAwaitingBannerText}>
              The task has been rescheduled. Please wait for your manager to arrange and assign a new task.
            </Text>
          </View>
        </View>
      ) : effectiveStatus === "checked_in" ? (
        <View style={styles.bottomActionWrapper}>
          <TouchableOpacity
            style={[
              styles.bottomActionButton,
              statusLoading && styles.bottomActionButtonDisabled,
            ]}
            onPress={handleStartProcessing}
            disabled={statusLoading}
            activeOpacity={0.85}
          >
            {statusLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="play-outline" size={16} color={Colors.white} />
                <Text style={styles.bottomActionText}>Processing</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : effectiveStatus === "in_progress" ? (
        <View style={styles.bottomActionWrapper}>
          <View style={styles.dualBottomRow}>
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                styles.dualBottomBtn,
                statusLoading && styles.bottomActionButtonDisabled,
              ]}
              onPress={handlePrimaryAction}
              disabled={statusLoading}
              activeOpacity={0.85}
            >
              {statusLoading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons
                    name="alert-circle-outline"
                    size={16}
                    color={Colors.white}
                  />
                  <Text style={styles.bottomActionText}>
                    {getActionLabel(effectiveStatus)}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelActionButton,
                styles.dualBottomBtn,
                statusLoading && styles.bottomActionButtonDisabled,
              ]}
              onPress={() => setCancelModalVisible(true)}
              disabled={statusLoading}
              activeOpacity={0.85}
            >
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={Colors.white}
              />
              <Text style={styles.cancelActionText}>Cancelled</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : !!primaryNextStatus ? (
        <View style={styles.bottomActionWrapper}>
          <TouchableOpacity
            style={[
              styles.bottomActionButton,
              statusLoading && styles.bottomActionButtonDisabled,
            ]}
            onPress={handlePrimaryAction}
            disabled={statusLoading}
            activeOpacity={0.85}
          >
            {statusLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={Colors.white}
                />
                <Text style={styles.bottomActionText}>
                  {getActionLabel(effectiveStatus)}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cancel order</Text>
            <Text style={styles.modalSubTitle}>
              Enter the reason for canceling the order.
            </Text>

            <TextInput
              value={forcedCancelNote}
              onChangeText={setForcedCancelNote}
              placeholder="Example: Called 3 times and no one answered..."
              placeholderTextColor={Colors.gray400}
              style={styles.modalInput}
              multiline
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setCancelModalVisible(false)}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                <Text style={styles.modalSecondaryText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDangerBtn,
                  statusLoading && styles.bottomActionButtonDisabled,
                ]}
                onPress={submitForcedCancel}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                {statusLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalDangerText}>Confirm </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRescheduleModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Reschedule</Text>
            <Text style={styles.modalSubTitleCompact}>
              New date and time — sent as ISO to the server.
            </Text>

            <View style={styles.rescheduleDatetimeRow}>
              <View style={styles.rescheduleField}>
                <Text style={styles.rescheduleFieldLabel}>Date</Text>
                <TextInput
                  value={rescheduleDatePart}
                  onChangeText={setRescheduleDatePart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.gray400}
                  style={styles.modalInputSingle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <View style={styles.rescheduleField}>
                <Text style={styles.rescheduleFieldLabel}>Time (UTC)</Text>
                <TextInput
                  value={rescheduleTimePart}
                  onChangeText={setRescheduleTimePart}
                  placeholder="HH:mm (UTC)"
                  placeholderTextColor={Colors.gray400}
                  style={styles.modalInputSingle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text
              style={[styles.rescheduleFieldLabel, styles.rescheduleReasonLabel]}
            >
              Reason
            </Text>
            <TextInput
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              placeholder=""
              placeholderTextColor={Colors.gray400}
              style={[styles.modalInputSingle, styles.modalReasonInput]}
              multiline
            />

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setRescheduleModalVisible(false)}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                <Text style={styles.modalSecondaryText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.bottomActionButton,
                  statusLoading && styles.bottomActionButtonDisabled,
                ]}
                onPress={handleSubmitReschedule}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                {statusLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalDangerText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={completeEvidenceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteEvidenceModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete (COD)</Text>
            <Text style={styles.modalSubTitleCompact}>
              Add a payment proof URL or capture a payment photo — same step as
              confirming payment.
            </Text>

            <TouchableOpacity
              style={styles.codCameraRow}
              onPress={() => {
                setCompleteEvidenceModalVisible(false);
                handleOpenPhotoUpload("payment", {
                  openCameraImmediately: true,
                });
              }}
              activeOpacity={0.85}
              disabled={statusLoading}
            >
              <Ionicons
                name="camera-outline"
                size={22}
                color={Colors.primary700}
              />
              <Text style={styles.codCameraRowText}>Take payment photo</Text>
            </TouchableOpacity>

            {/* <Text style={styles.modalFieldLabelMuted}>Evidence URL</Text>
            <TextInput
              value={completeEvidenceUrl}
              onChangeText={setCompleteEvidenceUrl}
              placeholder="Evidence URL"
              placeholderTextColor={Colors.gray400}
              style={[styles.modalInput, styles.modalCodUrlInput]}
              autoCapitalize="none"
              autoCorrect={false}
            /> */}

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => setCompleteEvidenceModalVisible(false)}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                <Text style={styles.modalSecondaryText}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.bottomActionButton,
                  statusLoading && styles.bottomActionButtonDisabled,
                ]}
                onPress={submitCompleteWithEvidence}
                activeOpacity={0.85}
                disabled={statusLoading}
              >
                {statusLoading ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <Text style={styles.modalDangerText}>Complete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={viewerVisible} transparent animationType="fade">
        <View style={styles.viewerBackdrop}>
          <TouchableOpacity
            style={styles.viewerCloseBtn}
            onPress={() => setViewerVisible(false)}
            activeOpacity={0.9}
          >
            <Ionicons name="close-circle" size={40} color={Colors.white} />
          </TouchableOpacity>

          {currentImage ? (
            <Image
              source={{ uri: currentImage }}
              style={styles.viewerFullImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getActionLabel(status: TaskStatus): string {
  switch (status) {
    case "reschedule":
      return "";
    case "pending":
      return "Check-in";
    case "checked_in":
      return "Get the task / Start";
    case "in_progress":
      return "Check-out";
    case "checked_out":
      return "Complete";
    default:
      return "";
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Prefill reschedule fields from appointment raw ISO or due date / time */
function splitAppointmentForRescheduleInput(task: Task): {
  date: string;
  time: string;
} {
  const raw = String(task.appointmentDateRaw ?? "").trim();
  if (raw) {
    const d = parseDate(raw);
    if (d) {
      return {
        date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        // `raw` is typically ISO UTC (`...Z`). Prefill input in UTC to match BE storage.
        time: `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`,
      };
    }
  }

  const due = String(task.dueDate ?? "").trim();
  const dueTimeRaw = String(task.dueTime ?? "").trim();
  const timeFromDue =
    /^\d{2}:\d{2}$/.test(dueTimeRaw) ? dueTimeRaw : "09:00";

  if (!due) {
    return { date: "", time: "" };
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(due)) {
    const datePart =
      due.length >= 10 && /^\d{4}-\d{2}-\d{2}$/.test(due.slice(0, 10))
        ? due.slice(0, 10)
        : null;
    if (datePart) {
      return { date: datePart, time: timeFromDue };
    }
  }

  const dDue = parseDate(due);
  if (!dDue) {
    return { date: "", time: timeFromDue };
  }

  return {
    date: `${dDue.getFullYear()}-${pad2(dDue.getMonth() + 1)}-${pad2(dDue.getDate())}`,
    time: timeFromDue,
  };
}

function formatTaskTime(value?: string | null): string {
  if (!value) return "--:--";
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  return formatTime(value);
}

function formatSchedule(dueDate?: string) {
  return dueDate ? formatDate(dueDate) : "--/--/----";
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "-";
  return `${new Intl.NumberFormat("en-US").format(value)} VND`;
}

function formatDuration(value?: number) {
  if (!value) return "-";
  return `${value} minutes`;
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
    alignItems: "center",
    justifyContent: "space-between",
  },
  taskCode: {
    color: Colors.primary100,
    fontSize: Typography.sm,
    fontWeight: "600",
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
  infoTextMutedSmall: {
    marginTop: 6,
    color: Colors.gray600,
    fontSize: Typography.sm,
    lineHeight: 18,
    fontWeight: "500",
  },
  linkText: {
    color: Colors.primary500,
  },
  rescheduleAppointmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    backgroundColor: "#E8F1FA",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  rescheduleAppointmentButtonText: {
    color: "#163667",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  rescheduleAwaitingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: Spacing.base,
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  rescheduleAwaitingBannerText: {
    flex: 1,
    color: "#78350F",
    fontSize: Typography.md,
    lineHeight: 22,
    fontWeight: "600",
  },
  photoActionsDisabledHint: {
    marginBottom: Spacing.sm,
    color: Colors.gray600,
    fontSize: Typography.sm,
    lineHeight: 18,
    fontWeight: "500",
  },
  descriptionText: {
    color: "#24364F",
    fontSize: Typography.md,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tagItem: {
    backgroundColor: "#B9DEF0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    color: "#2A506B",
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  packageName: {
    fontSize: Typography.lg,
    fontWeight: "700",
    color: "#1F3C65",
    marginBottom: 10,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 8,
  },
  serviceLabel: {
    minWidth: 92,
    fontSize: Typography.base,
    color: "#49658A",
    fontWeight: "600",
  },
  serviceValue: {
    flex: 1,
    fontSize: Typography.base,
    color: "#24364F",
    lineHeight: 21,
  },
  serviceBlock: {
    marginTop: 8,
  },
  serviceBlockText: {
    marginTop: 4,
    color: "#24364F",
    fontSize: Typography.base,
    lineHeight: 22,
  },
  serviceBullet: {
    color: "#24364F",
    fontSize: Typography.base,
    lineHeight: 22,
  },
  serviceImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: "#E2E8F0",
  },
  checkRow: {
    flexDirection: "row",
    gap: 10,
  },
  checkButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  checkInButton: {
    backgroundColor: "#163667",
  },
  checkOutButton: {
    backgroundColor: "#7E8CA3",
  },
  checkButtonDisabled: {
    opacity: 0.65,
  },
  checkButtonText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  photoSection: {
    marginTop: 4,
  },
  photoSectionBottom: {
    marginTop: Spacing.base,
  },
  photoActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: Spacing.sm,
  },
  photoActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 100,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#B9CDE2",
    backgroundColor: "#ECF4FC",
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  uploadLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  },
  photoPlaceholder: {
    width: 74,
    height: 74,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#F3F6FB",
  },
  photoImage: {
    width: "100%",
    height: "100%",
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
  photoReminderText: {
    color: "#0284C7",
    fontSize: Typography.base,
    fontWeight: "500",
    flex: 1,
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
  bottomActionButtonDisabled: {
    opacity: 0.7,
  },
  bottomActionText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  dualBottomRow: {
    flexDirection: "row",
    gap: 10,
  },
  dualBottomBtn: {
    flex: 1,
  },
  cancelActionButton: {
    backgroundColor: "#B91C1C",
    borderRadius: 12,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  cancelActionText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: "800",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: Spacing.base,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Shadow.base,
  },
  modalTitle: {
    color: "#1F3C65",
    fontSize: Typography.lg,
    fontWeight: "800",
  },
  modalSubTitle: {
    marginTop: 6,
    color: "#49658A",
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  modalSubTitleCompact: {
    marginTop: 4,
    marginBottom: 2,
    color: "#49658A",
    fontSize: Typography.sm,
    fontWeight: "500",
    lineHeight: 18,
  },
  codCameraRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: Spacing.base,
    backgroundColor: "#E8F1FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  codCameraRowText: {
    color: "#163667",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  modalFieldLabelMuted: {
    marginTop: Spacing.xs,
    color: "#35577F",
    fontSize: Typography.xs,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalCodUrlInput: {
    minHeight: 56,
    marginTop: 4,
  },
  rescheduleDatetimeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.sm,
  },
  rescheduleField: {
    flex: 1,
    minWidth: 0,
  },
  rescheduleFieldLabel: {
    color: "#35577F",
    fontSize: Typography.xs,
    fontWeight: "700",
    marginBottom: 4,
  },
  rescheduleReasonLabel: {
    marginTop: 8,
  },
  modalInputSingle: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: "#23364D",
    fontSize: Typography.base,
    backgroundColor: "#F8FAFD",
  },
  modalReasonInput: {
    marginTop: 6,
    minHeight: 56,
    textAlignVertical: "top",
  },
  modalActionsRowCompact: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.sm,
  },
  modalInput: {
    marginTop: Spacing.sm,
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 10,
    color: "#23364D",
    fontSize: Typography.base,
    lineHeight: 20,
    backgroundColor: "#F8FAFD",
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.base,
  },
  modalSecondaryBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7EDF4",
    borderWidth: 1,
    borderColor: "#D2DDEB",
  },
  modalSecondaryText: {
    color: "#35577F",
    fontSize: Typography.base,
    fontWeight: "700",
    width: "50%",
    textAlign: "center",
  },
  modalDangerBtn: {
    flex: 1,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#B91C1C",

  },
  modalDangerText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: "700",
    width: "50%",
    textAlign: "center",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingScoreText: {
    marginLeft: 8,
    color: "#23364D",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  ratingComment: {
    marginTop: Spacing.sm,
    color: "#23364D",
    fontSize: Typography.md,
    lineHeight: 22,
  },
  ratingDateText: {
    marginTop: 8,
    color: Colors.gray500,
    fontSize: Typography.sm,
  },
  groupedImageWrap: {
    gap: 16,
  },
  imageSectionWrap: {
    gap: 10,
  },
  imageSectionTitle: {
    color: "#1F3C65",
    fontSize: Typography.base,
    fontWeight: "700",
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: 96,
    gap: 6,
  },
  imageItem: {
    width: 96,
    height: 96,
    borderRadius: 12,
    backgroundColor: "#F3F6FB",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  imageMetaText: {
    color: Colors.gray500,
    fontSize: Typography.xs,
    lineHeight: 16,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerFullImage: {
    width: "100%",
    height: "80%",
  },
  viewerCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { Rating, TaskStatus } from "../../types";
import { useTask } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { getRatingsByStaffId } from "../../utils/api";
import { formatVietnamAddress } from "../../utils/address";
import { formatDate, formatTime } from "../../utils/date";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

const STATUS_TEXT: Record<TaskStatus, string> = {
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

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = {
  pending: ["checked_in"],
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

function getNextStatuses(status: TaskStatus, taskType?: string): TaskStatus[] {
  if (taskType === "cleaning" && status === "checked_out") {
    return [];
  }
  return NEXT_STATUSES[status] || [];
}

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

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const { user } = useAuth();
  const canViewTaskRating = user?.role === "cleaner";
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
      getTaskById(taskId, { forceRefresh: true }).catch(() => undefined);
    }, [getTaskById, taskId]),
  );

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

      const baseTask =
        task ||
        (taskId ? await getTaskById(taskId, { forceRefresh: true }) : null);

      if (cancelled || !baseTask) {
        if (!cancelled) setTaskRating(null);
        return;
      }

      if (baseTask.rating?.score) {
        setTaskRating({
          id: baseTask.rating.id || baseTask.id,
          score: baseTask.rating.score,
          comment: baseTask.rating.comment,
          createdAt: baseTask.rating.createdAt,
        });
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
  }, [canViewTaskRating, taskId, task, user?.id, getTaskById]);

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

  const hasCheckedIn = !!task.checkInOut?.checkIn;
  const hasCheckedOut = !!task.checkInOut?.checkOut;
  const effectiveStatus: TaskStatus =
    task.status === "pending" && hasCheckedIn
      ? "checked_in"
      : task.status === "in_progress" && hasCheckedOut
        ? "checked_out"
        : task.status;
  const nextStatuses = getNextStatuses(effectiveStatus, task.type);
  const primaryNextStatus: TaskStatus | undefined = nextStatuses[0];
  const mapping = task.servicePackageMapping;
  const packageInfo = mapping?.servicePackage;
  const productTypeInfo = mapping?.productType;

  const photoList = task.photos || [];
  const sortedPhotoList = [...photoList].sort((a, b) => {
    const aTime = new Date(a.uploadedAt || 0).getTime();
    const bTime = new Date(b.uploadedAt || 0).getTime();
    return bTime - aTime;
  });

  const dedupedSortedPhotoList = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof sortedPhotoList = [];

    for (const p of sortedPhotoList) {
      const key = String(p?.url ?? "").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...p, url: key });
    }

    return out;
  }, [sortedPhotoList]);
  const displayAddress =
    formatVietnamAddress(task.customer.address) || "No address available";

  const getEvidenceUrlsFor = useCallback(
    (kind: "checkin" | "checkout") => {
      const allUrls = (dedupedSortedPhotoList || [])
        .map((p) => String(p?.url ?? "").trim())
        .filter(Boolean);

      const preferredType = kind === "checkin" ? "before" : "after";
      const preferred = (dedupedSortedPhotoList || [])
        .filter((p) => p?.type === preferredType)
        .map((p) => String(p?.url ?? "").trim())
        .filter(Boolean);

      const merged = preferred.length ? preferred : allUrls;
      // Keep payload small but sufficient.
      return Array.from(new Set(merged)).slice(0, 5);
    },
    [dedupedSortedPhotoList],
  );

  const handlePrimaryAction = async () => {
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
        const evidenceUrls = getEvidenceUrlsFor("checkin");
        if (!evidenceUrls.length) {
          Alert.alert(
            "No images",
            "Please upload your photos in the Images section before Check-in.",
          );
          return;
        }
        await checkInWithEvidence(task.id, evidenceUrls);
      } else if (latestEffectiveStatus === "in_progress") {
        const evidenceUrls = getEvidenceUrlsFor("checkout");
        if (!evidenceUrls.length) {
          Alert.alert(
            "No images",
            "Please upload your photos in the Images section before Check-out.",
          );
          return;
        }
        await checkOutWithEvidence(task.id, evidenceUrls);
        setShowPhotoReminder(true);
      } else if (latestEffectiveStatus === "checked_out") {
        if (task.type !== "cleaning") {
          await completeTask(task.id);
        }
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
    try {
      setStatusLoading(true);
      await startProcessing(task.id);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Unable to start processing.");
    } finally {
      setStatusLoading(false);
    }
  }, [startProcessing, task.id]);

  const submitForcedCancel = useCallback(async () => {
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
  }, [forcedCancel, forcedCancelNote, task.id]);
  const handleOpenPhotoUpload = (type: "before" | "after") => {
    navigation.navigate("PhotoUpload", {
      shippingTaskId: task.id,
      photoType: type,
    });
  };

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
                    STATUS_COLORS[task.status]?.bg || Colors.gray300,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: STATUS_COLORS[task.status]?.text || Colors.gray800 },
                ]}
              >
                {STATUS_TEXT[task.status]}
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

          {/* Evidence upload is handled in the Images section. */}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>IMAGES</Text>

          <View style={styles.photoHeaderRow}>
            <Text style={styles.photoLabel}>
              All Photos ({dedupedSortedPhotoList.length})
            </Text>
          </View>

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

          <View style={styles.photoGrid}>
            {dedupedSortedPhotoList.length ? (
              dedupedSortedPhotoList.map((photo, index) => (
                <View key={`${photo.id}_${index}`} style={styles.photoItem}>
                  <Image
                    source={{ uri: photo.url }}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                </View>
              ))
            ) : (
              <TouchableOpacity
                style={styles.photoPlaceholder}
                onPress={() => handleOpenPhotoUpload("before")}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={Colors.gray400}
                />
              </TouchableOpacity>
            )}
          </View>

          {showPhotoReminder &&
            !photoList.some((photo) => photo.type === "after") && (
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

      {effectiveStatus === "checked_in" ? (
        <View style={styles.bottomActionWrapper}>
          <View style={styles.dualBottomRow}>
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                styles.dualBottomBtn,
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
    </SafeAreaView>
  );
}

function getActionLabel(status: TaskStatus): string {
  switch (status) {
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
  linkText: {
    color: Colors.primary500,
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
    gap: 8,
    marginBottom: Spacing.sm,
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
    fontWeight: "800",
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
});

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
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../constants/theme";
import { TaskStackParamList } from "../../types/navigation";
import { TaskStatus } from "../../types";
import { useTask } from "../../context/TaskContext";
import { formatVietnamAddress } from "../../utils/address";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

const STATUS_TEXT: Record<TaskStatus, string> = {
  pending: "Awaiting processing",
  checked_in: "Checked In",
  in_progress: "In Progress",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = {
  pending: ["checked_in"],
  checked_in: ["in_progress"],
  in_progress: ["checked_out"],
  on_hold: ["in_progress"],
  checked_out: ["completed"],
  completed: [],
  cancelled: [],
};

const STATUS_COLORS: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: "#F8B84A", text: "#1E293B" },
  checked_in: { bg: "#A3C4F3", text: "#1A3A6C" },
  in_progress: { bg: "#79A8E8", text: Colors.white },
  checked_out: { bg: "#A7D4FF", text: "#0F2854" },
  completed: { bg: "#7BCB8F", text: Colors.white },
  cancelled: { bg: "#E48787", text: Colors.white },
  on_hold: { bg: "#A6B1C6", text: Colors.white },
};

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;
  const {
    tasks,
    getTaskById,
    checkIn,
    startProcessing,
    checkOut,
    completeTask,
  } = useTask();

  const task = useMemo(
    () => tasks.find((item) => item.id === taskId),
    [tasks, taskId],
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  useEffect(() => {
  let mounted = true;

  const loadTaskDetail = async () => {
    if (task) {
      // console.log("DETAIL STATUS (FROM LIST):", task.status);
      return;
    }

    try {
      setDetailLoading(true);
      const detail = await getTaskById(taskId);

      // console.log("DETAIL STATUS (FROM API):", detail?.status);

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
      getTaskById(taskId, { forceRefresh: true }).catch(() => undefined);
    }, [getTaskById, taskId]),
  );

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
  const nextStatuses = NEXT_STATUSES[effectiveStatus] || [];
  const primaryNextStatus: TaskStatus | undefined = nextStatuses[0];
  const mapping = task.servicePackageMapping;
  const packageInfo = mapping?.servicePackage;
  const productTypeInfo = mapping?.productType;

  const photoList = task.photos || [];
  const explicitBeforePhoto = photoList.find((p) => p.type === "before");
  const explicitAfterPhoto = photoList.find((p) => p.type === "after");
  const beforePhoto = explicitBeforePhoto || photoList[0];
  const afterPhoto =
    explicitAfterPhoto ||
    photoList.find((p) => p.id !== (beforePhoto?.id || ""));
  const displayAddress =
    formatVietnamAddress(task.customer.address) || "No address available";

  // Handle primary action based on current status flow:
  // pending → checkIn (CheckedIn) → startProcessing (Processing) → checkOut (CheckedOut) → completeTask (Completed)
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
        await checkIn(task.id);
      } else if (latestEffectiveStatus === "checked_in") {
        await startProcessing(task.id);
      } else if (latestEffectiveStatus === "in_progress") {
        await checkOut(task.id);
      } else if (latestEffectiveStatus === "checked_out") {
        await completeTask(task.id);
      }
    } catch (error) {
      const msg = (error as any)?.message || "Unable to update status.";
      Alert.alert("Error", msg);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleOpenPhotoUpload = (type: "before" | "after") => {
    navigation.navigate("PhotoUpload", { taskId: task.id, photoType: type });
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
            <Text style={styles.taskCode}>{task.taskCode}</Text>
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
            <Text style={styles.infoText}>
              {displayAddress}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color={Colors.primary500} />
            <Text style={styles.infoText}>
              {formatSchedule(task.dueDate, task.dueTime)}
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
                {formatDuration(mapping?.duration ?? packageInfo?.duration)}
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

            {!!packageInfo?.benefits && (
              <View style={styles.serviceBlock}>
                <Text style={styles.serviceLabel}>Benefits</Text>
                {packageInfo.benefits.split("\n").map((line, idx) => (
                  <Text key={`benefit_${idx}`} style={styles.serviceBullet}>
                    • {line.trim()}
                  </Text>
                ))}
              </View>
            )}

            {!!packageInfo?.imageUrl && (
              <View style={styles.serviceBlock}>
                <Text style={styles.serviceLabel}>Service Package Image</Text>
                <Image
                  source={{ uri: packageInfo.imageUrl }}
                  style={styles.serviceImage}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>CHECK-IN / CHECK-OUT</Text>

          {task.checkInOut?.checkIn && (
            <Text style={styles.infoText}>
              Check-in: {task.checkInOut.checkIn.time}
            </Text>
          )}

          {task.checkInOut?.checkOut && (
            <Text style={styles.infoText}>
              Check-out: {task.checkInOut.checkOut.time}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>IMAGES</Text>

          <View style={styles.photoSection}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.photoLabel}>Before Photo</Text>
              <TouchableOpacity
                onPress={() => handleOpenPhotoUpload("before")}
                activeOpacity={0.8}
              >
                <View style={styles.uploadLinkRow}>
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={Colors.primary500}
                  />
                  <Text style={styles.uploadLinkText}>Take Photo</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.photoPlaceholder}
              onPress={() => handleOpenPhotoUpload("before")}
              activeOpacity={0.8}
            >
              {beforePhoto ? (
                <Image
                  source={{ uri: beforePhoto.url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={Colors.gray400}
                />
              )}
            </TouchableOpacity>
          </View>

          <View style={[styles.photoSection, styles.photoSectionBottom]}>
            <View style={styles.photoHeaderRow}>
              <Text style={styles.photoLabel}>After Photo</Text>
              <TouchableOpacity
                onPress={() => handleOpenPhotoUpload("after")}
                activeOpacity={0.8}
              >
                <View style={styles.uploadLinkRow}>
                  <Ionicons
                    name="camera-outline"
                    size={16}
                    color={Colors.primary500}
                  />
                  <Text style={styles.uploadLinkText}>Take Photo</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.photoPlaceholder}
              onPress={() => handleOpenPhotoUpload("after")}
              activeOpacity={0.8}
            >
              {afterPhoto ? (
                <Image
                  source={{ uri: afterPhoto.url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <Ionicons
                  name="camera-outline"
                  size={24}
                  color={Colors.gray400}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {!!primaryNextStatus && (
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
      )}
    </SafeAreaView>
  );
}

function getActionLabel(status: TaskStatus): string {
  switch (status) {
    case "pending":
      return "Check-in";
    case "checked_in":
      return "Nh\u1eadn vi\u1ec7c / B\u1eaft \u0111\u1ea7u";
    case "in_progress":
      return "Check-out";
    case "checked_out":
      return "Ho\u00e0n th\u00e0nh";
    default:
      return "";
  }
}

function formatSchedule(dueDate?: string, dueTime?: string) {
  const dateText = dueDate || "--/--/----";
  const timeText = dueTime || "--:--";
  return `${dateText} · ${timeText}`;
}

function formatCurrency(value?: number) {
  if (!value) return "-";
  return `${value.toLocaleString("vi-VN")} VND`;
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
});

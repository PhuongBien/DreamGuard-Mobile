import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useAuth } from "../../context/AuthContext";
import { TaskStatus, ShippingTask } from "../../types";
import { TaskStackParamList } from "../../types/navigation";
import { Colors, Shadow, Spacing, Typography } from "../../constants/theme";
import { formatDate, formatTime } from "../../utils/date";
import {
  fetchShippingTasks,
  fetchOrderById,
  fetchTradeInOrderById,
} from "../../utils/api";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskList">;

const DELIVERY_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Awaiting processing",
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

const STATUS_BADGES: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: "#FDECC8", text: "#CC8A06" },
  reschedule: { bg: "#EDE9FE", text: "#6D28D9" },
  checked_in: { bg: "#DBE9FA", text: "#1A5294" },
  in_progress: { bg: "#DCE9FA", text: "#4D79B8" },
  checked_out: { bg: "#D8EEF9", text: "#2F7D9F" },
  completed: { bg: "#DDF4E6", text: "#2C8B52" },
  cancelled: { bg: "#FCE2E2", text: "#B43B3B" },
  on_hold: { bg: "#ECEEF2", text: "#66748A" },
  delivering: { bg: "#DBEAFE", text: "#1D4ED8" },
  arrived: { bg: "#E0F2FE", text: "#0369A1" },
  delivered: { bg: "#DCFCE7", text: "#166534" },
  returned: { bg: "#FEE2E2", text: "#B91C1C" },
  exchange_requested: { bg: "#ECEEF2", text: "#66748A" },
};

type MainFilter = "all" | "pending" | "delivering" | "completed" | "returned";

const MAIN_FILTERS: Array<{
  value: MainFilter;
  label: string;
  hasSub?: boolean;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "delivering", label: "Shipping ▾", hasSub: true },
  { value: "completed", label: "Done" },
  { value: "returned", label: "Returned" },
];

const SUB_FILTERS: Record<
  "delivering",
  Array<{ value: TaskStatus; label: string }>
> = {
  delivering: [
    { value: "delivering", label: "Delivering" },
    { value: "arrived", label: "Arrived" },
  ],
};

const GROUP_STATUS_MAP: Record<MainFilter, TaskStatus[]> = {
  all: [
    "pending",
    "reschedule",
    "delivering",
    "arrived",
    "delivered",
    "returned",
    "exchange_requested",
  ],
  pending: ["pending"],
  delivering: ["delivering", "arrived"],
  completed: ["delivered"],
  returned: ["returned"],
};

function getFilterLabel(filter: MainFilter, subStatus: TaskStatus | null) {
  if (subStatus) {
    switch (subStatus) {
      case "delivering":
        return "Delivering";
      case "arrived":
        return "Arrived";
      default:
        return DELIVERY_STATUS_LABELS[subStatus] || "Filtered";
    }
  }

  switch (filter) {
    case "all":
      return "All";
    case "pending":
      return "Pending";
    case "delivering":
      return "Shipping";
    case "completed":
      return "Done";
    case "returned":
      return "Returned";
    default:
      return "Filtered";
  }
}

type UIShippingTask = {
  id: string;
  shippingTaskId: string;
  status: TaskStatus;
  title: string;
  taskCode: string;
  customerName: string;
  /** Primary line item name from order / trade-in API */
  itemName?: string;
  products: { name: string }[];
  dueDate?: string;
  dueTime?: string;
  orderId?: string | null;
  tradeInOrderId?: string | null;
};

function normalizeStatus(status?: string): TaskStatus {
  const raw = String(status ?? "")
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
}

function mapShippingTaskToUI(task: ShippingTask): UIShippingTask {
  return {
    id: task.shippingTaskId,
    shippingTaskId: task.shippingTaskId,
    status: normalizeStatus(task.status),
    title: task.orderCode || `Task #${task.shippingTaskId.slice(0, 6)}`,
    taskCode: task.orderCode || task.shippingTaskId,
    customerName: "",
    products: [],
    dueDate: task.shippingDate || undefined,
    orderId: task.orderId,
    tradeInOrderId: task.tradeInOrderId,
  };
}

export default function DeliveryTaskListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<UIShippingTask[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [showAll, setShowAll] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MainFilter>("all");
  const [selectedSubStatus, setSelectedSubStatus] = useState<TaskStatus | null>(
    null,
  );
  const [openSubGroup, setOpenSubGroup] = useState<"delivering" | null>(null);

  const filteredTasks = useMemo(() => {
    if (!showAll) return tasks;

    if (selectedGroup === "all") return tasks;

    const groupStatuses = GROUP_STATUS_MAP[selectedGroup];
    const statuses = selectedSubStatus ? [selectedSubStatus] : groupStatuses;

    return tasks.filter((t) => statuses.includes(t.status));
  }, [tasks, showAll, selectedGroup, selectedSubStatus]);

  const orderedTasks = useMemo(() => {
    const copy = [...filteredTasks];

    copy.sort((a, b) => {
      const aTime = toTimestamp(a.dueDate, a.dueTime);
      const bTime = toTimestamp(b.dueDate, b.dueTime);
      return bTime - aTime;
    });

    return copy;
  }, [filteredTasks]);

  const visibleTasks = showAll ? orderedTasks : orderedTasks.slice(0, 3);
  const displayTasks = visibleTasks;

  const stats = useMemo(
    () => ({
      total: tasks.length,
      done: tasks.filter((t) => t.status === "delivered").length,
      doing: tasks.filter((t) => ["delivering", "arrived"].includes(t.status))
        .length,
    }),
    [tasks],
  );

  const loadTasks = useCallback(async () => {
    const res = await fetchShippingTasks({});
    if (res.success) {
      const rawTasks = res.data?.items ?? [];
      const enrichedTasks = await Promise.all(
        rawTasks.map(async (task) => {
          const base = mapShippingTaskToUI(task);
          try {
            const orderRes = task.orderId
              ? await fetchOrderById(task.orderId)
              : null;
            const tradeRes = task.tradeInOrderId
              ? await fetchTradeInOrderById(task.tradeInOrderId)
              : null;
            const data = orderRes?.data || tradeRes?.data;

            if (data) {
              const isExchange = data.shippingStatus === "ExchangeRequested";
              const fromItems = Array.isArray(data.items)
                ? data.items
                    .map((i: { itemName?: string; name?: string }) =>
                      String(i?.itemName ?? i?.name ?? "").trim(),
                    )
                    .filter(Boolean)
                : [];
              const orderItemName = String(
                data.orderItem?.itemName ?? data.orderItem?.name ?? "",
              ).trim();
              const itemName =
                orderItemName || fromItems[0] || undefined;
              const products =
                fromItems.length > 0
                  ? fromItems.map((name: string) => ({ name }))
                  : orderItemName
                    ? [{ name: orderItemName }]
                    : [];
              return {
                ...base,
                customerName: data.receiverName ?? "",
                itemName,
                products,
                dueDate: isExchange ? data.updatedAt : data.createdAt,
                dueTime: (isExchange ? data.updatedAt : data.createdAt)
                  ? new Date(isExchange ? data.updatedAt : data.createdAt)
                      .toISOString()
                      .slice(11, 16)
                  : undefined,
              };
            }
            return base;
          } catch {
            return base;
          }
        }),
      );
      setTasks(enrichedTasks);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, [loadTasks]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const renderTask = ({ item }: { item: UIShippingTask }) => {
    const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
    const priorityDot =
      item.status === "returned" ? "#E54848" : "#E9A522";
    const displayRecipient =
      item.customerName?.trim() || "No address available";
    const productLine = formatItemProductLine(item);

    return (
      <TouchableOpacity
        style={styles.taskCard}
        activeOpacity={0.86}
        onPress={() => {
          if (item.tradeInOrderId) {
            navigation.navigate("TradeInDetail", {
              tradeInOrderId: item.tradeInOrderId,
              shippingTaskId: item.shippingTaskId,
            });
          } else {
            navigation.navigate("TaskDetail", {
              taskId: item.id,
              shippingTaskId: item.shippingTaskId,
              type: "task",
            });
          }
        }}
      >
        <View style={styles.taskTopRow}>
          <View style={styles.typeRow}>
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={16}
              color={Colors.primary500}
            />
            <Text numberOfLines={1} style={styles.typeLabel}>
              Delivery
            </Text>
            <View
              style={[styles.priorityDot, { backgroundColor: priorityDot }]}
            />
          </View>

          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text
              numberOfLines={1}
              style={[styles.statusBadgeText, { color: badge.text }]}
            >
              {DELIVERY_STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>
          {item.title}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={Colors.primary700}
          />
          <Text style={styles.metaText} numberOfLines={1}>
            {displayRecipient}
          </Text>
        </View>

        {productLine ? (
          <View style={styles.metaRowProducts}>
            <Ionicons name="cube-outline" size={14} color={Colors.primary700} />
            <Text style={styles.metaText} numberOfLines={2}>
              {productLine}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRowBottom}>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={14} color={Colors.primary700} />
            <Text style={styles.metaText}>
              {formatDateTimeDisplay(item.dueDate, item.dueTime)}
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={18}
            color={Colors.primary700}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary700} />

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Delivery Staff</Text>
        <Text style={styles.heroTitle}>
          {user?.name || user?.fullName || "Staff"}
        </Text>
        <Text style={styles.heroSubTitle}>
          View assigned tasks, check details, and update delivery status.
        </Text>

        <View style={styles.statRow}>
          <StatCard label="Total Tasks" value={stats.total} />
          <StatCard label="Completed" value={stats.done} />
          <StatCard label="In Progress" value={stats.doing} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
          <Text style={styles.sectionSubTitle}>
            {showAll
              ? `${getFilterLabel(selectedGroup, selectedSubStatus)} · ${orderedTasks.length}`
              : `Showing ${visibleTasks.length} tasks`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (showAll) {
              setSelectedGroup("all");
              setSelectedSubStatus(null);
              setOpenSubGroup(null);
            }
            setShowAll((prev) => !prev);
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionAction}>
            {showAll ? "Collapse" : "See all"}
          </Text>
        </TouchableOpacity>
      </View>

      {showAll && (
        <View style={styles.filterBarWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {MAIN_FILTERS.map((option) => {
              const active = selectedGroup === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (option.hasSub) {
                      const nextOpen =
                        openSubGroup === option.value ? null : option.value;
                      setOpenSubGroup(nextOpen as "delivering" | null);
                      setSelectedGroup(option.value);
                      if (nextOpen !== option.value) {
                        setSelectedSubStatus(null);
                      }
                    } else {
                      setSelectedGroup(option.value);
                      setSelectedSubStatus(null);
                      setOpenSubGroup(null);
                    }
                  }}
                >
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.filterChipText,
                      active && styles.filterChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {openSubGroup === "delivering" && (
            <View style={styles.subFilterBarWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContainer}
              >
                {SUB_FILTERS.delivering.map((option) => {
                  const active = selectedSubStatus === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.subFilterChip,
                        active && styles.filterChipActive,
                      ]}
                      activeOpacity={0.85}
                      onPress={() => {
                        setSelectedGroup("delivering");
                        setSelectedSubStatus(option.value);
                      }}
                    >
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={[
                          styles.filterChipText,
                          active && styles.filterChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      <FlatList
        data={displayTasks}
        keyExtractor={(item) => item.shippingTaskId}
        renderItem={renderTask}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary700]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons
              name="clipboard-outline"
              size={36}
              color={Colors.gray400}
            />
            <Text style={styles.emptyTitle}>No jobs available.</Text>
            <Text style={styles.emptySubTitle}>
              Pull down to refresh the list.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function toTimestamp(date?: string, time?: string) {
  if (!date) return 0;
  const safeTime =
    time && /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : "23:59:00";
  const parsed = new Date(`${date}T${safeTime}`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDateTimeDisplay(dateText?: string, timeText?: string) {
  if (!dateText) return "--/--/----";
  const date = formatDate(dateText);
  if (timeText && /^\d{2}:\d{2}$/.test(timeText)) {
    return `${date} • ${timeText}`;
  }
  if (timeText) {
    return `${date} • ${formatTime(timeText)}`;
  }
  return date;
}

function formatItemProductLine(task: UIShippingTask): string | null {
  const labels = new Set<string>();
  if (task.itemName?.trim()) labels.add(task.itemName.trim());
  for (const p of task.products ?? []) {
    const n = p.name?.trim();
    if (n) labels.add(n);
  }
  return labels.size > 0 ? [...labels].join(", ") : null;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF2F6",
  },
  hero: {
    backgroundColor: Colors.primary900,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    ...Shadow.base,
  },
  heroEyebrow: {
    color: Colors.primary100,
    fontSize: Typography.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    marginTop: 6,
    color: Colors.white,
    fontSize: Typography["2xl"],
    fontWeight: "700",
  },
  heroSubTitle: {
    marginTop: 8,
    color: "#D8E7FA",
    fontSize: Typography.base,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: Spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  statValue: {
    color: Colors.white,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  statLabel: {
    marginTop: 4,
    color: Colors.primary100,
    fontSize: Typography.sm,
  },
  sectionHeader: {
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.base,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: "#122B52",
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  sectionSubTitle: {
    marginTop: 2,
    color: "#4C668A",
    fontSize: Typography.xs,
    fontWeight: "400",
  },
  sectionAction: {
    color: Colors.primary500,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  filterBarWrap: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  filterContainer: {
    paddingHorizontal: 2,
    paddingVertical: 9,
    alignItems: "center",
  },
  filterChip: {
    height: 36,
    minHeight: 36,
    maxHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#E7EDF4",
    borderWidth: 1,
    borderColor: "#D2DDEB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    alignSelf: "center",
  },
  subFilterBarWrap: {
    marginTop: -3,
    marginLeft: 10,
    marginRight: Spacing.base,
    borderRadius: 999,
    paddingVertical: 6,
  },
  subFilterChip: {
    height: 32,
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#F3F7FD",
    borderWidth: 1,
    borderColor: "#D2DDEB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    alignSelf: "center",
  },
  filterChipActive: {
    backgroundColor: Colors.primary700,
    borderColor: Colors.primary700,
  },
  filterChipText: {
    color: "#35577F",
    fontSize: Typography.sm,
    fontWeight: "600",
    lineHeight: 18,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: 2,
    paddingBottom: Spacing.xl,
  },
  taskCard: {
    backgroundColor: "#F9FBFD",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE4ED",
    padding: Spacing.base,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeLabel: {
    color: "#31527B",
    fontSize: Typography.sm,
    fontWeight: "500",
    maxWidth: 150,
    flexShrink: 1,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: "45%",
    alignItems: "center",
  },
  statusBadgeText: {
    fontSize: Typography.xs,
    fontWeight: "600",
    lineHeight: 14,
  },
  taskTitle: {
    color: "#1F3C65",
    fontSize: Typography.lg,
    fontWeight: "600",
    marginTop: 10,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaRowProducts: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  metaRowBottom: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    color: "#3A5C8F",
    fontSize: Typography.sm,
    fontWeight: "500",
    flexShrink: 1,
  },
  emptyWrap: {
    marginTop: 44,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 8,
    color: Colors.gray700,
    fontSize: Typography.md,
    fontWeight: "600",
  },
  emptySubTitle: {
    marginTop: 4,
    color: Colors.gray500,
    fontSize: Typography.base,
  },
});

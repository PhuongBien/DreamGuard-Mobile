import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import { TaskStackParamList } from "../../types/navigation";
import { Task, TaskFilter, TaskStatus } from "../../types";
import {
  Colors,
  Typography,
  Spacing,
  Shadow,
  TaskTypeConfig,
} from "../../constants/theme";
import { useTask } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { formatVietnamAddress } from "../../utils/address";
import { formatDate, formatTime } from "../../utils/date";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskList">;

const STATUS_LABELS: Record<TaskStatus, string> = {
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

type MainFilter = "all" | "pending" | "active" | "completed" | "cancelled";

const MAIN_FILTERS: Array<{
  value: MainFilter;
  label: string;
  hasSub?: boolean;
}> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending ▾", hasSub: true },
  { value: "active", label: "Active ▾", hasSub: true },
  { value: "completed", label: "Done" },
  { value: "cancelled", label: "Canceled" },
];

const SUB_FILTERS: Record<
  "pending" | "active",
  Array<{ value: TaskStatus; label: string }>
> = {
  pending: [
    { value: "pending", label: "Pending" },
    { value: "on_hold", label: "On hold" },
    { value: "reschedule", label: "Reschedule" },
  ],
  active: [
    { value: "checked_in", label: "Checked in" },
    { value: "in_progress", label: "In Progress" },
    { value: "checked_out", label: "Checked out" },
  ],
};

const GROUP_STATUS_MAP: Record<MainFilter, TaskStatus[]> = {
  all: [
    "pending",
    "reschedule",
    "delivering",
    "arrived",
    "checked_in",
    "in_progress",
    "checked_out",
    "delivered",
    "returned",
    "exchange_requested",
    "completed",
    "cancelled",
    "on_hold",
  ],
  pending: ["pending", "on_hold", "reschedule"],
  active: ["checked_in", "in_progress", "checked_out"],
  completed: ["completed"],
  cancelled: ["cancelled"],
};

function getFilterLabel(filter: MainFilter, subStatus: TaskStatus | null) {
  if (subStatus) {
    switch (subStatus) {
      case "checked_in":
        return "Checked in";
      case "in_progress":
        return "In Progress";
      case "checked_out":
        return "Checked out";
      case "on_hold":
        return "On hold";
      case "pending":
        return "Pending";
      case "reschedule":
        return "Reschedule";
      case "completed":
        return "Done";
      case "cancelled":
        return "Canceled";
      default:
        return STATUS_LABELS[subStatus] || "Filtered";
    }
  }

  switch (filter) {
    case "all":
      return "All";
    case "pending":
      return "Pending";
    case "active":
      return "Active";
    case "completed":
      return "Done";
    case "cancelled":
      return "Canceled";
    default:
      return "Filtered";
  }
}

export default function TaskListScreen({ navigation }: Props) {
  const { tasks, refreshTasks } = useTask();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<MainFilter>("all");
  const [selectedSubStatus, setSelectedSubStatus] = useState<TaskStatus | null>(
    null,
  );
  const [openSubGroup, setOpenSubGroup] = useState<"pending" | "active" | null>(
    null,
  );

  const filteredTasks = useMemo(() => {
    if (!showAll) return tasks;

    if (selectedGroup === "all") return tasks;

    const groupStatuses = GROUP_STATUS_MAP[selectedGroup];
    const statuses = selectedSubStatus ? [selectedSubStatus] : groupStatuses;

    return tasks.filter((task) => statuses.includes(task.status));
  }, [tasks, showAll, selectedGroup, selectedSubStatus]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((task) => task.status === "completed").length;
    const doing = tasks.filter((task) => task.status === "in_progress").length;
    const high = tasks.filter(
      (task) =>
        (task.priority || "medium") === "high" ||
        (task.priority || "medium") === "urgent",
    ).length;
    return { total, done, doing, high };
  }, [tasks]);

  const orderedTasks = useMemo(() => {
    const copy = [...filteredTasks];

    copy.sort((a, b) => {
      const aDate = normalizeDateTime(a.dueDate, a.dueTime).getTime();
      const bDate = normalizeDateTime(b.dueDate, b.dueTime).getTime();
      return bDate - aDate;
    });

    return copy;
  }, [filteredTasks]);

  const visibleTasks = showAll ? orderedTasks : orderedTasks.slice(0, 3);

  const displayTasks = visibleTasks;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks({ status: "all" });
    setRefreshing(false);
  }, [refreshTasks]);

  useFocusEffect(
    useCallback(() => {
      refreshTasks({ status: "all" });
    }, [refreshTasks]),
  );

  const renderTask = ({ item }: { item: Task }) => {
    const type = item.type || "cleaning";
    const typeConfig = TaskTypeConfig[type];
    const typeLabel = typeConfig?.label || type;
    const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
    const priority = item.priority || "medium";
    const displayAddress =
      formatVietnamAddress(item.customer.address) || "No address available";
    // const productLine = formatProductNames(item);

    const priorityDot =
      priority === "high" || priority === "urgent" ? "#E54848" : "#E9A522";
    return (
      <TouchableOpacity
        style={styles.taskCard}
        activeOpacity={0.86}
        onPress={() => navigation.navigate("TaskDetail", { taskId: item.id })}
      >
        <View style={styles.taskTopRow}>
          <View style={styles.typeRow}>
            <MaterialCommunityIcons
              name={iconForType(item.type || "cleaning")}
              size={16}
              color={Colors.primary500}
            />
            <Text numberOfLines={1} style={styles.typeLabel}>
              {typeLabel}
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
              {STATUS_LABELS[item.status]}
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
            {displayAddress}
          </Text>
        </View>

        {/* {productLine ? (
          <View style={styles.metaRowProducts}>
            <Ionicons
              name="cube-outline"
              size={14}
              color={Colors.primary700}
            />
            <Text style={styles.metaText} numberOfLines={2}>
              {productLine}
            </Text>
          </View>
        ) : null} */}

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
        <Text style={styles.heroEyebrow}>Cleaning Staff</Text>
        <Text style={styles.heroTitle}>
          {user?.name || user?.fullName || "Staff"}
        </Text>
        <Text style={styles.heroSubTitle}>
          View assigned tasks, check details, and update task status.
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
                      setOpenSubGroup(nextOpen as "pending" | "active" | null);
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

          {(openSubGroup === "pending" || openSubGroup === "active") && (
            <View style={styles.subFilterBarWrap}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterContainer}
              >
                {SUB_FILTERS[openSubGroup].map((option) => {
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
                        setSelectedGroup(openSubGroup);
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
        keyExtractor={(item) => item.id}
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

function normalizeDateTime(dateText?: string, timeText?: string) {
  if (!dateText) return new Date(8640000000000000);

  const safeTime =
    timeText && /^\d{2}:\d{2}$/.test(timeText) ? `${timeText}:00` : "23:59:00";
  const composed = `${dateText}T${safeTime}`;
  const parsed = new Date(composed);

  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date(dateText);
    return Number.isNaN(fallback.getTime())
      ? new Date(8640000000000000)
      : fallback;
  }

  return parsed;
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

// function formatProductNames(task: Task): string | null {
//   const labels = new Set<string>();
//   if (task.itemName?.trim()) labels.add(task.itemName.trim());
//   for (const p of task.products ?? []) {
//     const n = p.name?.trim();
//     if (n) labels.add(n);
//   }
//   if (labels.size > 0) {
//     return [...labels].join(", ");
//   }
//   const packageName = task.servicePackageMapping?.servicePackage?.packageName?.trim();
//   if (packageName) return packageName;
//   const typeName =
//     task.servicePackageMapping?.productType?.productTypeName?.trim();
//   if (typeName) return typeName;
//   return null;
// }

function getInitial(name?: string) {
  if (!name) return "N";
  const parts = name.trim().split(" ").filter(Boolean);
  const first = parts[parts.length - 1]?.[0] || "N";
  return first.toUpperCase();
}

function iconForType(
  type: Task["type"],
): keyof typeof MaterialCommunityIcons.glyphMap {
  switch (type) {
    case "cleaning":
      return "broom";
    case "delivery":
      return "package-variant-closed";
    case "trade_in":
    case "exchange":
      return "swap-horizontal";
    case "repair":
      return "tools";
    case "pickup":
      return "truck-fast-outline";
    default:
      return "briefcase-outline";
  }
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
    // borderRadius: 14,
    // borderWidth: 1,
    // borderColor: "#D7E1ED",
    // backgroundColor: "#F7FAFD",
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
    // backgroundColor: "rgba(57, 106, 213, 0.06)",
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

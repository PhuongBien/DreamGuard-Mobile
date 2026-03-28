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
  BorderRadius,
  Shadow,
  TaskTypeConfig,
} from "../../constants/theme";
import { useTask } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { formatVietnamAddress } from "../../utils/address";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskList">;

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Awaiting processing",
  checked_in: "Checked In",
  in_progress: "In Progress",
  checked_out: "Checked Out",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

const STATUS_BADGES: Record<TaskStatus, { bg: string; text: string }> = {
  pending: { bg: "#FDECC8", text: "#CC8A06" },
  checked_in: { bg: "#DBE9FA", text: "#1A5294" },
  in_progress: { bg: "#DCE9FA", text: "#4D79B8" },
  checked_out: { bg: "#D8EEF9", text: "#2F7D9F" },
  completed: { bg: "#DDF4E6", text: "#2C8B52" },
  cancelled: { bg: "#FCE2E2", text: "#B43B3B" },
  on_hold: { bg: "#ECEEF2", text: "#66748A" },
};

const STATUS_FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "checked_in", label: "Checked In" },
  { value: "in_progress", label: "Processing" },
  { value: "checked_out", label: "Checked Out" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "on_hold", label: "On Hold" },
];

export default function TaskListScreen({ navigation }: Props) {
  const { tasks, refreshTasks } = useTask();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<TaskFilter>("all");

  const myTasks = useMemo(() => {
    if (selectedStatus === "all") return tasks;
    return tasks.filter((task) => task.status === selectedStatus);
  }, [tasks, selectedStatus]);

  const stats = useMemo(() => {
    const total = myTasks.length;
    const done = myTasks.filter((task) => task.status === "completed").length;
    const doing = myTasks.filter(
      (task) => task.status === "in_progress",
    ).length;
    const high = myTasks.filter(
      (task) =>
        (task.priority || "medium") === "high" ||
        (task.priority || "medium") === "urgent",
    ).length;
    return { total, done, doing, high };
  }, [myTasks]);

  const orderedTasks = useMemo(() => {
    const copy = [...myTasks];

    copy.sort((a, b) => {
      const aDate = normalizeDateTime(a.dueDate, a.dueTime).getTime();
      const bDate = normalizeDateTime(b.dueDate, b.dueTime).getTime();
      return aDate - bDate;
    });

    return copy;
  }, [myTasks]);

  const visibleTasks = showAll ? orderedTasks : orderedTasks.slice(0, 3);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshTasks({ status: selectedStatus });
    setRefreshing(false);
  }, [refreshTasks, selectedStatus]);

  useFocusEffect(
    useCallback(() => {
      refreshTasks({ status: selectedStatus });
    }, [refreshTasks, selectedStatus]),
  );

  const renderTask = ({ item }: { item: Task }) => {
    //     console.log("ITEM:", item);
    // console.log("TYPE:", item.type);
    // console.log("TYPE CONFIG:", item.type ? TaskTypeConfig[item.type] : undefined);
    const type = item.type || "cleaning";
    const typeConfig = TaskTypeConfig[type];
    const typeLabel = typeConfig?.label || type;
    const badge = STATUS_BADGES[item.status] || STATUS_BADGES.pending;
    const priority = item.priority || "medium";
    const displayAddress =
      formatVietnamAddress(item.customer.address) || "Chưa có địa chỉ";

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
        <View style={styles.helloRow}>
          <View>
            <Text style={styles.helloText}>Hello,</Text>
            <Text style={styles.userName}>
              {user?.name || user?.fullName || user?.phoneNumber || "Employee"}
            </Text>
          </View>

          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {getInitial(user?.name || user?.fullName || user?.phoneNumber)}
            </Text>
          </View>
        </View>

        {/* <View style={styles.statsRow}>
          <StatItem
            label="Total Tasks"
            value={stats.total}
            icon="clipboard-outline"
          />
          <StatItem
            label="Completed"
            value={stats.done}
            icon="checkmark-circle-outline"
          />
          <StatItem label="In Progress" value={stats.doing} icon="time-outline" />
          <StatItem
            label="High Priority"
            value={stats.high}
            icon="alert-outline"
          />
        </View> */}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
          <Text style={styles.sectionSubTitle}>
            {selectedStatus === "all"
              ? `Showing ${orderedTasks.length} tasks`
              : `${STATUS_FILTERS.find((item) => item.value === selectedStatus)?.label || "Filtered"} · ${orderedTasks.length}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowAll((prev) => !prev)}
          activeOpacity={0.85}
        >
          <Text style={styles.sectionAction}>{showAll ? "Collapse" : "See all"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {STATUS_FILTERS.map((option) => {
            const active = selectedStatus === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.filterChip, active && styles.filterChipActive]}
                activeOpacity={0.85}
                onPress={() => {
                  setSelectedStatus(option.value);
                  setShowAll(false);
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

      <FlatList
        data={visibleTasks}
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

function StatItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon} size={16} color={Colors.gray100} />
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
  if (!dateText) return "--/--/---- · --:--";

  if (timeText && /^\d{2}:\d{2}$/.test(timeText)) {
    return `${dateText} · ${timeText}`;
  }

  const dateObj = new Date(dateText);
  if (Number.isNaN(dateObj.getTime())) {
    return `${dateText} · ${timeText || "--:--"}`;
  }

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const hhmm = timeText || "--:--";

  return `${yyyy}-${mm}-${dd} · ${hhmm}`;
}

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
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing["4xl"],
    paddingBottom: Spacing.base,
    ...Shadow.base,
  },
  helloRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.base,
  },
  helloText: {
    color: Colors.primary100,
    fontSize: Typography.md,
    marginBottom: 4,
  },
  userName: {
    color: Colors.white,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: Colors.white,
    fontWeight: "700",
    fontSize: Typography.md,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    minHeight: 74,
  },
  statValue: {
    color: Colors.white,
    fontWeight: "800",
    fontSize: 30,
    lineHeight: 34,
    marginTop: 4,
  },
  statLabel: {
    color: Colors.primary100,
    fontSize: Typography.sm,
    marginTop: 2,
    textAlign: "center",
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
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  sectionSubTitle: {
    marginTop: 2,
    color: "#4C668A",
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  sectionAction: {
    color: Colors.primary500,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  filterBarWrap: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E1ED",
    backgroundColor: "#F7FAFD",
  },
  filterContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
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
    fontSize: Typography.md,
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
    fontSize: Typography.sm,
    fontWeight: "600",
    lineHeight: 16,
  },
  taskTitle: {
    color: "#1F3C65",
    fontSize: Typography.xl,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontSize: Typography.base,
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

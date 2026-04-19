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
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useTask } from "../../context/TaskContext";
import { useAuth } from "../../context/AuthContext";
import { Task, TaskFilter, TaskStatus, TradeInOrder, TradeInOrderStatus } from "../../types";
import { TaskStackParamList } from "../../types/navigation";
import { Colors, Shadow, Spacing, Typography } from "../../constants/theme";
import { formatDate } from "../../utils/date";
import { TradeInOrderService } from "../../services/trade-in-order.service";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskList">;

const TRADEIN_STATUS_LABELS: Record<TradeInOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  processing: "Processing",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const DELIVERY_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
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
};

const DELIVERY_FILTERS: Array<{ value: TaskFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "delivering", label: "Delivering" },
  { value: "arrived", label: "Arrived" },
  { value: "delivered", label: "Delivered" },
  { value: "returned", label: "Returned" },
];

const TRADEIN_FILTERS: Array<{ value: TradeInOrderStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready_for_delivery", label: "Ready" },
  { value: "processing", label: "Processing" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
];

export default function DeliveryTaskListScreen({ navigation }: Props) {
  const { tasks, refreshTasks } = useTask();
  const { user } = useAuth();

  const [tab, setTab] = useState<"tasks" | "tradein">("tasks");
  const [selectedStatus, setSelectedStatus] = useState<TaskFilter>("all");
  const [selectedTradeInStatus, setSelectedTradeInStatus] = useState<TradeInOrderStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [tradeInOrders, setTradeInOrders] = useState<TradeInOrder[]>([]);
  const [tradeInLoading, setTradeInLoading] = useState(false);

  const orderedTasks = useMemo(() => {
    const filtered =
      selectedStatus === "all"
        ? tasks
        : tasks.filter((task) => task.status === selectedStatus);

    return [...filtered].sort((a, b) => {
      const aTime = toTimestamp(a.dueDate, a.dueTime);
      const bTime = toTimestamp(b.dueDate, b.dueTime);
      return bTime - aTime;
    });
  }, [selectedStatus, tasks]);

  const orderedTradeInOrders = useMemo(() => {
    const filtered =
      selectedTradeInStatus === "all"
        ? tradeInOrders
        : tradeInOrders.filter((order) => order.status === selectedTradeInStatus);

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [selectedTradeInStatus, tradeInOrders]);

  const stats = useMemo(
    () => ({
      total: tasks.length,
      active: tasks.filter(
        (task) => task.status === "delivering" || task.status === "arrived",
      ).length,
      done: tasks.filter((task) => task.status === "delivered").length,
    }),
    [tasks],
  );

  const tradeInStats = useMemo(
    () => ({
      total: tradeInOrders.length,
      active: tradeInOrders.filter(
        (order) => order.status === "processing" || order.status === "ready_for_delivery",
      ).length,
      done: tradeInOrders.filter((order) => order.status === "completed").length,
    }),
    [tradeInOrders],
  );

  const loadTasks = useCallback(async () => {
    await refreshTasks({ status: selectedStatus });
  }, [refreshTasks, selectedStatus]);

  const loadTradeInOrders = useCallback(async () => {
    try {
      setTradeInLoading(true);
      const { orders } = await TradeInOrderService.fetchWaitingOrders({
        status: selectedTradeInStatus === "all" ? undefined : (selectedTradeInStatus as TradeInOrderStatus),
      });
      setTradeInOrders(orders);
    } catch (error) {
      console.error("Failed to load TradeIn orders:", error);
      setTradeInOrders([]);
    } finally {
      setTradeInLoading(false);
    }
  }, [selectedTradeInStatus]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (tab === "tasks") {
        await loadTasks();
      } else {
        await loadTradeInOrders();
      }
    } finally {
      setRefreshing(false);
    }
  }, [tab, loadTasks, loadTradeInOrders]);

  useFocusEffect(
    useCallback(() => {
      if (tab === "tasks") {
        loadTasks();
      } else {
        loadTradeInOrders();
      }
    }, [tab, loadTasks, loadTradeInOrders]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>Delivery Staff</Text>
        <Text style={styles.heroTitle}>{user?.name || user?.fullName || "Staff"}</Text>
        <Text style={styles.heroSubTitle}>
          View assigned tasks, check details, and update delivery status.
        </Text>

        <View style={styles.statRow}>
          {tab === "tasks" ? (
            <>
              <StatCard label="Total Tasks" value={stats.total} />
              <StatCard label="In Progress" value={stats.active} />
              <StatCard label="Completed" value={stats.done} />
            </>
          ) : (
            <>
              <StatCard label="Total Orders" value={tradeInStats.total} />
              <StatCard label="In Progress" value={tradeInStats.active} />
              <StatCard label="Completed" value={tradeInStats.done} />
            </>
          )}
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "tasks" && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setTab("tasks")}
        >
          <MaterialCommunityIcons
            name="truck-delivery"
            size={18}
            color={tab === "tasks" ? Colors.white : Colors.primary700}
          />
          <Text style={[styles.tabText, tab === "tasks" && styles.tabTextActive]}>
            Delivery Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === "tradein" && styles.tabButtonActive]}
          activeOpacity={0.7}
          onPress={() => setTab("tradein")}
        >
          <MaterialCommunityIcons
            name="handshake"
            size={18}
            color={tab === "tradein" ? Colors.white : Colors.primary700}
          />
          <Text style={[styles.tabText, tab === "tradein" && styles.tabTextActive]}>
            Trade-In Orders
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {tab === "tasks" ? "Task List" : "Trade-In Orders"}
        </Text>
        <Text style={styles.sectionSubTitle}>
          {tab === "tasks" ? orderedTasks.length : orderedTradeInOrders.length} items
        </Text>
      </View>

      <View style={styles.filterBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {tab === "tasks"
            ? DELIVERY_FILTERS.map((filter) => {
                const active = selectedStatus === filter.value;
                return (
                  <TouchableOpacity
                    key={filter.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedStatus(filter.value)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.filterText, active && styles.filterTextActive]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })
            : TRADEIN_FILTERS.map((filter) => {
                const active = selectedTradeInStatus === filter.value;
                return (
                  <TouchableOpacity
                    key={filter.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    activeOpacity={0.85}
                    onPress={() => setSelectedTradeInStatus(filter.value)}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.filterText, active && styles.filterTextActive]}
                    >
                      {filter.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
        </ScrollView>
      </View>

      {tab === "tasks" ? (
        <FlatList
          data={orderedTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskRow
              item={item}
              statusLabel={DELIVERY_STATUS_LABELS[item.status]}
              onPress={() => navigation.navigate("TaskDetail", { taskId: item.id, type: "task" })}
            />
          )}
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
              <Ionicons name="cube-outline" size={36} color={Colors.gray400} />
              <Text style={styles.emptyTitle}>No matching tasks</Text>
              <Text style={styles.emptySubTitle}>Pull down to refresh the list.</Text>
            </View>
          }
        />
      ) : (
        <>
          {tradeInLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={Colors.primary700} />
              <Text style={styles.loadingText}>Loading Trade-In orders...</Text>
            </View>
          ) : (
            <FlatList
              data={orderedTradeInOrders}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TradeInOrderRow
                  item={item}
                  statusLabel={TRADEIN_STATUS_LABELS[item.status]}
                  onPress={() => navigation.navigate("TaskDetail", { taskId: item.id, type: "tradein" })}
                />
              )}
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
                  <MaterialCommunityIcons name="handshake-outline" size={36} color={Colors.gray400} />
                  <Text style={styles.emptyTitle}>No Trade-In orders</Text>
                  <Text style={styles.emptySubTitle}>Pull down to refresh the list.</Text>
                </View>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function TaskRow({
  item,
  statusLabel,
  onPress,
}: {
  item: Task;
  statusLabel: string;
  onPress: () => void;
}) {
  const statusStyle = getStatusStyle(item.status);
  const productLabel = (item.products || [])
    .map((product) => product.name?.trim())
    .filter(Boolean)
    .join(", ");

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.86} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.badgeRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="truck-delivery-outline"
              size={18}
              color={Colors.primary700}
            />
          </View>
          <Text style={styles.cardCode}>{item.taskCode}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}> 
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{item.title}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={16} color={Colors.primary700} />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.customer.name || "No customer available"}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="document-text-outline" size={16} color={Colors.primary700} />
        <Text style={styles.metaText} numberOfLines={1}>
          {productLabel || "No products available"}
        </Text>
      </View>

      <View style={styles.cardBottomRow}>
        <View style={styles.metaRowInline}>
          <Ionicons name="time-outline" size={16} color={Colors.primary700} />
          <Text style={styles.metaText}>{formatSchedule(item.dueDate, item.dueTime)}</Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={Colors.primary700} />
      </View>
    </TouchableOpacity>
  );
}

function TradeInOrderRow({
  item,
  statusLabel,
  onPress,
}: {
  item: TradeInOrder;
  statusLabel: string;
  onPress: () => void;
}) {
  const statusStyle = getTradeInStatusStyle(item.status);
  const deviceLabel = item.devices.oldDevice
    ? `${item.devices.oldDevice.name} → ${item.devices.newDevice?.name || "New Device"}`
    : "Trade-In Order";

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.86} onPress={onPress}>
      <View style={styles.cardTopRow}>
        <View style={styles.badgeRow}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons
              name="handshake"
              size={18}
              color={Colors.primary700}
            />
          </View>
          <Text style={styles.cardCode}>{item.orderCode}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.statusText, { color: statusStyle.text }]}>
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTitle}>{deviceLabel}</Text>

      <View style={styles.metaRow}>
        <Ionicons name="person-outline" size={16} color={Colors.primary700} />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.customer.name || "No customer available"}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={16} color={Colors.primary700} />
        <Text style={styles.metaText} numberOfLines={1}>
          {item.customer.address || "No address available"}
        </Text>
      </View>

      <View style={styles.cardBottomRow}>
        <View style={styles.metaRowInline}>
          <Ionicons name="call-outline" size={16} color={Colors.primary700} />
          <Text style={styles.metaText}>{item.customer.phone}</Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={Colors.primary700} />
      </View>
    </TouchableOpacity>
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

function getStatusStyle(status: TaskStatus) {
  switch (status) {
    case "delivering":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "arrived":
      return { bg: "#E0F2FE", text: "#0369A1" };
    case "delivered":
      return { bg: "#DCFCE7", text: "#166534" };
    case "returned":
      return { bg: "#FEE2E2", text: "#B91C1C" };
    default:
      return { bg: "#FEF3C7", text: "#92400E" };
  }
}

function getTradeInStatusStyle(status: TradeInOrderStatus) {
  switch (status) {
    case "processing":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "ready_for_delivery":
      return { bg: "#FEE2E2", text: "#B91C1C" };
    case "delivered":
      return { bg: "#E0F2FE", text: "#0369A1" };
    case "completed":
      return { bg: "#DCFCE7", text: "#166534" };
    case "cancelled":
      return { bg: "#F3F4F6", text: "#6B7280" };
    default:
      return { bg: "#FEF3C7", text: "#92400E" };
  }
}

function toTimestamp(date?: string, time?: string) {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const parsed = new Date(`${date}T${time || "23:59"}:00`);
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function formatSchedule(date?: string, time?: string) {
  if (!date) return "No delivery schedule available.";
  const dateText = formatDate(date);
  return time ? `${dateText} • ${time}` : dateText;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  hero: {
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: Colors.primary900,
    fontSize: Typography.xl,
    fontWeight: "700",
  },
  sectionSubTitle: {
    color: Colors.gray500,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  filterBarWrap: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D8E4F0",
    backgroundColor: "#F7FAFD",
  },
  filterContainer: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  filterChip: {
    minWidth: 88,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#EAF0F6",
    borderWidth: 1,
    borderColor: "#D8E4F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    alignSelf: "center",
  },
  filterChipActive: {
    backgroundColor: Colors.primary700,
    borderColor: Colors.primary700,
  },
  filterText: {
    color: Colors.primary700,
    fontSize: Typography.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing["3xl"],
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#D9E4EF",
    ...Shadow.sm,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary50,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCode: {
    color: Colors.gray500,
    fontSize: Typography.sm,
    fontWeight: "700",
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  cardTitle: {
    marginTop: 12,
    color: Colors.primary900,
    fontSize: Typography.lg,
    fontWeight: "700",
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  metaRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  metaText: {
    flex: 1,
    color: Colors.gray700,
    fontSize: Typography.base,
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyTitle: {
    marginTop: 10,
    color: Colors.gray700,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  emptySubTitle: {
    marginTop: 4,
    color: Colors.gray500,
    fontSize: Typography.base,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    backgroundColor: "#F7FAFD",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8E4F0",
    padding: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: Colors.primary700,
  },
  tabText: {
    color: Colors.primary700,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  tabTextActive: {
    color: Colors.white,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  loadingText: {
    marginTop: Spacing.base,
    color: Colors.gray600,
    fontSize: Typography.sm,
  },
});

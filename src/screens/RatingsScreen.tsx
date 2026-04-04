// KBS Staff App — Ratings Screen (Staff view of customer ratings)

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { Rating } from "../types";
import { getRatingsByStaffId } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useTask } from "../context/TaskContext";
import { TaskService } from "../services/task.service";
import { formatDate } from "../utils/date";

// ── helpers ──────────────────────────────────────────────────

const isRecord = (v: unknown): v is Record<string, any> =>
  typeof v === "object" && v !== null;

const pickFirstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toKey = (value?: string | null): string =>
  String(value || "").trim().toLowerCase();

const mergeTaskNamesIntoMap = (
  map: Map<string, string>,
  sourceTasks: Array<{
    orderRef?: string;
    taskCode?: string;
    customer?: { id?: string; name?: string };
  }>,
) => {
  sourceTasks.forEach((task) => {
    const name = task.customer?.name?.trim();
    if (!name) return;

    const keys = [
      toKey(task.orderRef),
      toKey(task.taskCode),
      toKey(task.customer?.id),
    ].filter(Boolean);

    keys.forEach((key) => {
      if (!map.has(key)) {
        map.set(key, name);
      }
    });
  });
};

const normalizeRating = (raw: unknown): Rating | null => {
  if (!isRecord(raw)) return null;

  const serviceOrder = isRecord(raw.serviceOrder) ? raw.serviceOrder : null;
  const directCustomer = isRecord(raw.customer) ? raw.customer : null;
  const nestedCustomer =
    serviceOrder && isRecord(serviceOrder.customer)
      ? serviceOrder.customer
      : serviceOrder && isRecord(serviceOrder.customerInfo)
        ? serviceOrder.customerInfo
        : null;

  const customer = directCustomer || nestedCustomer;
  const score = toNumber(raw.score ?? raw.stars ?? raw.star);

  return {
    id:
      pickFirstString(raw.id, raw.ratingId) ||
      pickFirstString(
        raw.serviceOrderId,
        raw.soId,
        raw.orderId,
        serviceOrder?.id,
        serviceOrder?.serviceOrderId,
      ) ||
      "",
    score,
    comment:
      pickFirstString(raw.comment, raw.feedback, raw.note, raw.description) ?? null,
    customerName:
      pickFirstString(
        raw.customerName,
        raw.customerFullName,
        raw.receiverName,
        raw.fullName,
        customer?.name,
        customer?.fullName,
        customer?.customerName,
      ) ?? null,
    customerAvatar:
      pickFirstString(
        raw.customerAvatar,
        raw.avatarUrl,
        customer?.avatarUrl,
        customer?.imageUrl,
      ) ?? null,
    serviceOrderId:
      pickFirstString(
        raw.serviceOrderId,
        raw.soId,
        raw.orderId,
        serviceOrder?.id,
        serviceOrder?.serviceOrderId,
      ) ??
      null,
    serviceOrderCode:
      pickFirstString(
        raw.serviceOrderCode,
        raw.soCode,
        raw.orderCode,
        serviceOrder?.code,
        serviceOrder?.orderCode,
      ) ?? null,
    staffId: pickFirstString(raw.staffId, raw.staff?.id) ?? null,
    createdAt: pickFirstString(raw.createdAt, raw.createdDate, raw.ratingDate) ?? null,
    updatedAt: pickFirstString(raw.updatedAt, raw.modifiedAt) ?? null,
  };
};

const extractRatingItems = (payload: unknown): Rating[] => {
  const normalizeList = (items: unknown[]): Rating[] =>
    items
      .map((item) => normalizeRating(item))
      .filter((item): item is Rating => !!item);

  if (Array.isArray(payload)) return normalizeList(payload);
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) return normalizeList(payload.items);
  if (Array.isArray(payload.results)) return normalizeList(payload.results);

  if (isRecord(payload.data)) {
    const nested = payload.data;
    if (Array.isArray(nested.items)) return normalizeList(nested.items);
    if (Array.isArray(nested.results)) return normalizeList(nested.results);
  }

  if (Array.isArray(payload.data)) {
    return normalizeList(payload.data);
  }

  return [];
};

const computeAverage = (ratings: Rating[]): number => {
  if (!ratings.length) return 0;
  const sum = ratings.reduce((acc, r) => acc + (r.score ?? 0), 0);
  return sum / ratings.length;
};

// ── Star Row ─────────────────────────────────────────────────

function StarRow({ score, size = 16 }: { score: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= score ? "star" : "star-outline"}
          size={size}
          color={i <= score ? Colors.warning : Colors.gray300}
        />
      ))}
    </View>
  );
}

// ── Rating Card ───────────────────────────────────────────────

function RatingCard({ item }: { item: Rating }) {
  const initial = item.customerName?.charAt(0).toUpperCase() ?? "?";
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {/* Avatar */}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.customerName}>
            {item.customerName ?? "Khách hàng"}
          </Text>
          {item.serviceOrderCode && (
            <Text style={styles.orderCode}>
              Đơn #{item.serviceOrderCode}
            </Text>
          )}
        </View>

        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <StarRow score={item.score} />
          {item.createdAt && (
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          )}
        </View>
      </View>

      {!!item.comment && (
        <Text style={styles.comment}>{item.comment}</Text>
      )}
    </View>
  );
}

// ── Summary Header ────────────────────────────────────────────

function SummaryHeader({ ratings }: { ratings: Rating[] }) {
  const avg = computeAverage(ratings);
  const total = ratings.length;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r.score === star).length,
  }));

  return (
    <View style={styles.summary}>
      <View style={styles.summaryLeft}>
        <Text style={styles.avgScore}>{avg.toFixed(1)}</Text>
        <StarRow score={Math.round(avg)} size={20} />
        <Text style={styles.totalText}>{total} ratings</Text>
      </View>

      <View style={styles.summaryRight}>
        {counts.map(({ star, count }) => (
          <View key={star} style={styles.barRow}>
            <Text style={styles.barLabel}>{star}</Text>
            <Ionicons name="star" size={12} color={Colors.warning} />
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  {
                    width:
                      total > 0
                        ? `${Math.round((count / total) * 100)}%`
                        : "0%",
                  },
                ]}
              />
            </View>
            <Text style={styles.barCount}>{count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function RatingsScreen() {
  const { user } = useAuth();
  const { tasks } = useTask();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerNameByOrderRefRef = useRef<Map<string, string>>(new Map());

  const customerNameByOrderRef = useMemo(() => {
    const map = new Map<string, string>();
    mergeTaskNamesIntoMap(map, tasks);

    return map;
  }, [tasks]);

  useEffect(() => {
    customerNameByOrderRefRef.current = customerNameByOrderRef;
  }, [customerNameByOrderRef]);

  const loadRatings = useCallback(
    async (silent = false) => {
      if (!user?.id) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await getRatingsByStaffId(user.id);
        const extracted = extractRatingItems(response.data);
        const currentCustomerMap = customerNameByOrderRefRef.current;

        const localEnriched = extracted.map((item) => {
          const localFallbackName =
            currentCustomerMap.get(toKey(item.serviceOrderId)) ||
            currentCustomerMap.get(toKey(item.serviceOrderCode)) ||
            null;

          return {
            ...item,
            customerName:
              pickFirstString(item.customerName, localFallbackName) ?? null,
          };
        });

        const hasMissingCustomerName = localEnriched.some(
          (item) => !item.customerName,
        );

        if (!hasMissingCustomerName) {
          setRatings(localEnriched);
          return;
        }

        const remoteMap = new Map(currentCustomerMap);
        const maxPages = 5;
        const pageSize = 100;

        for (let page = 1; page <= maxPages; page += 1) {
          const pageTasks = await TaskService.getTasks({
            page,
            pageSize,
            staffId: user.id,
          });

          if (!pageTasks.length) break;
          mergeTaskNamesIntoMap(remoteMap, pageTasks);
          if (pageTasks.length < pageSize) break;
        }

        const remoteEnriched = localEnriched.map((item) => {
          const remoteFallbackName =
            remoteMap.get(toKey(item.serviceOrderId)) ||
            remoteMap.get(toKey(item.serviceOrderCode)) ||
            null;

          return {
            ...item,
            customerName:
              pickFirstString(item.customerName, remoteFallbackName) ?? null,
          };
        });

        setRatings(remoteEnriched);
      } catch (err: any) {
        setError(err.message ?? "Unable to load ratings");
        setRatings([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    loadRatings();
  }, [loadRatings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadRatings(true);
  }, [loadRatings]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primary900}
      />

      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="star" size={22} color={Colors.warning} />
        <Text style={styles.headerTitle}>My Ratings</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary700} />
          <Text style={styles.loadingText}>Loading ratings...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={Colors.error}
          />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={ratings}
          keyExtractor={(item, index) => item.id || `rating-${index}`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary700]}
            />
          }
          ListHeaderComponent={
            ratings.length > 0 ? (
              <SummaryHeader ratings={ratings} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="star-outline"
                size={56}
                color={Colors.gray300}
              />
              <Text style={styles.emptyTitle}>No Ratings</Text>
              <Text style={styles.emptySubtitle}>
                Customers haven't submitted any ratings for you yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => <RatingCard item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },

  header: {
    backgroundColor: Colors.primary800,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 10,
  },

  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.white,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: Spacing["2xl"],
  },

  loadingText: {
    fontSize: Typography.base,
    color: Colors.gray500,
    marginTop: 8,
  },

  errorText: {
    fontSize: Typography.base,
    color: Colors.error,
    textAlign: "center",
  },

  // ── Summary ──

  summary: {
    flexDirection: "row",
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.base,
    marginBottom: Spacing.sm,
  },

  summaryLeft: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: Spacing.lg,
    borderRightWidth: 1,
    borderRightColor: Colors.gray200,
    gap: 6,
    minWidth: 100,
  },

  avgScore: {
    fontSize: 42,
    fontWeight: "800",
    color: Colors.gray800,
    lineHeight: 48,
  },

  totalText: {
    fontSize: Typography.sm,
    color: Colors.gray500,
    marginTop: 2,
  },

  summaryRight: {
    flex: 1,
    paddingLeft: Spacing.lg,
    gap: 6,
    justifyContent: "center",
  },

  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  barLabel: {
    fontSize: Typography.sm,
    color: Colors.gray600,
    width: 12,
    textAlign: "center",
  },

  barBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.gray200,
    borderRadius: 3,
    overflow: "hidden",
  },

  barFill: {
    height: 6,
    backgroundColor: Colors.warning,
    borderRadius: 3,
  },

  barCount: {
    fontSize: Typography.sm,
    color: Colors.gray500,
    width: 20,
    textAlign: "right",
  },

  // ── Card ──

  listContent: {
    paddingBottom: Spacing["3xl"],
  },

  card: {
    backgroundColor: Colors.white,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary700,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: Typography.lg,
    fontWeight: "700",
    color: Colors.white,
  },

  customerName: {
    fontSize: Typography.base,
    fontWeight: "600",
    color: Colors.gray800,
  },

  orderCode: {
    fontSize: Typography.sm,
    color: Colors.gray500,
    marginTop: 2,
  },

  dateText: {
    fontSize: Typography.xs,
    color: Colors.gray400,
  },

  comment: {
    marginTop: Spacing.sm,
    fontSize: Typography.sm,
    color: Colors.gray700,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingTop: Spacing.sm,
  },

  // ── Empty ──

  emptyContainer: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: Spacing["2xl"],
    gap: 12,
  },

  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.gray700,
  },

  emptySubtitle: {
    fontSize: Typography.base,
    color: Colors.gray500,
    textAlign: "center",
    lineHeight: 22,
  },
});

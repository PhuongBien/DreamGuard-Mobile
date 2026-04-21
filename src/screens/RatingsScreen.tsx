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
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ProfileStackParamList } from "../types/navigation";

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
    orderId?: string;
    taskCode?: string;
    customer?: { id?: string; name?: string };
  }>,
) => {
  sourceTasks.forEach((task) => {
    const name = task.customer?.name?.trim();
    if (!name) return;

    const keys = [
      toKey(task.orderId),
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
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewCardHeader}>
        <View style={styles.reviewCardTitleRow}>
          <Text style={styles.reviewCustomerName} numberOfLines={1}>
            {item.customerName ?? "Customer"}
          </Text>
          <View style={styles.reviewRatingRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons
                key={i}
                name={i <= item.score ? "star" : "star-outline"}
                size={14}
                color={i <= item.score ? Colors.warning : Colors.gray300}
              />
            ))}
          </View>
        </View>
        {item.serviceOrderCode ? (
          <Text style={styles.reviewTaskText} numberOfLines={1}>
            Đơn #{item.serviceOrderCode}
          </Text>
        ) : null}
      </View>

      {!!item.comment && (
        <Text style={styles.reviewComment} numberOfLines={3}>
          “{item.comment}”
        </Text>
      )}

      <View style={styles.reviewFooter}>
        <View style={styles.reviewTags}>
          <View style={styles.reviewTagPill}>
            <Text style={styles.reviewTagText}>Đúng giờ</Text>
          </View>
          <View style={styles.reviewTagPill}>
            <Text style={styles.reviewTagText}>Tỉ mỉ</Text>
          </View>
          <View style={styles.reviewTagPill}>
            <Text style={styles.reviewTagText}>Lịch sự</Text>
          </View>
        </View>
        {item.createdAt ? (
          <Text style={styles.reviewDate}>
            {formatDate(item.createdAt)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Summary Header ────────────────────────────────────────────

function RatingsSummary({ ratings }: { ratings: Rating[] }) {
  const avg = computeAverage(ratings);
  const total = ratings.length;
  const fiveStars = ratings.filter((r) => r.score === 5).length;
  const happyPercent = total
    ? Math.round((ratings.filter((r) => r.score >= 4).length / total) * 100)
    : 0;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r.score === star).length,
  }));

  const highlightTags = [
    { label: "Đúng giờ", value: 4 },
    { label: "Tỉ mỉ", value: 3 },
    { label: "Lịch sự", value: 2 },
    { label: "Chuyên nghiệp", value: 2 },
    { label: "Thân thiện", value: 2 },
  ];

  return (
    <View style={styles.summaryWrapper}>
      <View style={styles.heroCard}>
        <View style={styles.card}>
        <Text style={styles.heroTitle}>{avg.toFixed(1)}</Text>
        <Text style={styles.heroSubTitle}>/ 5.0</Text>
        </View>
        <View style={styles.heroStars}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons
              key={i}
              name={i <= Math.round(avg) ? "star" : "star-outline"}
              size={20}
              color={i <= Math.round(avg) ? Colors.warning : Colors.gray200}
            />
          ))}
        </View>
        <Text style={styles.heroText}>Based on {total} reviews from customers</Text>
      </View>

      <View style={styles.summaryStatsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Satisfied</Text>
          <Text style={styles.statValue}>{happyPercent}%</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>5 Stars</Text>
          <Text style={styles.statValue}>{fiveStars} votes</Text>
        </View>
      </View>

      <View style={styles.distributionCard}>
        <Text style={styles.distributionTitle}>Rating Distribution</Text>
        {counts.map(({ star, count }) => (
          <View key={star} style={styles.distributionRow}>
            <View style={styles.distributionLabelRow}>
              <Text style={styles.distributionStar}>{star}</Text>
              <Ionicons name="star" size={12} color={Colors.warning} />
            </View>
            <View style={styles.distributionBarBg}>
              <View
                style={[
                  styles.distributionBarFill,
                  {
                    width:
                      total > 0
                        ? `${Math.round((count / total) * 100)}%`
                        : "0%",
                  },
                ]}
              />
            </View>
            <Text style={styles.distributionCount}>{count}</Text>
          </View>
        ))}
      </View>

      {/* <View style={styles.tagCard}>
        <Text style={styles.tagTitle}>Khách hàng khen bạn về</Text>
        <View style={styles.tagWrap}>
          {highlightTags.map((tag) => (
            <View key={tag.label} style={styles.tagPill}>
              <Text style={styles.tagPillText}>{`${tag.label} · ${tag.value}`}</Text>
            </View>
          ))}
        </View>
      </View> */}

      <Text style={styles.reviewSectionTitle}>Recent comments ({total})</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────

export default function RatingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { user } = useAuth();
  const { tasks } = useTask();

  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customerNameByorderIdRef = useRef<Map<string, string>>(new Map());

  const customerNameByorderId = useMemo(() => {
    const map = new Map<string, string>();
    mergeTaskNamesIntoMap(map, tasks);

    return map;
  }, [tasks]);

  useEffect(() => {
    customerNameByorderIdRef.current = customerNameByorderId;
  }, [customerNameByorderId]);

  const loadRatings = useCallback(
    async (silent = false) => {
      if (!user?.id || user.role !== "cleaner") return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const response = await getRatingsByStaffId(user.id);
        const extracted = extractRatingItems(response.data);
        const currentCustomerMap = customerNameByorderIdRef.current;

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
    [user?.id, user?.role],
  );

  useFocusEffect(
    useCallback(() => {
      if (user && user.role !== "cleaner") {
        navigation.goBack();
      }
    }, [user, navigation]),
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
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
              <RatingsSummary ratings={ratings} />
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
    backgroundColor: Colors.primary900,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing["xl"],
    gap: 10,
    borderBottomStartRadius: BorderRadius.xl,
    borderBottomEndRadius: BorderRadius.xl,
  },

  backButton: {
    padding: 6,
    borderRadius: BorderRadius.full,
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

  summaryWrapper: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  heroCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    // borderColor: Colors.primary500,
    // borderWidth: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing["xl"],
    boxShadow: `0px 4px 12px ${Colors.primary400}`,
    textAlign: "center",

  },

  heroTitle: {
    fontSize: Typography["4xl"],
    fontWeight: "900",
    color: Colors.primary900,
  },

  heroSubTitle: {
    fontSize: Typography.lg,
    fontWeight: "700",
    color: Colors.primary900,
    marginTop: 4,
  },

  heroStars: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },

  heroText: {
    marginTop: 12,
    fontSize: Typography.base,
    color: Colors.primary500,
    lineHeight: 22,
  },

  summaryStatsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadow.sm,
  },

  statLabel: {
    fontSize: Typography.xs,
    color: Colors.gray500,
  },

  statValue: {
    marginTop: 6,
    fontSize: Typography["2xl"],
    fontWeight: "800",
    color: Colors.primary800,
  },

  distributionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    ...Shadow.sm,
  },

  distributionTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },

  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: Spacing.sm,
  },

  distributionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    width: 40,
  },

  distributionStar: {
    fontSize: Typography.sm,
    color: Colors.gray600,
  },

  distributionBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.gray200,
    borderRadius: 999,
    overflow: "hidden",
  },

  distributionBarFill: {
    height: 8,
    backgroundColor: Colors.primary700,
    borderRadius: 999,
  },

  distributionCount: {
    width: 28,
    textAlign: "right",
    fontSize: Typography.sm,
    color: Colors.gray500,
  },

  tagCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    ...Shadow.sm,
  },

  tagTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray800,
    marginBottom: Spacing.sm,
  },

  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  tagPill: {
    backgroundColor: Colors.gray100,
    borderRadius: BorderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  tagPillText: {
    fontSize: Typography.xs,
    color: Colors.gray700,
    fontWeight: "600",
  },

  reviewSectionTitle: {
    marginTop: Spacing.md,
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray800,
  },

  listContent: {
    paddingBottom: Spacing["3xl"],
  },

  reviewCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    ...Shadow.sm,
  },

  reviewCardHeader: {
    gap: Spacing.xs,
  },

  reviewCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },

  reviewCustomerName: {
    flex: 1,
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray800,
  },

  reviewRatingRow: {
    flexDirection: "row",
    gap: 4,
  },

  reviewComment: {
    marginTop: Spacing.sm,
    color: Colors.gray700,
    lineHeight: 20,
  },

  reviewTaskText: {
    marginTop: Spacing.xs,
    fontSize: Typography.sm,
    color: Colors.gray500,
  },

  card: {
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
  },

  reviewFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    flexWrap: "wrap",
    gap: Spacing.sm,
  },

  reviewTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    flexShrink: 1,
  },

  reviewTagPill: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  reviewTagText: {
    fontSize: Typography.xs,
    color: Colors.white,
  },

  reviewDate: {
    fontSize: Typography.xs,
    color: Colors.gray400,
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

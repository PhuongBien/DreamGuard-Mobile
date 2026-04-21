// ============================================================
// KBS Staff App — Notification detail
// ============================================================

import React, { useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import type {
  MainTabParamList,
  NotificationStackParamList,
} from "../types/navigation";
import { formatDate } from "../utils/date";
import { markNotificationRead } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useNotificationBadge } from "../context/NotificationBadgeContext";
import {
  hasNotificationDeepLink,
  parseNotificationDeepLink,
} from "../utils/notificationDeepLink";

type Props = CompositeScreenProps<
  NativeStackScreenProps<NotificationStackParamList, "NotificationDetail">,
  BottomTabScreenProps<MainTabParamList>
>;

export default function NotificationDetailScreen({ route, navigation }: Props) {
  const { notificationId, actionType, message, createdAt, isRead } =
    route.params;
  const { user } = useAuth();
  const { refreshBadge } = useNotificationBadge();
  const didAutoNavigate = useRef(false);

  const link = parseNotificationDeepLink(message, actionType, user?.role);
  const linked = hasNotificationDeepLink(link);

  const openLinkedTarget = useCallback(() => {
    if (link.tradeInOrderId) {
      navigation.navigate("Tasks", {
        screen: "TradeInDetail",
        params: { tradeInOrderId: link.tradeInOrderId },
      });
      return;
    }
    if (link.shippingTaskId) {
      navigation.navigate("Tasks", {
        screen: "TaskDetail",
        params: { shippingTaskId: link.shippingTaskId },
      });
      return;
    }
    if (link.taskId) {
      navigation.navigate("Tasks", {
        screen: "TaskDetail",
        params: { taskId: link.taskId },
      });
    }
  }, [link, navigation]);

  useEffect(() => {
    if (!isRead) {
      markNotificationRead(notificationId)
        .then(() => void refreshBadge())
        .catch(() => {});
    }
  }, [notificationId, isRead, refreshBadge]);

  useEffect(() => {
    if (!linked || didAutoNavigate.current) return;
    didAutoNavigate.current = true;
    const t = setTimeout(() => openLinkedTarget(), 120);
    return () => clearTimeout(t);
  }, [linked, openLinkedTarget]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={12}
        >
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Notification
        </Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.readBadge,
                isRead ? styles.readBadgeRead : styles.readBadgeUnread,
              ]}
            >
              <Text
                style={[
                  styles.readBadgeText,
                  isRead ? styles.readBadgeTextRead : styles.readBadgeTextUnread,
                ]}
              >
                {isRead ? "Read" : "Unread"}
              </Text>
            </View>
            <Text style={styles.time}>{formatDate(createdAt)}</Text>
          </View>

          <Text style={styles.actionType}>{actionType}</Text>
          <Text style={styles.message}>{message}</Text>

          {linked && (
            <View style={styles.openingRow}>
              <ActivityIndicator color={Colors.primary700} />
              <Text style={styles.openingHint}>Opening related screen…</Text>
            </View>
          )}

          {linked && (
            <TouchableOpacity
              style={styles.cta}
              onPress={openLinkedTarget}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>
                {link.tradeInOrderId
                  ? "Open trade-in"
                  : link.shippingTaskId || link.taskId
                    ? "Open task"
                    : "Open"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={Colors.white}
              />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray50 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 12,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: Typography.lg,
    fontWeight: "700",
    color: Colors.white,
  },
  headerRight: { width: 40 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    ...Shadow.base,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  readBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  readBadgeUnread: { backgroundColor: Colors.primary100 },
  readBadgeRead: { backgroundColor: Colors.gray200 },
  readBadgeText: { fontSize: Typography.xs, fontWeight: "600" },
  readBadgeTextUnread: { color: Colors.primary800 },
  readBadgeTextRead: { color: Colors.gray600 },
  time: { fontSize: Typography.xs, color: Colors.gray500 },
  actionType: {
    fontSize: Typography.md,
    fontWeight: "700",
    color: Colors.gray900,
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: Typography.base,
    lineHeight: 22,
    color: Colors.gray700,
  },
  openingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: Spacing.lg,
  },
  openingHint: {
    fontSize: Typography.sm,
    color: Colors.gray600,
  },
  cta: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary700,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  ctaText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: "700",
  },
});

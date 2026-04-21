// ============================================================
// KBS Staff App — Notifications Screen
// ============================================================

import React, { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { EmptyState } from "../components/shared";
import {
  Notification,
  NotificationType,
  BackendNotificationItem,
} from "../types";
import type { UserRole } from "../types/user";
import type { NotificationStackParamList } from "../types/navigation";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "../utils/date";
import { useAuth } from "../context/AuthContext";
import { useNotificationBadge } from "../context/NotificationBadgeContext";
import { parseNotificationDeepLink } from "../utils/notificationDeepLink";

import { Ionicons } from "@expo/vector-icons";

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ComponentProps<typeof Ionicons>["name"]; color: string }
> = {
  new_task: { icon: "document-text-outline", color: Colors.primary700 },
  task_updated: { icon: "create-outline", color: Colors.warning },
  task_cancelled: { icon: "close-circle-outline", color: Colors.error },
  reminder: { icon: "time-outline", color: Colors.success },
  system: { icon: "settings-outline", color: Colors.gray500 },
};

function actionTypeToNotificationType(actionType: string): NotificationType {
  const a = actionType.toLowerCase();
  if (
    a.includes("new") &&
    (a.includes("task") || a.includes("assign") || a.includes("shipping"))
  ) {
    return "new_task";
  }
  if (a.includes("cancel")) return "task_cancelled";
  if (a.includes("remind")) return "reminder";
  if (
    a.includes("task") ||
    a.includes("deliver") ||
    a.includes("shipping") ||
    a.includes("check")
  ) {
    return "task_updated";
  }
  return "system";
}

function mapBackendToNotification(
  item: BackendNotificationItem,
  role: UserRole | undefined,
): Notification {
  const link = parseNotificationDeepLink(
    item.message,
    item.actionType,
    role,
  );
  return {
    id: item.notificationId,
    type: actionTypeToNotificationType(item.actionType),
    title: item.actionType,
    body: item.message,
    taskId: link.taskId,
    shippingTaskId: link.shippingTaskId,
    tradeInOrderId: link.tradeInOrderId,
    isRead: item.isRead,
    createdAt: item.createdAt,
  };
}

type Props = NativeStackScreenProps<
  NotificationStackParamList,
  "NotificationList"
>;

export default function NotificationsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { refreshBadge, acknowledgeTabViewed } = useNotificationBadge();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchNotifications(1, 50);
      const page = response.data;
      const items = Array.isArray(page?.items) ? page.items : [];
      setNotifications(
        items.map((item) => mapBackendToNotification(item, user?.role)),
      );
    } catch (error) {
      console.log("Load notifications error:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
      void refreshBadge();
    }
  }, [user?.role, refreshBadge]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const n = await refreshBadge();
        if (active) acknowledgeTabViewed(n);
      })();
      return () => {
        active = false;
      };
    }, [refreshBadge, acknowledgeTabViewed]),
  );

  const markRead = useCallback(async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch {
      // Still update locally so UX isn’t blocked if PATCH differs on BE.
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    void refreshBadge();
  }, [refreshBadge]);

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
    } catch {
      // Local fallback below
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    void refreshBadge();
  }, [refreshBadge]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handleNotifPress = async (notif: Notification) => {
    let nextRead = notif.isRead;
    if (!notif.isRead) {
      await markRead(notif.id);
      nextRead = true;
    }
    navigation.navigate("NotificationDetail", {
      notificationId: notif.id,
      actionType: notif.title,
      message: notif.body,
      createdAt: notif.createdAt,
      isRead: nextRead,
    });
  };

  const hasLinkedEntity = (n: Notification) =>
    !!(n.taskId || n.shippingTaskId || n.tradeInOrderId);

  const renderNotif = ({ item }: { item: Notification }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifUnread]}
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.75}
      >
        <View style={[styles.notifIcon, { backgroundColor: cfg.color + "15" }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>

        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text
              style={[
                styles.notifTitle,
                !item.isRead && styles.notifTitleUnread,
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={styles.notifTime}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>
            {item.body}
          </Text>
          {hasLinkedEntity(item) && (
            <Text style={styles.notifLink}>
              {item.tradeInOrderId ? "View trade-in →" : "View task →"}
            </Text>
          )}
        </View>

        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notification</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSub}>
              {unreadCount} Unread notifications
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
            <Text style={styles.markAllText}>Read all</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderNotif}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary700]}
            tintColor={Colors.primary700}
          />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="notifications-circle-outline"
              title="No announcement yet."
              subtitle="You will receive notifications when there are new tasks or updates."
            />
          )
        }
      />
    </SafeAreaView>
  );
}

function formatRelativeTime(iso: string): string {
  return formatDate(iso);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray50 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.base,
    paddingVertical: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.white,
  },
  headerSub: {
    fontSize: Typography.sm,
    color: Colors.primary100,
    marginTop: 2,
  },
  markAllBtn: {
    backgroundColor: Colors.primary700,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  markAllText: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: "600",
  },

  listContent: { padding: Spacing.base, paddingBottom: 30 },

  notifCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    gap: 10,
    ...Shadow.sm,
  },
  notifUnread: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary50,
    backgroundColor: Colors.primary50,
    ...Shadow.base,
  },
  notifIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: Typography.base,
    fontWeight: "500",
    color: Colors.gray600,
    flex: 1,
    marginRight: 4,
  },
  notifTitleUnread: { fontWeight: "700", color: Colors.gray900 },
  notifTime: { fontSize: Typography.xs, color: Colors.gray400, flexShrink: 0 },
  notifBody: { fontSize: Typography.sm, color: Colors.gray600, lineHeight: 20 },
  notifLink: {
    fontSize: Typography.xs,
    color: Colors.primary700,
    fontWeight: "600",
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary500,
    marginTop: 4,
    flexShrink: 0,
  },
});

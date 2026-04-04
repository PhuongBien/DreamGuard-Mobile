// ============================================================
// KBS Staff App — Notifications Screen
// ============================================================

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from "react-native";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { EmptyState } from "../components/shared";
import { Notification, NotificationType } from "../types";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../utils/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDate } from "../utils/date";

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

interface NotificationsScreenProps {
  onSelectTask?: (taskId: string) => void;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

const extractNotificationItems = (payload: unknown): Notification[] => {
  if (Array.isArray(payload)) return payload as Notification[];
  if (!isRecord(payload)) return [];

  if (Array.isArray(payload.items)) return payload.items as Notification[];
  if (Array.isArray(payload.results)) return payload.results as Notification[];

  if (isRecord(payload.data)) {
    const nested = payload.data;
    if (Array.isArray(nested.items)) return nested.items as Notification[];
    if (Array.isArray(nested.results)) return nested.results as Notification[];
  }

  return [];
};

export default function NotificationsScreen({
  onSelectTask,
}: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchNotifications(1, 50);
      setNotifications(extractNotificationItems(response.data));
    } catch (error) {
      console.log("Load notifications error:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // 📌 [API: PATCH /notifications/:id/read]
  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  // 📌 [API: PATCH /notifications/read-all]
  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  // 📌 [API: GET /notifications] — re-fetch on pull
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const handleNotifPress = async (notif: Notification) => {
    await markRead(notif.id);
    if (notif.taskId && onSelectTask) {
      onSelectTask(notif.taskId);
    }
  };

  const renderNotif = ({ item }: { item: Notification }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.isRead && styles.notifUnread]}
        onPress={() => handleNotifPress(item)}
        activeOpacity={0.75}
      >
        {/* Icon */}
        {/* <View style={[styles.notifIcon, { backgroundColor: cfg.color + '18' }]}>
          <Text style={{ fontSize: 22 }}>{cfg.icon}</Text>
        </View> */}
        <View style={[styles.notifIcon, { backgroundColor: cfg.color + "15" }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </View>

        {/* Content */}
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
          {item.taskId && (
            <Text style={styles.notifLink}>View task details →</Text>
          )}
        </View>

        {/* Unread dot */}
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      {/* Header */}
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
              icon="🔔"
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
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
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

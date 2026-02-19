// ============================================================
// KBS Staff App — Task Detail Screen (Navigation Version)
// ============================================================

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  Image,
  TextInput,
  ActivityIndicator,
} from "react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  TaskTypeConfig,
} from "../constants/theme";

import {
  StatusBadge,
  PriorityBadge,
  SectionCard,
  InfoRow,
  KBSButton,
  Divider,
  Avatar,
} from "../components/shared";

import { Task, TaskStatus, TaskPhoto } from "../types";
import { MOCK_TASKS } from "../utils/mockData";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

/**
 * ⚠️ Sau này nên chuyển sang src/navigation/types.ts
 */
export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  CheckInOut: { taskId: string };
};

type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

/* ───────────────────────── STATUS RULES ───────────────────────── */

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold"],
  on_hold: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

// const STATUS_ACTIONS: Record<
//   TaskStatus,
//   { label: string; variant: "primary" | "danger" | "secondary" | "outline" }
// > = {
//   in_progress: { label: 'Bắt đầu thực hiện', variant: 'primary', icon: 'play-outline' },
// completed: { label: 'Đánh dấu hoàn thành', variant: 'primary', icon: 'checkmark-outline' },
// on_hold: { label: 'Tạm dừng', variant: 'outline', icon: 'pause-outline' },
// cancelled: { label: 'Hủy nhiệm vụ', variant: 'danger', icon: 'close-outline' },
// };

const STATUS_ACTIONS: Record<
  TaskStatus,
  {
    label: string;
    variant: 'primary' | 'danger' | 'secondary' | 'outline';
    icon: React.ComponentProps<typeof Ionicons>['name'];
  }
> = {
  in_progress: {
    label: 'In Progress',
    variant: 'primary',
    icon: 'play-outline',
  },
  completed: {
    label: 'Completed',
    variant: 'primary',
    icon: 'checkmark-outline',
  },
  on_hold: {
    label: 'On Hold',
    variant: 'outline',
    icon: 'pause-outline',
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'danger',
    icon: 'close-outline',
  },
  pending: {
    label: 'Revert to Pending',
    variant: 'secondary',
    icon: 'arrow-undo-outline',
  },
};

/* ───────────────────────── SCREEN ───────────────────────── */

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;

  const [task, setTask] = useState<Task>(
    MOCK_TASKS.find((t) => t.id === taskId) ?? MOCK_TASKS[0],
  );

  const [statusLoading, setStatusLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TaskPhoto | null>(null);

  const nextStatuses = NEXT_STATUSES[task.status];
  const typeConfig = TaskTypeConfig[task.type];

  /* ─────────────── STATUS UPDATE ─────────────── */

  const applyStatus = async (newStatus: TaskStatus) => {
    setStatusLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    setTask((prev) => ({
      ...prev,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    }));

    setStatusLoading(false);
  };

  const handleStatusChange = useCallback(
    (newStatus: TaskStatus) => {
      if (newStatus === "cancelled") {
        Alert.alert("Cancellation confirmation", "Are you sure you want to cancel this task?", [
          { text: "No", style: "cancel" },
          {
            text: "Cancel Task",
            style: "destructive",
            onPress: () => applyStatus(newStatus),
          },
        ]);
      } else {
        applyStatus(newStatus);
      }
    },
    [task],
  );

  /* ─────────────── ADD NOTE ─────────────── */

  const handleAddNote = async () => {
    if (!noteText.trim()) return;

    await new Promise((r) => setTimeout(r, 400));

    setTask((prev) => ({
      ...prev,
      notes: [
        ...prev.notes,
        {
          id: `n_${Date.now()}`,
          content: noteText.trim(),
          createdAt: new Date().toISOString(),
          createdBy: "current_user",
          authorName: "Bạn",
        },
      ],
    }));

    setNoteText("");
    setShowNoteModal(false);
  };

  /* ───────────────────────── UI ───────────────────────── */

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          {/* <Text style={styles.backIcon}>‹</Text> */}
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.topBarCode}>{task.taskCode}</Text>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {task.title}
          </Text>
        </View>

        <StatusBadge status={task.status} size="sm" />
      </View>

      {/* ── Hero Banner ── */}
      <View
        style={[
          styles.heroBanner,
          {
            backgroundColor: typeConfig?.color
              ? typeConfig.color + "18"
              : Colors.primary100,
          },
        ]}
      >
        {/* <Text style={styles.heroIcon}>{typeConfig?.icon ?? "📋"}</Text> */}
        <Ionicons
  name={typeConfig?.icon ?? 'document-outline'}
  size={36}
  color={typeConfig?.color ?? Colors.primary700}
  style={{ marginRight: 12 }}
/>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              styles.heroType,
              { color: typeConfig?.color ?? Colors.primary700 },
            ]}
          >
            {typeConfig?.label ?? task.type}
          </Text>
          <Text style={styles.heroTitle}>{task.title}</Text>
        </View>
        <PriorityBadge priority={task.priority} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Customer */}
        {/* <SectionCard title="👤 Khách hàng"> */}
<SectionCard title="Customer" icon={<Ionicons name="person-outline" size={18} color={Colors.primary700} />}
>          <InfoRow icon={<Ionicons name="person-outline" size={18} color={Colors.primary700} />} label="Full Name" value={task.customer.name} />
          <InfoRow icon={<Ionicons name="call-outline" size={18} color={Colors.primary700} />} label="Phone" value={task.customer.phone} />
          <InfoRow icon={<Ionicons name="location-outline" size={18} color={Colors.primary700} />} label="Address" value={task.customer.address} />
        </SectionCard>

        {/* Description */}
        <SectionCard title="Task Description" icon={<Ionicons name="document-text-outline" size={18} color={Colors.primary700} />}>
          <Text style={styles.description}>{task.description}</Text>
        </SectionCard>

        {/* Check In / Out */}
        <SectionCard icon={<Ionicons name="location-outline" size={18} color={Colors.primary700} />} title="Check-in / Check-out">
          <KBSButton
            title="Open Check-in / Check-out Screen"
            onPress={() =>
              navigation.navigate("CheckInOut", { taskId: task.id })
            }
            variant="secondary"
          />
        </SectionCard>
      </ScrollView>

      {/* ── Status Action Bar ── */}
      {nextStatuses.length > 0 && (
        <View style={styles.actionBar}>
          {statusLoading ? (
            <ActivityIndicator color={Colors.primary700} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {nextStatuses.map((s) => {
                const a = STATUS_ACTIONS[s];
                return (
                  <View key={s} style={{ marginRight: 8 }}>
                    <KBSButton
                      title={a.label}
                      onPress={() => handleStatusChange(s)}
                      variant={a.variant}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── Add Note Modal ── */}
      <Modal visible={showNoteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thêm ghi chú</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Nhập ghi chú..."
              value={noteText}
              onChangeText={setNoteText}
              multiline
            />
            <View style={styles.modalActions}>
              <KBSButton
                title="Hủy"
                onPress={() => setShowNoteModal(false)}
                variant="outline"
                style={{ flex: 1 }}
              />
              <KBSButton
                title="Lưu"
                onPress={handleAddNote}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ───────────────────────── STYLES ───────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray50 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.base,
    paddingVertical: 12,
  },
  backBtn: { padding: 4 },
  backIcon: { fontSize: 30, color: Colors.white },
  topBarCode: {
    fontSize: Typography.xs,
    color: Colors.primary100,
    fontWeight: "600",
  },
  topBarTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.white,
  },

  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.base,
  },
  heroIcon: { fontSize: 36 },
  heroType: {
    fontSize: Typography.xs,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: Typography.md,
    fontWeight: "700",
    color: Colors.gray900,
  },

  content: {
    padding: Spacing.base,
    paddingBottom: 120,
  },

  description: {
    fontSize: Typography.base,
    color: Colors.gray700,
    lineHeight: 22,
  },

  actionBar: {
    backgroundColor: Colors.white,
    padding: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.gray200,
    ...Shadow.base,
    alignItems: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000080",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.white,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: Typography.lg,
    fontWeight: "700",
    marginBottom: 12,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.base,
    padding: 12,
    minHeight: 100,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
});

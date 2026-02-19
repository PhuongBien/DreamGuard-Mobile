import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";

import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { KBSButton, SectionCard, InfoRow } from "../components/shared";
import { MOCK_TASKS } from "../utils/mockData";
import { Task } from "../types";
import { SafeAreaView } from "react-native-safe-area-context";
import { TaskStackParamList } from "../types/navigation";
import { Ionicons, MaterialIcons, FontAwesome } from "@expo/vector-icons";

type Props = NativeStackScreenProps<TaskStackParamList, "CheckInOut">;

export default function CheckInOutScreen({ route, navigation }: Props) {
  const { taskId } = route.params;

  const [task, setTask] = useState<Task>(
    MOCK_TASKS.find((t) => t.id === taskId) ?? MOCK_TASKS[0],
  );

  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hasCheckedIn = !!task.checkInOut.checkIn;
  const hasCheckedOut = !!task.checkInOut.checkOut;

  // 🔥 Update header dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      title: task.taskCode,
      headerRight: () => (
        <Text style={{ color: Colors.white, fontWeight: "700" }}>
          {task.status.toUpperCase()}
        </Text>
      ),
    });
  }, [navigation, task.status]);

  const handleCheckIn = async () => {
    Alert.alert("Confirm Check-in", `Check-in at ${formatTime(currentTime)}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Check-in",
        onPress: async () => {
          setLoading(true);
          await new Promise((r) => setTimeout(r, 600));

          setTask((prev) => ({
            ...prev,
            status: "in_progress",
            checkInOut: {
              ...prev.checkInOut,
              checkIn: {
                time: new Date().toISOString(),
                address: prev.serviceAddress || prev.customer.address,
              },
            },
          }));

          setLoading(false);
        },
      },
    ]);
  };

  const handleCheckOut = async () => {
    Alert.alert(
      "Confirm Check-out",
      `Complete at ${formatTime(currentTime)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: async () => {
            setLoading(true);
            await new Promise((r) => setTimeout(r, 600));

            const updated: Task = {
              ...task,
              status: "completed",
              checkInOut: {
                ...task.checkInOut,
                checkOut: {
                  time: new Date().toISOString(),
                  address: task.serviceAddress || task.customer.address,
                },
              },
            };

            setTask(updated);
            setLoading(false);

            Alert.alert("Complete!", "Task has been updated.", [
              {
                text: "OK",
                onPress: () =>
                  navigation.navigate("TaskList", {
                    refresh: Date.now(), // trigger refresh
                  } as any),
              },
            ]);
          },
        },
      ],
    );
  };

  const getDuration = (): string => {
    if (!task.checkInOut.checkIn) return "—";

    const start = new Date(task.checkInOut.checkIn.time);
    const end = task.checkInOut.checkOut
      ? new Date(task.checkInOut.checkOut.time)
      : currentTime;

    const diffMs = end.getTime() - start.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;

    return hrs > 0 ? `${hrs}h ${remMins}m` : `${mins}m`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Clock */}
        <View style={styles.clockCard}>
          <Text style={styles.clockTime}>{formatTime(currentTime)}</Text>
          <Text style={styles.clockDate}>{formatFullDate(currentTime)}</Text>
        </View>

        {/* Task Info */}
        <SectionCard title="Task Information">
          <InfoRow icon="badge" label="Emp-Code" value={task.taskCode} />
          <InfoRow icon="title" label="Title" value={task.title} />
          <InfoRow
            icon="location-on"
            label="Location"
            value={task.serviceAddress || task.customer.address}
          />
          <InfoRow icon="person" label="Customer" value={task.customer.name} />
        </SectionCard>

        {hasCheckedIn && (
          <SectionCard title="Duration">
            <Text style={styles.durationValue}>{getDuration()}</Text>
          </SectionCard>
        )}

        <View style={styles.actions}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary700} />
          ) : (
            <>
              {!hasCheckedIn && (
                <KBSButton
                  title="CHECK-IN"
                  onPress={handleCheckIn}
                  variant="primary"
                  size="lg"
                />
              )}

              {hasCheckedIn && !hasCheckedOut && (
                <KBSButton
                  title="CHECK-OUT & COMPLETE"
                  onPress={handleCheckOut}
                  variant="primary"
                  size="lg"
                />
              )}

              {hasCheckedOut && (
                <Text style={{ textAlign: "center", marginTop: 12 }}>
                  Completed{" "}
                </Text>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Helpers */
function formatTime(d: Date) {
  return d.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullDate(d: Date) {
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.gray50 },
  content: {
    padding: Spacing.base,
    paddingBottom: 40,
  },
  clockCard: {
    backgroundColor: Colors.primary900,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.base,
    ...Shadow.lg,
  },
  clockTime: {
    fontSize: 40,
    fontWeight: "800",
    color: Colors.white,
  },
  clockDate: {
    fontSize: Typography.sm,
    color: Colors.primary100,
    marginTop: 4,
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  durationValue: {
    fontSize: Typography.xl,
    fontWeight: "800",
    textAlign: "center",
  },
});

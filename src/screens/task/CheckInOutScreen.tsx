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
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../constants/theme";

import { KBSButton, SectionCard, InfoRow } from "../../components/shared";
import { TaskStackParamList } from "../../types/navigation";
import { useTask } from "../../context/TaskContext";
import { formatVietnamAddress } from "../../utils/address";

type Props = NativeStackScreenProps<TaskStackParamList, "CheckInOut">;

export default function CheckInOutScreen({ route, navigation }: Props) {
  const { taskId } = route.params;

  const { tasks, checkIn, startProcessing, checkOut, completeTask } = useTask();

  const task = tasks.find((t) => t.id === taskId);

  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!task) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20 }}>Task not found</Text>
      </SafeAreaView>
    );
  }

  const status = task.status;
  const displayAddress =
    formatVietnamAddress(task.customer.address) || "Chua co dia chi";

  // Dynamic header
  useLayoutEffect(() => {
    navigation.setOptions({
      title: task.taskCode,
      headerRight: () => (
        <Text style={{ color: Colors.white, fontWeight: "700" }}>
          {task.status.toUpperCase()}
        </Text>
      ),
    });
  }, [navigation, task.taskCode, task.status]);

  // ================= CHECK IN =================

  const handleCheckIn = async () => {
    try {
      setLoading(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Location permission is required to check in."
        );
        return;
      }

      // Lấy vị trí hiện tại (đơn giản)
      await Location.getCurrentPositionAsync({});

      await checkIn(task.id);

      Alert.alert("Success", "Checked in successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to check in.");
    } finally {
      setLoading(false);
    }
  };

  // ================= CHECK OUT =================

  const handleCheckOut = async () => {
    try {
      setLoading(true);

      await Location.getCurrentPositionAsync({});

      await checkOut(task.id);

      Alert.alert("Completed", "Task has been completed.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Cannot check out.");
    } finally {
      setLoading(false);
    }
  };

  // ================= START PROCESSING =================

  const handleStartProcessing = async () => {
    try {
      setLoading(true);
      await startProcessing(task.id);
      Alert.alert("Success", "Đã bắt đầu thực hiện công việc.");
    } catch (error) {
      Alert.alert("Error", "Không thể bắt đầu xử lý.");
    } finally {
      setLoading(false);
    }
  };

  // ================= COMPLETE =================

  const handleComplete = async () => {
    try {
      setLoading(true);
      await completeTask(task.id);
      Alert.alert("Hoàn thành", "Công việc đã hoàn thành.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert("Error", "Không thể hoàn thành công việc.");
    } finally {
      setLoading(false);
    }
  };

  // ================= DURATION =================

  const getDuration = (): string => {
    if (!task.checkInOut?.checkIn) return "—";

    const start = new Date(task.checkInOut.checkIn.time);
    const end = task.checkInOut?.checkOut
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
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primary900}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Clock */}
        <View style={styles.clockCard}>
          <Text style={styles.clockTime}>{formatTime(currentTime)}</Text>
          <Text style={styles.clockDate}>
            {formatFullDate(currentTime)}
          </Text>
        </View>

        {/* Task Info */}
        <SectionCard title="Task Information">
          <InfoRow
  iconType="material"
  iconName="badge"
  label="Task Code"
  value={task.taskCode}
/>

<InfoRow
  iconType="material"
  iconName="title"
  label="Title"
  value={task.title}
/>

<InfoRow
  iconType="material"
  iconName="location-on"
  label="Location"
  value={displayAddress}
/>

<InfoRow
  iconType="material"
  iconName="person"
  label="Customer"
  value={task.customer.name}
/>
        </SectionCard>

        {/* Duration */}
        {(status === "checked_in" || status === "in_progress" || status === "checked_out" || status === "completed") && (
          <SectionCard title="Working Duration">
            <Text style={styles.durationValue}>{getDuration()}</Text>
          </SectionCard>
        )}

        {/* Actions */}
        <View style={styles.actions}>
            {loading ? (
              <ActivityIndicator
                size="large"
                color={Colors.primary700}
              />
            ) : (
              <>
                {status === "pending" && (
                  <KBSButton
                    title="CHECK-IN"
                    onPress={handleCheckIn}
                    variant="primary"
                    size="lg"
                  />
                )}

                {status === "checked_in" && (
                  <KBSButton
                    title="NHẬN VIỆC / BẮT ĐẦU"
                    onPress={handleStartProcessing}
                    variant="primary"
                    size="lg"
                  />
                )}

                {status === "in_progress" && (
                  <KBSButton
                    title="CHECK-OUT"
                    onPress={handleCheckOut}
                    variant="primary"
                    size="lg"
                  />
                )}

                {status === "checked_out" && (
                  <KBSButton
                    title="HOÀN THÀNH"
                    onPress={handleComplete}
                    variant="primary"
                    size="lg"
                  />
                )}

                {status === "completed" && (
                  <Text style={{ textAlign: "center", marginTop: 12, color: Colors.gray600 }}>
                    Công việc đã hoàn thành
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
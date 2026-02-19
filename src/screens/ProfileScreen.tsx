// ============================================================
// KBS Staff App — Profile Screen (Professional Version)
// ============================================================

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  RoleConfig,
} from "../constants/theme";

import {
  Avatar,
  SectionCard,
  InfoRow,
  KBSButton,
  Divider,
} from "../components/shared";

import { useAuth } from "../context/AuthContext";
import { MOCK_TASKS } from "../utils/mockData";
import * as ImagePicker from "expo-image-picker";

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  if (!user) return null;

  const roleInfo = RoleConfig[user.role] || {
    label: user.role,
  };

  const myTasks = MOCK_TASKS.filter((t) => t.assignedTo === user.id);
  const completed = myTasks.filter((t) => t.status === "completed").length;
  const pending = myTasks.filter((t) => t.status === "pending").length;
  const inProgress = myTasks.filter((t) => t.status === "in_progress").length;

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  };

  const MENU_ITEMS = [
    { icon: "list-outline", label: "My tasks", value: `${myTasks.length}` },
    {
      icon: "checkmark-circle-outline",
      label: "Completed",
      value: `${completed}`,
    },
    { icon: "notifications-outline", label: "Notifications", value: "Enabled" },
    { icon: "information-circle-outline", label: "Version", value: "1.0.0" },
  ];

  const handleChangeAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Quyền bị từ chối", "Cần quyền truy cập thư viện ảnh");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;

      // ✅ update avatar local
      setUser((prev) => (prev ? { ...prev, avatarUrl: uri } : prev));
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* <Avatar name={user.name} size={90} imageUrl={user.avatarUrl} /> */}
          <View style={{ position: "relative" }}>
            <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.85}>
              <Avatar name={user.name} size={90} imageUrl={user.avatarUrl} />
            </TouchableOpacity>

            {/* Camera icon */}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </View>

          <Text
            style={{ color: Colors.primary100, marginTop: 8, fontSize: 12 }}
          >
            Nhấn để đổi ảnh
          </Text>

          <Text style={styles.name}>{user.name}</Text>

          <View style={styles.roleRow}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={Colors.primary100}
            />
            <Text style={styles.role}>{roleInfo.label}</Text>
          </View>

          <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{user.employeeCode}</Text>
          </View>
        </View>

        {/* STATS */}
        <View style={styles.statsContainer}>
          <StatBox num={myTasks.length} label="Total" />
          <StatBox num={inProgress} label="In Progress" />
          <StatBox num={pending} label="Pending" />
          <StatBox num={completed} label="Completed" />
        </View>

        {/* CONTENT */}
        <View style={styles.section}>
          <SectionCard title="Personal Information">
            <InfoRow
              icon={
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={Colors.primary700}
                />
              }
              label="Email"
              value={user.email}
            />
            <InfoRow
              icon={
                <Ionicons
                  name="call-outline"
                  size={18}
                  color={Colors.primary700}
                />
              }
              label="Phone"
              value={user.phone}
            />
            <InfoRow
              icon={
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={Colors.primary700}
                />
              }
              label="Department"
              value={user.department}
            />
          </SectionCard>

          <SectionCard title="Settings">
            {MENU_ITEMS.map((item, idx) => (
              <React.Fragment key={item.label}>
                {idx > 0 && <Divider style={{ marginVertical: 6 }} />}
                <TouchableOpacity style={styles.menuItem} activeOpacity={0.7}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={Colors.primary700}
                    style={styles.menuIcon}
                  />

                  <Text style={styles.menuLabel}>{item.label}</Text>

                  <Text style={styles.menuValue}>{item.value}</Text>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={Colors.gray300}
                  />
                </TouchableOpacity>
              </React.Fragment>
            ))}
          </SectionCard>

          <KBSButton
            title="Log out"
            onPress={handleLogout}
            variant="danger"
            size="lg"
            icon={<Ionicons name="log-out-outline" size={18} color="white" />}
            style={{ marginTop: 20, marginBottom: 40 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ num, label }: { num: number; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statNum}>{num}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.gray50,
  },

  header: {
    backgroundColor: Colors.primary800,
    alignItems: "center",
    paddingTop: Spacing.xl,
    paddingBottom: Spacing["3xl"],
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.primary600,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.primary800,
  },

  name: {
    fontSize: Typography["2xl"],
    fontWeight: "800",
    color: Colors.white,
    marginTop: 14,
  },

  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 6,
  },

  role: {
    fontSize: Typography.base,
    color: Colors.primary100,
  },

  codeBadge: {
    marginTop: 12,
    backgroundColor: Colors.primary800,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },

  codeText: {
    color: Colors.primary100,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  statsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -24,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    ...Shadow.base,
  },

  statBox: {
    flex: 1,
    alignItems: "center",
  },

  statNum: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.primary700,
  },

  statLabel: {
    fontSize: Typography.xs,
    color: Colors.gray400,
    marginTop: 4,
  },

  section: {
    padding: Spacing.base,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },

  menuIcon: {
    width: 28,
  },

  menuLabel: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.gray700,
  },

  menuValue: {
    fontSize: Typography.sm,
    color: Colors.gray400,
    marginRight: 6,
  },
});

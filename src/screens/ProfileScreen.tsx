// KBS Staff App — Profile Screen (Professional Version)

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
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
import { useTask } from "../context/TaskContext";
import { getStaffProfileService } from "../services/auth.service";
import { formatDate } from "../utils/date";

export default function ProfileScreen() {
  const { user, logout, setUser } = useAuth();
  const { tasks } = useTask();
  const [profileUser, setProfileUser] = useState(user);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStaffProfile = async () => {
      if (!user) return;

      setIsProfileLoading(true);

      try {
        const latestProfile = await getStaffProfileService(user);
        if (!isMounted) return;

        setProfileUser(latestProfile);
        setUser((prev) => (prev ? { ...prev, ...latestProfile } : prev));
      } catch {
        if (!isMounted) return;
        setProfileUser(user);
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    };

    loadStaffProfile();

    return () => {
      isMounted = false;
    };
  }, [user, setUser]);

  const displayUser = useMemo(() => profileUser || user, [profileUser, user]);

  if (!user) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <Text>User not found</Text>
      </SafeAreaView>
    );
  }

  if (!displayUser) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color={Colors.primary700} />
      </SafeAreaView>
    );
  }

  const roleInfo = RoleConfig[displayUser.role] || {
    label: displayUser.role,
  };

  const myTasks = tasks;
  const completed = myTasks.filter((t) => t.status === "completed").length;
  const pending = myTasks.filter((t) => t.status === "pending").length;
  const inProgress = myTasks.filter(
    (t) =>
      t.status === "in_progress" ||
      t.status === "delivering" ||
      t.status === "arrived",
  ).length;

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={{ position: "relative" }}>
            <Avatar
              name={displayUser.name}
              size={90}
              imageUrl={displayUser.avatarUrl}
            />
          </View>

          <Text style={styles.name}>{displayUser.name}</Text>

          {/* {isProfileLoading ? (
            <Text style={styles.readOnlyHint}>Syncing staff profile...</Text>
          ) : (
            <Text style={styles.readOnlyHint}>Staff profile (read-only)</Text>
          )} */}

          <View style={styles.roleRow}>
            <Ionicons
              name="person-circle-outline"
              size={16}
              color={Colors.primary100}
            />
            <Text style={styles.role}>{roleInfo.label}</Text>
          </View>

          {/* <View style={styles.codeBadge}>
            <Text style={styles.codeText}>{displayUser.employeeCode || "N/A"}</Text>
          </View> */}
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
              iconType="ion"
              iconName="mail-outline"
              iconColor={Colors.primary700}
              label="Email"
              value={displayUser.email || "N/A"}
            />

            <InfoRow
              iconType="ion"
              iconName="call-outline"
              iconColor={Colors.primary700}
              label="Phone"
              value={displayUser.phone || "N/A"}
            />

            <InfoRow
              iconType="ion"
              iconName="calendar-outline"
              iconColor={Colors.primary700}
              label="Date of Birth"
              value={
                displayUser.dateOfBirth
                  ? formatDate(displayUser.dateOfBirth)
                  : "N/A"
              }
            />

            <InfoRow
              iconType="ion"
              iconName="briefcase-outline"
              iconColor={Colors.primary700}
              label="Position"
              value={displayUser.position || "N/A"}
            />

            <InfoRow
              iconType="ion"
              iconName="location-outline"
              iconColor={Colors.primary700}
              label="Address"
              value={displayUser.address || "N/A"}
            />
          </SectionCard>

          {/* <SectionCard title="Settings">
            {MENU_ITEMS.map((item, idx) => (
              <React.Fragment key={item.label}>
                {idx > 0 && <Divider style={{ marginVertical: 6 }} />}
                <View style={styles.menuItem}>
                  <Ionicons
                    name={item.icon as any}
                    size={20}
                    color={Colors.primary700}
                    style={styles.menuIcon}
                  />

                  <Text style={styles.menuLabel}>{item.label}</Text>

                  <Text style={styles.menuValue}>{item.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </SectionCard> */}

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

  name: {
    fontSize: Typography["2xl"],
    fontWeight: "800",
    color: Colors.white,
    marginTop: 14,
  },

  readOnlyHint: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.primary100,
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

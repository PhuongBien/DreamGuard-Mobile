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
  TouchableOpacity,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

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
import { ProfileStackParamList } from "../types/navigation";

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
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

  const handleViewRatings = () => navigation.navigate("Ratings");
  const canViewMyRatings = displayUser.role === "cleaner";

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
          {canViewMyRatings ? (
            <SectionCard>
              <TouchableOpacity
                style={styles.profileMenuButton}
                onPress={handleViewRatings}
                activeOpacity={0.7}
              >
                <View style={styles.profileMenuRow}>
                  <View style={styles.menuIconWrap}>
                    <Ionicons name="star-outline" size={20} color={Colors.primary700} />
                  </View>
                  <View style={styles.menuTextWrap}>
                    <Text style={styles.menuRowTitle}>My Ratings</Text>
                    <Text style={styles.menuRowSubtitle}>
                      View ratings from customers
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={Colors.gray300}
                  />
                </View>
              </TouchableOpacity>
            </SectionCard>
          ) : null}

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

  profileMenuButton: {
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },

  profileMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary100,
    justifyContent: "center",
    alignItems: "center",
  },

  menuTextWrap: {
    flex: 1,
  },

  menuRowTitle: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray800,
  },

  menuRowSubtitle: {
    marginTop: 4,
    fontSize: Typography.sm,
    color: Colors.gray500,
  },

  ratingCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    shadowColor: Colors.gray900,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 4,
  },

  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  ratingTitle: {
    fontSize: Typography["3xl"],
    fontWeight: "800",
    color: Colors.primary800,
  },

  ratingStars: {
    flexDirection: "row",
    gap: 4,
  },

  ratingSubtext: {
    marginTop: 10,
    fontSize: Typography.sm,
    color: Colors.gray500,
  },

  ratingMetrics: {
    flexDirection: "row",
    marginTop: 16,
    justifyContent: "space-between",
  },

  metricItem: {
    flex: 1,
    alignItems: "center",
  },

  metricValue: {
    fontSize: Typography.xl,
    fontWeight: "800",
    color: Colors.primary800,
  },

  metricLabel: {
    fontSize: Typography.sm,
    color: Colors.gray500,
    marginTop: 2,
  },

  distributionList: {
    marginTop: 16,
    gap: 10,
  },

  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  distributionStar: {
    width: 14,
    fontSize: Typography.sm,
    color: Colors.gray500,
  },

  distributionBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.gray200,
    borderRadius: 999,
    overflow: "hidden",
  },

  distributionBarFill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.primary600,
  },

  distributionCount: {
    width: 24,
    fontSize: Typography.sm,
    color: Colors.gray500,
    textAlign: "right",
  },

  tagRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  tagPill: {
    backgroundColor: Colors.primary100,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },

  tagText: {
    fontSize: Typography.sm,
    color: Colors.primary700,
    fontWeight: "600",
  },

  recentHeading: {
    fontSize: Typography.base,
    fontWeight: "700",
    color: Colors.gray700,
    marginBottom: 12,
  },

  reviewCard: {
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginTop: 10,
  },

  reviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reviewName: {
    fontSize: Typography.sm,
    fontWeight: "700",
    color: Colors.gray800,
    flex: 1,
    marginRight: 12,
  },

  reviewStars: {
    flexDirection: "row",
    gap: 4,
  },

  reviewComment: {
    marginTop: 10,
    fontSize: Typography.sm,
    color: Colors.gray600,
    lineHeight: 20,
  },

  reviewDate: {
    marginTop: 10,
    fontSize: Typography.xs,
    color: Colors.gray400,
  },

  noReviewsText: {
    fontSize: Typography.sm,
    color: Colors.gray500,
    marginTop: 10,
  },
});

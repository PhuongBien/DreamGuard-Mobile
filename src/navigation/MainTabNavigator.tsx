// ============================================================
// KBS Staff App — Main Tab Navigator (Clean Version)
// ============================================================

import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import type { MainTabParamList } from "../types/navigation";
import TaskStackNavigator from "./TaskStackNavigator";
import NotificationStackNavigator from "./NotificationStackNavigator";
import ProfileStackNavigator from "./ProfileStackNavigator";
import {
  NotificationBadgeProvider,
  useNotificationBadge,
} from "../context/NotificationBadgeContext";

import { Colors } from "../constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabBarScreens() {
  const { user } = useAuth();
  const { showUnreadDot, refreshBadge } = useNotificationBadge();

  useEffect(() => {
    if (!user) return;
    void refreshBadge();
  }, [user?.id, refreshBadge]);

  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => void refreshBadge(), 60_000);
    return () => clearInterval(id);
  }, [user?.id, refreshBadge]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: Colors.primary700,
        tabBarInactiveTintColor: Colors.primary300,

        tabBarStyle: {
          height: 60,
          paddingBottom: 6,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{
          tabBarLabel: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="list-box"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationStackNavigator}
        options={{
          tabBarLabel: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <View style={styles.notifIconWrap}>
              <Ionicons
                name="notifications-outline"
                size={size}
                color={color}
              />
              {showUnreadDot ? <View style={styles.unreadDot} /> : null}
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="person-circle-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function MainTabNavigator() {
  return (
    <NotificationBadgeProvider>
      <MainTabBarScreens />
    </NotificationBadgeProvider>
  );
}

const styles = StyleSheet.create({
  notifIconWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadDot: {
    position: "absolute",
    top: 2,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
});

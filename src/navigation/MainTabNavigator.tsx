// ============================================================
// KBS Staff App — Main Tab Navigator (Clean Version)
// ============================================================

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import type { MainTabParamList } from "../types/navigation";
import TaskStackNavigator from "./TaskStackNavigator";
import NotificationsScreen from "../screens/NotificationsScreen";
import ProfileStackNavigator from "./ProfileStackNavigator";

import { Colors } from "../constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { user } = useAuth();

  // 👉 Có thể dùng sau nếu cần ẩn/hiện tab theo role
  const isCleaner = user?.role === "cleaner";

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
      {/* ================= TASKS ================= */}
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

      {/* ================= NOTIFICATIONS ================= */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: "Notifications",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="notifications-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ================= PROFILE ================= */}
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
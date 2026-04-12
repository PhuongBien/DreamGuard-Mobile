// ============================================================
// KBS Staff App — Main Tab Navigator
// ============================================================

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { MainTabParamList } from "../types/navigation";
import TaskStackNavigator from "./TaskStackNavigator";
import NotificationsScreen from "../screens/NotificationsScreen";
import RatingsScreen from "../screens/RatingsScreen";
import ProfileScreen from "../screens/ProfileScreen";

import { Colors } from "../constants/theme";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { user } = useAuth();
  const showRatingsTab = user?.role === "cleaner";

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // 🔥 Quan trọng: để Stack xử lý header

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
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="notifications-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

      {/* ================= RATINGS ================= */}
      {showRatingsTab ? (
        <Tab.Screen
          name="Ratings"
          component={RatingsScreen}
          options={{
            tabBarLabel: "My Ratings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="star-outline" size={size} color={color} />
            ),
          }}
        />
      ) : null}

      {/* ================= PROFILE ================= */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
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
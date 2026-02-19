import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootTabParamList } from '../types/navigation';
import TaskStackNavigator from './TaskStackNavigator';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';

import { Colors, Typography } from '../constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        // ================= TAB BAR =================
        tabBarActiveTintColor: Colors.primary700,
        tabBarInactiveTintColor: Colors.primary300,
        tabBarStyle: {
          height: 60,
          paddingBottom: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },

        // ================= HEADER =================
        headerTitleAlign: 'center',
        headerTintColor: Colors.white,
        headerShadowVisible: false,

        headerTitleStyle: {
          fontSize: Typography.lg,
          fontWeight: '700',
        },

        headerBackground: () => (
          <View
            style={{
              flex: 1,
              backgroundColor: Colors.primary900,
              // borderBottomLeftRadius: 20,
              // borderBottomRightRadius: 20,
              elevation: 6, // Android shadow
              shadowColor: '#000', // iOS shadow
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
            }}
          />
        ),
      }}
    >
      {/* ================= TASKS ================= */}
      <Tab.Screen
        name="Tasks"
        component={TaskStackNavigator}
        options={{
          headerShown: false,
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ focused }) =>
            focused ? (
              <MaterialCommunityIcons
                name="list-box"
                size={24}
                color={Colors.primary800}
              />
            ) : (
              <MaterialIcons
                name="list-alt"
                size={24}
                color={Colors.primary300}
              />
            ),
        }}
      />

      {/* ================= NOTIFICATIONS ================= */}
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: false,
          title: 'Notifications',
          tabBarLabel: 'Notifications',
          tabBarIcon: ({ focused }) =>
            focused ? (
              <Ionicons
                name="notifications"
                size={24}
                color={Colors.primary800}
              />
            ) : (
              <Ionicons
                name="notifications-outline"
                size={24}
                color={Colors.primary300}
              />
            ),
        }}
      />

      {/* ================= PROFILE ================= */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'My Profile',
          tabBarLabel: 'Profile',

          headerRight: () => (
            <Ionicons
              name="settings-outline"
              size={22}
              color={Colors.white}
              style={{ marginRight: 16 }}
            />
          ),

          tabBarIcon: ({ focused }) =>
            focused ? (
              <Ionicons
                name="person-circle"
                size={24}
                color={Colors.primary800}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={24}
                color={Colors.primary300}
              />
            ),
        }}
      />
    </Tab.Navigator>
  );
}
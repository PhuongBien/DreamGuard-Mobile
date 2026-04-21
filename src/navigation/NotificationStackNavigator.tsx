import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import type { NotificationStackParamList } from "../types/navigation";
import NotificationsScreen from "../screens/NotificationsScreen";
import NotificationDetailScreen from "../screens/NotificationDetailScreen";

const Stack = createNativeStackNavigator<NotificationStackParamList>();

export default function NotificationStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NotificationList" component={NotificationsScreen} />
      <Stack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
      />
    </Stack.Navigator>
  );
}

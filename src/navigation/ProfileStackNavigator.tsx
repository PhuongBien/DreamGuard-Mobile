import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ProfileStackParamList } from "../types/navigation";
import ProfileScreen from "../screens/ProfileScreen";
import RatingsScreen from "../screens/RatingsScreen";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="Ratings" component={RatingsScreen} />
    </Stack.Navigator>
  );
}

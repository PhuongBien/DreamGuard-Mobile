// KBS Staff App — Task Stack Navigator (Refactored Architecture)

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

// import { defaultStackOptions } from "./navigationOptions";
import { TaskStackParamList } from "../types/navigation";

import TaskListScreen from "../screens/task/TaskListScreen";
import TaskDetailScreen from "../screens/task/TaskDetailScreen";
import CheckInOutScreen from "../screens/task/CheckInOutScreen";
import {PhotoUploadScreen} from "../screens/task/PhotoUploadScreen";
import AddNoteScreen from "../screens/task/AddNoteScreen";
import DeliveryTaskListScreen from "../screens/task/DeliveryTaskListScreen";
import DeliveryTaskDetailScreen from "../screens/task/DeliveryTaskDetailScreen";
import DeliveryPhotoCaptureScreen from "../screens/task/DeliveryPhotoCaptureScreen";
import { useAuth } from "../context/AuthContext";

const Stack = createNativeStackNavigator<TaskStackParamList>();

// ================= NAVIGATOR =================

export default function TaskStackNavigator() {
  const { user } = useAuth();
  const isDeliveryStaff = user?.role === "delivery_driver";

  return (
    <Stack.Navigator screenOptions={{}}>
      {/* ================= TASK LIST ================= */}
      <Stack.Screen
        name="TaskList"
        component={isDeliveryStaff ? DeliveryTaskListScreen : TaskListScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* ================= TASK DETAIL ================= */}
      <Stack.Screen
        name="TaskDetail"
        component={isDeliveryStaff ? DeliveryTaskDetailScreen : TaskDetailScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* ================= CHECK IN / CHECK OUT ================= */}
      <Stack.Screen
        name="CheckInOut"
        component={CheckInOutScreen}
        options={{
          title: "Check In / Check Out",
        }}
      />

      {/* ================= PHOTO UPLOAD ================= */}
      <Stack.Screen
        name="PhotoUpload"
        component={PhotoUploadScreen}
        options={{
          title: "Upload Photo",
        }}
      />

      <Stack.Screen
        name="DeliveryPhotoCapture"
        component={DeliveryPhotoCaptureScreen}
        options={{
          title: "Capture Evidence",
        }}
      />

      {/* ================= ADD NOTE ================= */}
      <Stack.Screen
        name="AddNote"
        component={AddNoteScreen}
        options={{
          title: "Add Note",
        }}
      />
    </Stack.Navigator>
  );
}
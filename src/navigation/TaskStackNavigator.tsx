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

const Stack = createNativeStackNavigator<TaskStackParamList>();

// ================= NAVIGATOR =================

export default function TaskStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{}}>
      {/* ================= TASK LIST ================= */}
      <Stack.Screen
        name="TaskList"
        component={TaskListScreen}
        options={{
          headerShown: false,
        }}
      />

      {/* ================= TASK DETAIL ================= */}
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
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
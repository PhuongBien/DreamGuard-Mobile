// Navigation Types

import type { NavigatorScreenParams } from "@react-navigation/native";

/**
 * Root navigator (AppNavigator)
 * Quyết định vào Auth hay Main
 */
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

/**
 * Auth flow navigator
 */
export type AuthStackParamList = {
  Login: undefined;
  // ForgotPassword: undefined;
  // ResetPassword: { phoneNumber: string };
};

export type NotificationStackParamList = {
  NotificationList: undefined;
  NotificationDetail: {
    notificationId: string;
    actionType: string;
    message: string;
    createdAt: string;
    isRead: boolean;
  };
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Ratings: undefined;
};

/**
 * Task stack inside Tasks tab
 */
export type TaskStackParamList = {
  TaskList: undefined;

  TaskDetail: {
    taskId?: string;
    shippingTaskId?: string;
    tradeInOrderId?: string;
    orderId?: string;
    type?: "task" | "tradein";
  };

  TradeInDetail: {
    tradeInOrderId: string;
    shippingTaskId?: string;
  };

  PhotoUpload: {
    shippingTaskId: string;
    photoType: "before" | "after";
  };

  DeliveryPhotoCapture: {
    shippingTaskId: string;
    mode: "delivered" | "returned" | "forced_cancelled";
    /** Use trade-in shipping APIs + Cloudinary upload without TaskContext */
    tradeInFlow?: boolean;
    tradeInOrderId?: string;
  };

  CheckInOut: {
    shippingTaskId: string;
  };

  AddNote: {
    shippingTaskId: string;
  };
};

/**
 * Bottom tab navigator
 */
export type MainTabParamList = {
  Tasks: NavigatorScreenParams<TaskStackParamList>;
  Schedule: undefined;
  Notifications: NavigatorScreenParams<NotificationStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};

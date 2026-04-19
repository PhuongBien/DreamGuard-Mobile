// Navigation Types

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

/**
 * Bottom tab navigator
 */
export type MainTabParamList = {
  Tasks: undefined;
  Schedule: undefined;
  Notifications: undefined;
  Profile: undefined;
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
  TaskDetail: { taskId: string; type?: "task" | "tradein" };
  PhotoUpload: { taskId: string; photoType: "before" | "after" };
  DeliveryPhotoCapture: { taskId: string; mode: "delivered" | "returned" };
  CheckInOut: { taskId: string };
  AddNote: { taskId: string };
};
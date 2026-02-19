// ============================================================
// KBS Staff App — Type Definitions
// ============================================================

// ---- Auth ----
export type UserRole =
  | 'delivery_driver'
  | 'cleaner'
  | 'sales_staff'
  | 'warehouse_staff'
  | 'technician'
  | 'manager';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  // avatar?: string;
  department: string;
  employeeCode: string;
  avatarUrl?: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ---- Tasks ----
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export type TaskType =
  | 'delivery'
  | 'pickup'
  | 'cleaning'
  | 'repair'
  | 'trade_in'
  | 'exchange'
  | 'custom_order'
  | 'warehouse_inbound'
  | 'warehouse_outbound'
  | 'sales_consultation';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface TaskPhoto {
  id: string;
  url: string;
  type: 'before' | 'after' | 'evidence';
  uploadedAt: string;
  uploadedBy: string;
}

export interface TaskNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  authorName: string;
}

export interface CheckInOut {
  checkIn?: {
    time: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  checkOut?: {
    time: string;
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  description?: string;
}

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: string;
  assignedToName: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  dueTime?: string;
  customer: CustomerInfo;
  products: ProductItem[];
  photos: TaskPhoto[];
  notes: TaskNote[];
  checkInOut: CheckInOut;
  estimatedDuration?: number; // minutes
  serviceAddress?: string;
  orderRef?: string; // linked website order ID
  tags?: string[];
}

// ---- Notifications ----
export type NotificationType =
  | 'new_task'
  | 'task_updated'
  | 'task_cancelled'
  | 'reminder'
  | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  isRead: boolean;
  createdAt: string;
}

// ---- Navigation ----
export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
};

export type MainTabParamList = {
  Tasks: undefined;
  Schedule: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type TaskStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string };
  PhotoUpload: { taskId: string; photoType: 'before' | 'after' };
  CheckInOut: { taskId: string };
  AddNote: { taskId: string };
};

// ---- API Responses ----
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---- Stats (for manager/dashboard) ----
export interface DailyStats {
  date: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}

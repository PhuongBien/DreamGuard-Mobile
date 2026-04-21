// Notification Types

export type NotificationType =
  | "new_task"
  | "task_updated"
  | "task_cancelled"
  | "reminder"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  taskId?: string;
  shippingTaskId?: string;
  tradeInOrderId?: string;
  isRead: boolean;
  createdAt: string;
}

/** Shape returned by `GET /api/Notifications` */
export interface BackendNotificationItem {
  notificationId: string;
  userId: string;
  actionType: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  user: unknown | null;
}

export interface BackendNotificationsPage {
  items: BackendNotificationItem[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
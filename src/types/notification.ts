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
  isRead: boolean;
  createdAt: string;
}
// Audit Log Types

export interface AuditLog {
  id?: string;
  auditLogId?: string;

  userId?: string;
  createdAt?: string;
  timestamp?: string;

  action?: string;
  title?: string;
  description?: string;
  message?: string;

  entityName?: string;
  entityId?: string;

  // Optional cross-links we can use for navigation.
  taskId?: string;
  serviceTaskId?: string;
  shippingTaskId?: string;

  // Backend-specific payload.
  data?: unknown;
  changes?: unknown;
  [key: string]: unknown;
}


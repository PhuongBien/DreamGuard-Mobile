// KBS Staff App — Format Utilities

import type { TaskPriority, TaskStatus } from "../types/task";

/**
 * Capitalize first letter
 */
export function capitalize(text?: string | null): string {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text?: string | null, maxLength = 50): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  return text.slice(0, maxLength) + "...";
}

/**
 * Format phone number (Vietnam)
 * 0987654321 -> 0987 654 321
 */
export function formatPhone(phone?: string | null): string {
  if (!phone) return "";

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  return phone;
}

/**
 * Format badge count
 * 0 -> ""
 * 5 -> "5"
 * 120 -> "99+"
 */
export function formatBadge(count?: number): string {
  if (!count || count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

/**
 * Format task code
 * 123 -> TASK-000123
 */
export function formatTaskCode(id?: number | string): string {
  if (!id) return "";

  const num = typeof id === "number" ? id : Number(id);
  if (isNaN(num)) return String(id);

  return `TASK-${String(num).padStart(6, "0")}`;
}

/**
 * Priority display text
 */
export function getPriorityLabel(priority?: TaskPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "urgent":
      return "Urgent";
    default:
      return "";
  }
}

/**
 * Priority color
 */
export function getPriorityColor(priority?: TaskPriority): string {
  switch (priority) {
    case "low":
      return "#4CAF50"; // green
    case "medium":
      return "#FF9800"; // orange
    case "high":
      return "#F44336"; // red
    case "urgent":
      return "#B71C1C"; // dark red
    default:
      return "#999";
  }
}

/**
 * Task status display text
 */
export function getStatusLabel(status?: TaskStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "";
  }
}

/**
 * Task status color
 */
export function getStatusColor(status?: TaskStatus): string {
  switch (status) {
    case "pending":
      return "#9E9E9E"; // gray
    case "in_progress":
      return "#2196F3"; // blue
    case "completed":
      return "#4CAF50"; // green
    case "cancelled":
      return "#F44336"; // red
    default:
      return "#999";
  }
}

/**
 * Convert boolean to Yes/No (Vietnamese)
 */
export function formatBoolean(value?: boolean): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

/**
 * Format file size (bytes -> KB/MB)
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 KB";

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
// KBS Staff App — Date Utilities

/**
 * Safely parse date from string or Date
 */
export function parseDate(input?: string | Date | null): Date | null {
  if (!input) return null;

  const date = input instanceof Date ? input : new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date to DD/MM/YYYY
 */
export function formatDate(input?: string | Date | null): string {
  const date = parseDate(input);
  if (!date) return "--/--/----";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Format time to HH:mm
 */
export function formatTime(input?: string | Date | null): string {
  const date = parseDate(input);
  if (!date) return "--:--";

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

/**
 * Format full date time DD/MM/YYYY HH:mm
 */
export function formatDateTime(input?: string | Date | null): string {
  const date = parseDate(input);
  if (!date) return "--/--/---- --:--";

  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * Check if a date is overdue (before now)
 */
export function isOverdue(input?: string | Date | null): boolean {
  const date = parseDate(input);
  if (!date) return false;

  return date.getTime() < Date.now();
}

/**
 * Check if a date is today
 */
export function isToday(input?: string | Date | null): boolean {
  const date = parseDate(input);
  if (!date) return false;

  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Return relative time (e.g., "5 minutes ago", "2 hours ago")
 */
export function timeAgo(input?: string | Date | null): string {
  const date = parseDate(input);
  if (!date) return "";

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;

  return formatDate(date);
}

/**
 * Combine date (YYYY-MM-DD) and time (HH:mm) into ISO string
 */
export function combineDateAndTime(
  dateString: string,
  timeString?: string
): string {
  if (!timeString) {
    return new Date(dateString).toISOString();
  }

  const combined = new Date(`${dateString}T${timeString}`);
  return combined.toISOString();
}

/**
 * Format duration in minutes to readable text
 * Example: 90 -> "1h 30m"
 */
export function formatDuration(minutes?: number): string {
  if (!minutes || minutes <= 0) return "0m";

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
}

/**
 * Calculate duration in minutes between 2 ISO date strings
 */
export function calculateDurationMinutes(
  start?: string | Date | null,
  end?: string | Date | null
): number {
  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) return 0;

  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diff / 60000));
}
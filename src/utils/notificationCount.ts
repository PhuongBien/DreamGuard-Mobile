import { fetchNotifications, fetchUnreadCount } from "./api";

/**
 * Số thông báo chưa đọc: ưu tiên GET unread-count, fallback đếm từ danh sách.
 */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const res = await fetchUnreadCount();
    const data = res.data as unknown;
    if (typeof data === "number" && Number.isFinite(data)) {
      return Math.max(0, data);
    }
    if (data && typeof data === "object" && "count" in data) {
      const c = (data as { count?: unknown }).count;
      if (typeof c === "number" && Number.isFinite(c)) {
        return Math.max(0, c);
      }
    }
  } catch {
    // fall through
  }

  try {
    const res = await fetchNotifications(1, 50);
    const items = res.data?.items ?? [];
    return items.filter((row: { isRead?: boolean }) => !row.isRead).length;
  } catch {
    return 0;
  }
}

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

import { getUnreadNotificationCount } from "../utils/notificationCount";

type NotificationBadgeContextValue = {
  /** Chấm đỏ trên icon tab */
  showUnreadDot: boolean;
  /** Đồng bộ số unread từ API (và cập nhật baseline khi count giảm) */
  refreshBadge: () => Promise<number>;
  /** Gọi khi user đã vào xem tab Notifications (sau khi refresh xong) */
  acknowledgeTabViewed: (unreadAfterVisit: number) => void;
};

const NotificationBadgeContext =
  createContext<NotificationBadgeContextValue | null>(null);

export function NotificationBadgeProvider({ children }: { children: ReactNode }) {
  const [lastUnread, setLastUnread] = useState(0);
  /** null = chưa từng vào tab Notifications lần nào trong session */
  const [unreadAtLastVisit, setUnreadAtLastVisit] = useState<number | null>(
    null,
  );

  const refreshBadge = useCallback(async () => {
    const n = await getUnreadNotificationCount();
    setLastUnread(n);
    setUnreadAtLastVisit((prev) => {
      if (prev === null) return null;
      if (n < prev) return n;
      return prev;
    });
    return n;
  }, []);

  const acknowledgeTabViewed = useCallback((unreadAfterVisit: number) => {
    setUnreadAtLastVisit(unreadAfterVisit);
  }, []);

  const showUnreadDot = useMemo(() => {
    if (lastUnread <= 0) return false;
    if (unreadAtLastVisit === null) return true;
    return lastUnread > unreadAtLastVisit;
  }, [lastUnread, unreadAtLastVisit]);

  const value = useMemo(
    () => ({
      showUnreadDot,
      refreshBadge,
      acknowledgeTabViewed,
    }),
    [showUnreadDot, refreshBadge, acknowledgeTabViewed],
  );

  return (
    <NotificationBadgeContext.Provider value={value}>
      {children}
    </NotificationBadgeContext.Provider>
  );
}

export function useNotificationBadge() {
  const ctx = useContext(NotificationBadgeContext);
  if (!ctx) {
    throw new Error(
      "useNotificationBadge must be used within NotificationBadgeProvider",
    );
  }
  return ctx;
}

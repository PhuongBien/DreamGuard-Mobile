import type { UserRole } from "../types/user";

export type NotificationDeepLink = {
  taskId?: string;
  shippingTaskId?: string;
  tradeInOrderId?: string;
};

const GUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

/**
 * Derive navigation targets from backend notification text.
 * Trade-in order messages take precedence over generic task UUIDs.
 */
export function parseNotificationDeepLink(
  message: string,
  actionType: string,
  role: UserRole | undefined,
): NotificationDeepLink {
  const isDelivery = role === "delivery_driver";

  const tradeInOrderMatch =
    /trade-?in\s+order\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(
      message,
    );
  if (tradeInOrderMatch) {
    return { tradeInOrderId: tradeInOrderMatch[1] };
  }

  const yourTaskMatch =
    /(?:your\s+)?task\s+([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i.exec(
      message,
    );
  if (yourTaskMatch) {
    const id = yourTaskMatch[1];
    if (isDelivery) {
      return { shippingTaskId: id };
    }
    return { taskId: id };
  }

  const lowerAction = actionType.toLowerCase();
  const lowerMsg = message.toLowerCase();
  if (
    isDelivery &&
    (lowerAction.includes("shipping") ||
      lowerAction.includes("deliver") ||
      lowerMsg.includes("shipping task"))
  ) {
    const m = message.match(GUID);
    if (m) {
      return { shippingTaskId: m[0] };
    }
  }

  return {};
}

export function hasNotificationDeepLink(link: NotificationDeepLink): boolean {
  return !!(
    link.taskId ||
    link.shippingTaskId ||
    link.tradeInOrderId
  );
}

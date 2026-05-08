export const normalizeTradeInStatus = (status?: string): TradeInUIStatus => {
  const s = status?.toLowerCase();

  switch (s) {
    case "pending":
      return "pending";

    case "confirmed":
      return "confirmed";

    case "readyfordelivery":
    case "ready_for_delivery":
      return "ready_for_delivery";

    case "processing":
    case "inprogress":
      return "processing";

    case "delivered":
      return "delivered";

    case "returning":
      return "returning";

    case "completed":
      return "completed";

    case "cancelled":
    case "canceled":
    case "forcedcancelled":
    case "admincancelled":
    case "admin_cancelled":
      return "cancelled";

    default: {
      const compact = (s ?? "").replace(/[\s_-]/g, "");
      if (compact.includes("cancel")) return "cancelled";
      return "pending";
    }
  }
};

export type TradeInUIStatus =
  | "pending"
  | "confirmed"
  | "ready_for_delivery"
  | "processing"
  | "delivered"
  | "returning"
  | "completed"
  | "cancelled";

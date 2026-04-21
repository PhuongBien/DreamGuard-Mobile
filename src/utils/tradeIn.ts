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
    case "forcedcancelled":
      return "cancelled";

    default:
      return "pending";
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

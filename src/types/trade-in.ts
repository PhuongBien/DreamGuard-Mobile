// ============================================
// Trade-in Status (map từ backend)
// ============================================
export type TradeInOrderStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "completed"
  | "cancelled";

// Backend raw status (optional nếu bạn muốn map riêng)
export type TradeInBackendStatus =
  | "RETURNING"
  | "COMPLETED"
  | "CANCELLED"
  | "PENDING";

// ============================================
// Payment
// ============================================
export interface TradeInPayment {
  id: string;
  orderCode: string;
  paymentType: string;
  status: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

// ============================================
// Order Item
// ============================================
export interface TradeInOrderItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  tradeInUsedAmount?: number;
}

// ============================================
// Product Variant
// ============================================
export interface TradeInProductVariant {
  id: string;
  sku: string;
  basePrice: number;
  salePrice: number;
  size?: string;
}

// ============================================
// Image
// ============================================
export interface TradeInImage {
  id?: string;
  imageUrl: string;
}

// ============================================
// MAIN TYPE (MATCH BACKEND)
// ============================================
export interface TradeInOrder {
  tradeInOrderId: string;

  customerId?: string;
  orderId?: string;

  orderCode: string;
  status: string; // raw backend status

  receiverName: string;
  phoneNumber: string;
  address: string;

  description?: string;

  tradeInPrice?: number;
  amountToPay?: number;
  depositAmount?: number;
  isGood?: boolean;
  oldProductVariantUrl?: string;
  newProductVariantUrl?: string;

  createdAt: string;
  updatedAt?: string;

  // relations
  payments?: TradeInPayment[];
  orderItem?: TradeInOrderItem;
  productVariant?: TradeInProductVariant;

  tradeInImages?: TradeInImage[];
}

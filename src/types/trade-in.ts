export type TradeInOrderStatus =
  | "pending"
  | "confirmed"
  | "ready_for_delivery"
  | "processing"
  | "delivered"
  | "completed"
  | "cancelled";

export interface TradeInCustomerInfo {
  id?: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export interface TradeInProductInfo {
  id?: string;
  name: string;
  model?: string;
  type?: string;
  description?: string;
  quantity?: number;
  estimatedPrice?: number;
}

export interface TradeInDeviceInfo {
  oldDevice?: TradeInProductInfo;
  newDevice?: TradeInProductInfo;
}

export interface TradeInOrder {
  id: string;
  tradeInOrderId?: string;
  orderCode: string;
  status: TradeInOrderStatus;
  
  customer: TradeInCustomerInfo;
  devices: TradeInDeviceInfo;
  
  priceAgreed?: number;
  notes?: string;
  
  createdAt?: string;
  updatedAt?: string;
  
  // Timeline tracking
  processingStartedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  
  // For display and interaction
  assignedTo?: string;
  assignedToName?: string;
  
  // Related images
  photos?: Array<{
    id?: string;
    url: string;
    type?: "device_condition" | "pickup_evidence" | "other";
    uploadedAt?: string;
  }>;
}

export interface TradeInOrderListParams {
  page?: number;
  pageSize?: number;
  status?: TradeInOrderStatus | "all";
  search?: string;
  orderCode?: string;
}

export interface TradeInOrderSearchParams {
  status?: TradeInOrderStatus;
  orderCode?: string;
  customerPhone?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface TradeInStatusUpdatePayload {
  status: TradeInOrderStatus;
  notes?: string;
  images?: Array<{
    url: string;
    type?: string;
  }>;
}

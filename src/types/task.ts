import type { BackendStaffRole, UserRole } from "./user";

export type TaskStatus =
  | "pending"
  | "reschedule"
  | "delivering"
  | "arrived"
  | "checked_in"
  | "in_progress"
  | "checked_out"
  | "delivered"
  | "returned"
  | "exchange_requested"
  | "completed"
  | "cancelled"
  | "on_hold";

export type TaskFilter = "all" | TaskStatus;

export type TaskType =
  | "delivery"
  | "pickup"
  | "cleaning"
  | "repair"
  | "trade_in"
  | "exchange"
  | "custom_order"
  | "warehouse_inbound"
  | "warehouse_outbound"
  | "sales_consultation";

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type DeliveryEvidenceStage =
  | "start_delivery"
  | "delivery_success"
  | "delivery_failed";

export interface TaskPhoto {
  id: string;
  url: string;
  type: "before" | "after" | "payment" | "evidence";
  uploadedAt: string;
  uploadedBy: string;
  captureStage?: DeliveryEvidenceStage;
}

export interface TaskNote {
  id: string;
  content: string;
  createdAt: string;
  createdBy: string;
  authorName: string;
}

export interface CheckInInfo {
  time: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface CheckOutInfo {
  time: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  note?: string;
  durationMinutes: number;
}

export interface TaskCheckInOut {
  checkIn?: CheckInInfo;
  checkOut?: CheckOutInfo;
}

export interface DeliveryTimeline {
  deliveringAt?: string;
  arrivedAt?: string;
  deliveredAt?: string;
  returnedAt?: string;
}

export interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
}

export interface ProductItem {
  id: string;
  /** Stable order item id (matches damagedItems.orderItemId) when available. */
  orderItemId?: string;
  name: string;
  type: string;
  /** Quantity to show by default (fallback). */
  quantity: number;
  description?: string;

  /**
   * Optional raw quantities (BE varies by order type).
   * Used mainly for exchange/request delivery display rules.
   */
  totalQuantity?: number;
  exchangeQuantity?: number;
  requestedQuantity?: number;
  returnedQuantity?: number;
}

export interface ServiceProductType {
  productTypeId: string;
  productTypeName: string;
  isActive?: boolean;
  addPrice?: number;
  createdAt?: string;
}

export interface ServicePackage {
  servicePackageId: string;
  packageName: string;
  status?: string;
  duration?: number;
  suitableFor?: string;
  benefits?: string;
  serviceContent?: string;
  imageUrl?: string;
  publicId?: string;
}

export interface ServicePackageMapping {
  servicePackageMappingId: string;
  productTypeId?: string;
  servicePackageId?: string;
  duration?: number;
  price?: number;
  productType?: ServiceProductType;
  servicePackage?: ServicePackage;
}

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  description: string;

  type?: TaskType;
  status: TaskStatus;
  /** Raw shipping status from backend (e.g. Returned/Returning/ExchangeRequested). */
  rawShippingStatus?: string;
  priority?: TaskPriority;

  assignedTo?: string;
  assignedToName?: string;
  assignmentKeys?: string[];
  assignedRole?: UserRole;
  assignedBackendRole?: BackendStaffRole;

  createdAt?: string;
  updatedAt?: string;

  dueDate: string;
  dueTime?: string;

  estimatedDuration?: number;

  orderId?: string;
  /** Primary line item label from API (e.g. order itemName) for list/detail display */
  itemName?: string;
  tags?: string[];
  serviceOrderStatus?: string;
  serviceOrderId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  /** Delivery COD: photo proving payment was collected */
  paymentEvidenceUrl?: string;
  totalPrice?: number;
  customerNote?: string;
  appointmentDateRaw?: string;
  isRescheduledAppointment?: boolean;
  /** Service task superseded after reschedule — wait for manager to spin up work on a new row */
  rescheduleAwaitingNewTask?: boolean;

  customer: CustomerInfo;
  products?: ProductItem[];
  /** ShippingTasks returned/exchange payload */
  damagedItems?: Array<{
    orderItemId: string;
    damagedQuantity: number;
  }>;
  servicePackageMapping?: ServicePackageMapping;

  photos?: TaskPhoto[];
  notes?: TaskNote[];
  checkInOut?: TaskCheckInOut;
  deliveryTimeline?: DeliveryTimeline;

  rating?: {
    id?: string;
    score: number;
    comment?: string | null;
    customerName?: string | null;
    createdAt?: string | null;
  } | null;

  deliveryFailureReason?: string;
  relatedImageUrls?: string[];

  isSynced?: boolean;
}

export interface ShippingTask {
  shippingTaskId: string;
  staffId: string;
  orderId?: string | null;
  tradeInOrderId?: string | null;
  orderCode?: string;
  status: string;

  shippingDate?: string | null;
  completionDate?: string | null;
  staffNote?: string;

  evidences: any[];
}

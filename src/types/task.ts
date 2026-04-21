import type { BackendStaffRole, UserRole } from "./user";

export type TaskStatus =
  | "pending"
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
  type: "before" | "after" | "evidence";
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
  name: string;
  type: string;
  quantity: number;
  description?: string;
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
  paymentMethod?: string;
  paymentStatus?: string;
  totalPrice?: number;
  customerNote?: string;
  appointmentDateRaw?: string;

  customer: CustomerInfo;
  products?: ProductItem[];
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

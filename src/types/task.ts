export type TaskStatus =
  | "pending"
  | "checked_in"
  | "in_progress"
  | "checked_out"
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

export interface TaskPhoto {
  id: string;
  url: string;
  type: "before" | "after" | "evidence";
  uploadedAt: string;
  uploadedBy: string;
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

createdAt?: string;
updatedAt?: string;

  dueDate: string;
  dueTime?: string;

  estimatedDuration?: number;

  orderRef?: string;
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

  isSynced?: boolean;
}
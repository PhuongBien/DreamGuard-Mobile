// API Response Types

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StaffProfile {
  staffId: string;
  fullName: string;
  address?: string;
  avatarUrl?: string;
  position?: string;
  gender?: string;
  dateOfBirth?: string;
  status?: string;
  phoneNumber?: string;
  email?: string;
  averageRating?: number;
  totalRating?: number;
}

export interface VariantDetail {
  id: string;
  sku: string;
  basePrice?: number;
  salePrice?: number;
  weight?: number;
  attributes?: Record<string, any>;
  size?: string;
  isNew?: boolean;
  isCustomizable?: boolean;
  status?: string;
  createdAt?: string;
  productId?: string;
  stockQuantity?: number;
  defectQuantity?: number;
  stockStatus?: string;
  customizeOptionGroups?: any[];
}

export interface PaymentHistoryItem {
  id: string;
  orderCode: string;
  paymentType?: string;
  status?: string;
  amount?: number;
  paymentMethod?: string;
  createdAt?: string;
}

export interface PaginatedPaymentHistory {
  items: PaymentHistoryItem[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

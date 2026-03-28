// User Types

export type UserRole =
  | "delivery_driver"
  | "cleaner"
  | "sales_staff"
  | "warehouse_staff"
  | "technician"
  | "manager";

export type BackendGender = "Male" | "Female" | "Other" | string;

export type BackendStaffRole = string;

export interface User {
  // App-normalized identity fields
  id: string;
  name: string;

  // Backend-compatible identity aliases
  userId?: string;
  fullName?: string;

  email: string;
  phone: string;
  phoneNumber?: string;

  // App role used by UI/business logic
  role: UserRole;

  // Backend profile fields
  backendRole?: BackendStaffRole;
  gender?: BackendGender;
  dateOfBirth?: string;
  address?: string;
  position?: string;

  // Optional org metadata used in profile screen
  department?: string;
  employeeCode?: string;

  avatarUrl?: string | null;
}
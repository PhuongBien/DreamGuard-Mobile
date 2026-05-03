import { User } from "../types";
import {
  authLogin,
  // authForgotPassword,
  // authResetPassword,
  authLogout,
  fetchStaffProfile,
  fetchStaffs,
  AuthLoginPayload,
  // AuthForgotPayload,
  // AuthResetPayload,
} from "../utils/api";

const isGuid = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const parseJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const getUserIdFromClaims = (
  claims: Record<string, any> | null,
): string | null => {
  if (!claims) return null;

  const candidates = [
    claims[
      "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
    ],
    claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"],
    claims["http://schemas.microsoft.com/identity/claims/objectidentifier"],
    claims.staffId,
    claims.staff_id,
    claims.userId,
    claims.user_id,
    claims.nameid,
    claims.sub,
    claims.uid,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeRole = (rawRole?: string): User["role"] => {
  const value = (rawRole || "").toLowerCase().trim();

  if (value.includes("delivery")) return "delivery_driver";
  if (value.includes("clean")) return "cleaner";
  if (value.includes("warehouse")) return "warehouse_staff";
  if (value.includes("technic")) return "technician";
  if (value.includes("manager")) return "manager";

  return "sales_staff";
};

const getPreferredName = (
  payloadUser: Record<string, any> | undefined,
  payload: Record<string, any>,
  fallbackPhone: string,
) => {
  const candidates = [
    payloadUser?.fullName,
    payloadUser?.fullname,
    payloadUser?.displayName,
    payloadUser?.name,
    payload?.fullName,
    payload?.fullname,
    payload?.displayName,
    payload?.name,
  ];

  const resolved = candidates.find(
    (value) => typeof value === "string" && value.trim().length > 0,
  ) as string | undefined;

  return resolved?.trim() || fallbackPhone;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const toNullableString = (value: unknown): string | null | undefined => {
  if (value == null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || null;
};

const toNormalizedUserFromStaff = (
  input: Record<string, any>,
  fallback: User,
): User => {
  const resolvedId =
    toOptionalString(input.staffId) ||
    toOptionalString(input.id) ||
    toOptionalString(input.userId) ||
    fallback.id;

  const resolvedPhone =
    toOptionalString(input.phoneNumber) ||
    toOptionalString(input.phone) ||
    fallback.phone;

  const resolvedName =
    toOptionalString(input.fullName) ||
    toOptionalString(input.name) ||
    fallback.name ||
    resolvedPhone;

  return {
    ...fallback,
    id: resolvedId,
    userId: resolvedId,
    name: resolvedName,
    fullName: toOptionalString(input.fullName) || resolvedName,
    email: toOptionalString(input.email) || fallback.email,
    phone: resolvedPhone,
    phoneNumber: resolvedPhone,
    role: normalizeRole(
      toOptionalString(input.role) ||
        toOptionalString(input.roleName) ||
        toOptionalString(input.position) ||
        fallback.backendRole,
    ),
    backendRole:
      toOptionalString(input.role) ||
      toOptionalString(input.roleName) ||
      fallback.backendRole,
    gender: toOptionalString(input.gender) || fallback.gender,
    dateOfBirth: toOptionalString(input.dateOfBirth) || fallback.dateOfBirth,
    address: toOptionalString(input.address) || fallback.address,
    position: toOptionalString(input.position) || fallback.position,
    department: toOptionalString(input.department) || fallback.department,
    employeeCode: toOptionalString(input.employeeCode) || fallback.employeeCode,
    avatarUrl: toNullableString(input.avatarUrl) ?? fallback.avatarUrl,
  };
};

const pickStaffCandidates = (payload: any): Record<string, any>[] => {
  if (Array.isArray(payload)) {
    return payload.filter(
      (item) => typeof item === "object" && item !== null,
    ) as Record<string, any>[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const knownArrayKeys = ["items", "data", "results", "staffs", "staff"];
  for (const key of knownArrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(
        (item) => typeof item === "object" && item !== null,
      ) as Record<string, any>[];
    }
  }

  return [payload as Record<string, any>];
};

const findMatchingStaff = (
  staffs: Record<string, any>[],
  currentUser: User,
) => {
  const currentId = currentUser.id?.toLowerCase?.() || "";
  const currentUserId = currentUser.userId?.toLowerCase?.() || "";
  const currentPhone = (
    currentUser.phone ||
    currentUser.phoneNumber ||
    ""
  ).toLowerCase();
  const currentEmployeeCode = (currentUser.employeeCode || "").toLowerCase();

  return staffs.find((staff) => {
    const staffId = (
      toOptionalString(staff.staffId) ||
      toOptionalString(staff.id) ||
      toOptionalString(staff.userId) ||
      ""
    ).toLowerCase();
    const staffPhone = (
      toOptionalString(staff.phoneNumber) ||
      toOptionalString(staff.phone) ||
      ""
    ).toLowerCase();
    const staffEmployeeCode = (
      toOptionalString(staff.employeeCode) || ""
    ).toLowerCase();

    if (staffId && (staffId === currentId || staffId === currentUserId))
      return true;
    if (staffPhone && currentPhone && staffPhone === currentPhone) return true;
    if (
      staffEmployeeCode &&
      currentEmployeeCode &&
      staffEmployeeCode === currentEmployeeCode
    )
      return true;

    return false;
  });
};

export const loginService = async (
  phoneNumber: string,
  password: string,
): Promise<{ token: string; refreshToken: string; user: User }> => {
  const response = await authLogin({ phoneNumber, password });

  if (!response.success) {
    throw new Error(response.message || "Login failed");
  }

  const payload = (response.data || {}) as Record<string, any>;

  const token = (payload.accessToken || payload.token || "").trim();
  const refreshToken = (
    payload.refreshToken ||
    payload.refresh_token ||
    ""
  ).trim();

  if (!token) {
    throw new Error("Login response missing token");
  }

  const claims = parseJwtPayload(token);
  const claimUserId = getUserIdFromClaims(claims);

  const payloadUser = payload.user as Record<string, any> | undefined;
  const payloadUserIdCandidates = [
    payload?.staffId,
    payload?.staff_id,
    payload?.userId,
    payload?.user_id,
    payloadUser?.id,
    payloadUser?.staffId,
    payloadUser?.staff_id,
    payloadUser?.userId,
    payloadUser?.user_id,
  ];

  const payloadUserId = payloadUserIdCandidates.find(
    (value) => typeof value === "string" && value.trim(),
  ) as string | undefined;

  const resolvedUserId =
    (payloadUserId && payloadUserId.trim()) ||
    (claimUserId && claimUserId.trim()) ||
    phoneNumber;

  const name = getPreferredName(payloadUser, payload, phoneNumber);
  const normalizedPhone =
    (payloadUser?.phone as string | undefined) ||
    (payloadUser?.phoneNumber as string | undefined) ||
    (payload.phoneNumber as string | undefined) ||
    phoneNumber;

  const user: User = {
    id: resolvedUserId,
    userId: resolvedUserId,
    name,
    fullName:
      (payloadUser?.fullName as string | undefined) ||
      (payload.fullName as string | undefined) ||
      name,
    email:
      (payloadUser?.email as string | undefined) ||
      (payload.email as string | undefined) ||
      "",
    phone: normalizedPhone,
    phoneNumber: normalizedPhone,
    role: normalizeRole(
      (payloadUser?.role as string | undefined) ||
        (payloadUser?.position as string | undefined) ||
        (payload.roleName as string | undefined),
    ),
    backendRole:
      (payloadUser?.role as string | undefined) ||
      (payload.role as string | undefined) ||
      (payload.roleName as string | undefined),
    gender:
      (payloadUser?.gender as string | undefined) ||
      (payload.gender as string | undefined),
    dateOfBirth:
      (payloadUser?.dateOfBirth as string | undefined) ||
      (payload.dateOfBirth as string | undefined),
    address:
      (payloadUser?.address as string | undefined) ||
      (payload.address as string | undefined),
    position:
      (payloadUser?.position as string | undefined) ||
      (payload.position as string | undefined),
    department:
      (payloadUser?.department as string | undefined) ||
      (payload.department as string | undefined) ||
      "",
    employeeCode:
      (payloadUser?.employeeCode as string | undefined) ||
      (payload.employeeCode as string | undefined) ||
      "",
    avatarUrl:
      (payloadUser?.avatarUrl as string | undefined) ||
      (payloadUser?.avatar as string | undefined) ||
      null,
  };

  if (isGuid(resolvedUserId) && user.id !== resolvedUserId) {
    user.id = resolvedUserId;
  }

  let resolvedUser = user;

  try {
    resolvedUser = await getStaffProfileService(user);
  } catch {
    resolvedUser = user;
  }

  return {
    token,
    refreshToken,
    user: resolvedUser,
  };
};

export const logoutService = async () => {
  const response = await authLogout();

  if (!response.success) {
    throw new Error(response.message || "Logout failed");
  }

  return response.data;
};

export const getStaffProfileService = async (
  currentUser: User,
): Promise<User> => {
  try {
    const profileResponse = await fetchStaffProfile();

    if (profileResponse.success && profileResponse.data) {
      const directProfile = Array.isArray(profileResponse.data)
        ? profileResponse.data[0]
        : profileResponse.data;

      if (directProfile && typeof directProfile === "object") {
        return toNormalizedUserFromStaff(directProfile, currentUser);
      }
    }
  } catch {
    // Some roles may not be allowed to read the dedicated profile endpoint.
  }

  const response = await fetchStaffs({ pageNumber: 1, pageSize: 200 });

  if (!response.success) {
    throw new Error(response.message || "Failed to fetch staff profile");
  }

  const candidates = pickStaffCandidates(response.data);
  if (!candidates.length) return currentUser;

  const matched = findMatchingStaff(candidates, currentUser);
  return matched
    ? toNormalizedUserFromStaff(matched, currentUser)
    : currentUser;
};

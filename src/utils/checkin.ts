// KBS Staff App — Check-in / Check-out Business Logic

import type { Task } from "../types/task";

export interface CheckInPayload {
  time: string; // ISO string
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface CheckOutPayload {
  time: string; // ISO string
  note?: string;
  durationMinutes: number;
}

/**
 * Check if user can check-in
 */
export function canCheckIn(task: Task): boolean {
  if (!task) return false;

  if (task.status === "completed" || task.status === "cancelled") {
    return false;
  }

  if (task.checkInOut?.checkIn) {
    return false; // already checked in
  }

  return true;
}

/**
 * Check if user can check-out
 */
export function canCheckOut(task: Task): boolean {
  if (!task) return false;

  if (!task.checkInOut?.checkIn) {
    return false; // chưa check-in
  }

  if (task.checkInOut?.checkOut) {
    return false; // đã checkout
  }

  return true;
}

/**
 * Create check-in payload
 */
export function createCheckInPayload(
  address: string,
  latitude?: number,
  longitude?: number
): CheckInPayload {
  if (!address) {
    throw new Error("Invalid check-in address");
  }

  return {
    time: new Date().toISOString(),
    address,
    latitude,
    longitude,
  };
}

/**
 * Calculate duration in minutes
 */
export function calculateDurationMinutes(
  checkInTime: string,
  checkOutTime: string
): number {
  const start = new Date(checkInTime).getTime();
  const end = new Date(checkOutTime).getTime();

  if (isNaN(start) || isNaN(end)) return 0;

  const diffMs = end - start;
  const diffMinutes = Math.floor(diffMs / 1000 / 60);

  return diffMinutes > 0 ? diffMinutes : 0;
}

/**
 * Create check-out payload
 */
export function createCheckOutPayload(
  checkInTime: string,
  note?: string
): CheckOutPayload {
  const checkOutTime = new Date().toISOString();

  const duration = calculateDurationMinutes(checkInTime, checkOutTime);

  return {
    time: checkOutTime,
    note: note?.trim(),
    durationMinutes: duration,
  };
}
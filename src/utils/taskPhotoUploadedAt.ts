import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Task } from "../types";
import { toIsoUtcOrEmpty } from "./date";

const STORAGE_PREFIX = "@dg_task_photo_uploaded_at:v1";

function normalizeUrl(value?: string): string {
  return String(value ?? "").trim();
}

function urlFingerprint(url: string): string {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < url.length; i += 1) {
    hash ^= url.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${hash.toString(36)}_${url.length}`;
}

function storageKey(taskId: string, url: string): string {
  const u = normalizeUrl(url);
  return `${STORAGE_PREFIX}:${normalizeUrl(taskId)}:${urlFingerprint(u)}`;
}

export async function persistTaskPhotoUploadedAt(
  taskId: string,
  url: string,
  isoOrUnknown: unknown,
): Promise<void> {
  const u = normalizeUrl(url);
  const tid = normalizeUrl(taskId);
  const iso = toIsoUtcOrEmpty(isoOrUnknown);

  if (!tid || !u || !iso) return;

  try {
    await AsyncStorage.setItem(storageKey(tid, u), iso);
  } catch {
    // Ignore storage quota / platform issues — display may fall back empty.
  }
}

export async function recallTaskPhotoUploadedAt(
  taskId: string,
  url: string,
): Promise<string | null> {
  const tid = normalizeUrl(taskId);
  const u = normalizeUrl(url);
  if (!tid || !u) return null;

  try {
    const raw = await AsyncStorage.getItem(storageKey(tid, u));
    const iso = toIsoUtcOrEmpty(raw);
    return iso || null;
  } catch {
    return null;
  }
}

export async function hydrateTaskPhotosWithPersistedUploadedAt<T extends Pick<Task, "id" | "photos">>(
  task: T,
): Promise<T> {
  const photos = task.photos;
  if (!photos?.length) return task;

  const next = await Promise.all(
    photos.map(async (photo) => {
      const u = normalizeUrl(String(photo?.url ?? ""));
      if (!u) return photo;

      const normalized = toIsoUtcOrEmpty(photo.uploadedAt);
      if (normalized) return { ...photo, uploadedAt: normalized };

      const stored = await recallTaskPhotoUploadedAt(task.id, u);
      return stored ? { ...photo, uploadedAt: stored } : { ...photo, uploadedAt: "" };
    }),
  );

  return { ...task, photos: next };
}

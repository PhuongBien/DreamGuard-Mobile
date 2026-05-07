import AsyncStorage from "@react-native-async-storage/async-storage";

import type { TaskPhoto } from "../types";
import { toIsoUtcOrEmpty } from "./date";

const STORAGE_PREFIX = "@dg_task_local_photos:v1";

function normalizeTaskId(value?: string): string {
  return String(value ?? "").trim();
}

function normalizeUrl(value?: string): string {
  return String(value ?? "").trim();
}

function urlKey(url: string): string {
  // strip query to keep stable key across refreshes
  return normalizeUrl(url).split("?")[0];
}

function normalizePhotoType(value?: string): TaskPhoto["type"] | null {
  const v = normalizeUrl(value).toLowerCase();
  if (v === "before" || v === "after" || v === "payment" || v === "evidence") {
    return v;
  }
  return null;
}

function storageKey(taskId: string): string {
  return `${STORAGE_PREFIX}:${normalizeTaskId(taskId)}`;
}

type StoredPhoto = Pick<TaskPhoto, "url" | "type" | "uploadedAt"> &
  Partial<Pick<TaskPhoto, "uploadedBy" | "captureStage" | "source">>;

function isStoredPhoto(value: any): value is StoredPhoto {
  const url = normalizeUrl(value?.url);
  const type = normalizeUrl(value?.type);
  return !!url && !!type;
}

export async function recallTaskLocalPhotos(taskId: string): Promise<TaskPhoto[]> {
  const tid = normalizeTaskId(taskId);
  if (!tid) return [];

  try {
    const raw = await AsyncStorage.getItem(storageKey(tid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const out: TaskPhoto[] = [];

    for (const item of parsed) {
      if (!isStoredPhoto(item)) continue;
      const url = normalizeUrl(item.url);
      const key = urlKey(url);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      out.push({
        id: `local_${tid}_${key}`,
        url,
        type: item.type as TaskPhoto["type"],
        uploadedAt: toIsoUtcOrEmpty(item.uploadedAt) || "",
        uploadedBy: item.uploadedBy ? String(item.uploadedBy) : "",
        captureStage: item.captureStage as TaskPhoto["captureStage"],
        source: item.source as TaskPhoto["source"],
      });
    }

    return out;
  } catch {
    return [];
  }
}

export async function persistTaskLocalPhoto(
  taskId: string,
  photo: Pick<TaskPhoto, "url" | "type" | "uploadedAt"> &
    Partial<Pick<TaskPhoto, "uploadedBy" | "captureStage" | "source">>,
): Promise<void> {
  const tid = normalizeTaskId(taskId);
  const url = normalizeUrl(photo?.url);
  const type = normalizePhotoType(String(photo?.type ?? ""));
  if (!tid || !url || !type) return;

  const entry: StoredPhoto = {
    url,
    type,
    uploadedAt: toIsoUtcOrEmpty(photo.uploadedAt) || new Date().toISOString(),
    uploadedBy: photo.uploadedBy,
    captureStage: photo.captureStage,
    source: photo.source,
  };

  try {
    const key = storageKey(tid);
    const raw = await AsyncStorage.getItem(key);
    const next: StoredPhoto[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (isStoredPhoto(item)) next.push(item);
          }
        }
      } catch {
        // ignore corrupt storage
      }
    }

    const seen = new Set<string>();
    const deduped: StoredPhoto[] = [];
    // newest first (we unshift below)
    deduped.push(entry);
    seen.add(urlKey(entry.url));

    for (const item of next) {
      const k = urlKey(item.url);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      deduped.push(item);
      if (deduped.length >= 60) break; // cap per task
    }

    await AsyncStorage.setItem(key, JSON.stringify(deduped));
  } catch {
    // ignore storage quota/platform errors
  }
}


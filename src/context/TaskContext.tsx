import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  useRef,
  ReactNode,
} from "react";

import { Task, TaskStatus, TaskNote, TaskPhoto } from "../types";
import { TaskService } from "../services/task.service";
import { DeliveryTaskService } from "../services/delivery-task.service";
import { useAuth } from "./AuthContext";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import {
  hydrateTaskPhotosWithPersistedUploadedAt,
  persistTaskPhotoUploadedAt,
} from "../utils/taskPhotoUploadedAt";
import { persistTaskLocalPhoto, recallTaskLocalPhotos } from "../utils/taskLocalPhotos";

const isGuid = (value?: string) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

const mapStatus = (status: string): TaskStatus => {
  switch (status) {
    case "Pending":
      return "pending";
    case "CheckedIn":
      return "checked_in";
    case "InProgress":
    case "Processing":
      return "in_progress";
    case "CheckedOut":
      return "checked_out";
    case "Completed":
      return "completed";
    case "Reschedule":
    case "Rescheduled":
      return "reschedule";
    case "Cancelled":
    case "ForcedCancelled": // 🔥 thêm dòng này
      return "cancelled";
    default:
      return "pending";
  }
};

const normalizeRoleKey = (value?: string) => {
  const normalized = value?.trim().toLowerCase() || "";

  if (!normalized) return "";
  if (normalized.includes("delivery")) return "delivery_driver";
  if (normalized.includes("clean")) return "cleaner";
  if (normalized.includes("warehouse")) return "warehouse_staff";
  if (normalized.includes("technic")) return "technician";
  if (normalized.includes("manager")) return "manager";
  if (normalized.includes("sale")) return "sales_staff";

  return normalized;
};

export interface TaskContextType {
  tasks: Task[];
  loading: boolean;

  refreshTasks: (params?: {
    status?: TaskStatus | "all";
    date?: string;
    search?: string;
  }) => Promise<void>;
  getTaskById: (
    taskId: string,
    options?: { forceRefresh?: boolean },
  ) => Promise<Task | undefined>;

  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  addTaskNote: (taskId: string, content: string) => Promise<void>;
  addTaskPhoto: (
    taskId: string,
    photo: Omit<TaskPhoto, "id" | "uploadedAt"> & {
      fileName?: string;
      mimeType?: string;
    },
  ) => Promise<string>;

  checkIn: (taskId: string) => Promise<void>;
  checkInWithEvidence: (taskId: string, evidenceUrls: string[]) => Promise<void>;
  checkOut: (taskId: string, note?: string) => Promise<void>;
  checkOutWithEvidence: (
    taskId: string,
    evidenceUrls: string[],
    note?: string,
  ) => Promise<void>;
  startProcessing: (taskId: string) => Promise<void>;
  completeTask: (taskId: string, payload?: { evidenceUrl?: string }) => Promise<void>;
  forcedCancel: (
    taskId: string,
    payload?: { staffNote?: string },
  ) => Promise<void>;
  startDelivery: (taskId: string, evidenceUrls?: string[]) => Promise<void>;
  markArrived: (taskId: string) => Promise<void>;
  markDelivered: (
    taskId: string,
    evidenceUrls: string[],
    options?: { paymentEvidenceUrl?: string },
  ) => Promise<void>;
  markReturned: (
    taskId: string,
    payload:
      | { reason: string; evidenceUrls: string[]; damagedItems?: any[] }
      | string,
    evidenceUrls?: string[],
  ) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const isDeliveryStaff = user?.role === "delivery_driver";
  const authScopeKey = `${user?.id || "guest"}:${user?.userId || ""}:${user?.role || "guest"}`;
  const activeScopeRef = useRef(authScopeKey);
  const tasksRef = useRef<Task[]>([]);

  const normalizeOwnershipKey = (value?: string) =>
    value?.trim().toLowerCase() || "";

  const getCurrentUserOwnershipKeys = useCallback(() => {
    if (!user) return [] as string[];

    return [
      user.id,
      user.userId,
      user.phone,
      user.phoneNumber,
      user.employeeCode,
      user.email,
      user.name,
      user.fullName,
    ]
      .map((value) => normalizeOwnershipKey(value))
      .filter(
        (value, index, array) => !!value && array.indexOf(value) === index,
      );
  }, [user]);

  const getCurrentUserRoleKeys = useCallback(() => {
    if (!user) return [] as string[];

    return [user.role, user.backendRole, user.position]
      .map((value) => normalizeRoleKey(value))
      .filter(
        (value, index, array) => !!value && array.indexOf(value) === index,
      );
  }, [user]);

  const isTaskAllowedForRole = useCallback(
    (task?: Task) => {
      if (!task || !user) return false;

      const requiredRoleKeys = [task.assignedRole, task.assignedBackendRole]
        .map((value) => normalizeRoleKey(value))
        .filter(Boolean);

      if (requiredRoleKeys.length > 0) {
        const currentUserRoleKeys = getCurrentUserRoleKeys();
        return requiredRoleKeys.some((value) =>
          currentUserRoleKeys.includes(value),
        );
      }

      if (task.type === "delivery") {
        return user.role === "delivery_driver";
      }

      return user.role !== "delivery_driver";
    },
    [getCurrentUserRoleKeys, user],
  );

  const isOwnedTask = useCallback(
    (task?: Task) => {
      if (!task || !user) return false;

      if (!isTaskAllowedForRole(task)) {
        return false;
      }

      const ownerCandidates = [
        ...(task.assignmentKeys || []),
        task.assignedTo,
        task.assignedToName,
      ]
        .map((value) => normalizeOwnershipKey(value))
        .filter(Boolean);

      if (!ownerCandidates.length) {
        if (task.type === "delivery" && user.role === "delivery_driver") {
          return true;
        }

        return false;
      }

      const currentUserKeys = getCurrentUserOwnershipKeys();
      return ownerCandidates.some((value) => currentUserKeys.includes(value));
    },
    [getCurrentUserOwnershipKeys, isTaskAllowedForRole, user],
  );

  const filterOwnedTasks = useCallback(
    (items: Task[]) => items.filter((task) => isOwnedTask(task)),
    [isOwnedTask],
  );

  const setTasksState = useCallback(
    (nextTasks: Task[] | ((prev: Task[]) => Task[])) => {
      setTasks((prev) => {
        const resolved =
          typeof nextTasks === "function"
            ? (nextTasks as (prev: Task[]) => Task[])(prev)
            : nextTasks;
        tasksRef.current = resolved;
        return resolved;
      });
    },
    [],
  );

  const mergeTaskWithExisting = useCallback((incomingTask: Task) => {
    const existing = tasksRef.current.find(
      (task) => task.id === incomingTask.id,
    );

    if (!existing) {
      return incomingTask;
    }

    return {
      ...incomingTask,
      photos: mergePhotos(existing.photos || [], incomingTask.photos || []),
      relatedImageUrls: mergeImageUrls(
        existing.relatedImageUrls || [],
        incomingTask.relatedImageUrls || [],
      ),
    };
  }, []);

  useEffect(() => {
    activeScopeRef.current = authScopeKey;
    tasksRef.current = [];
    setTasksState([]);
    setLoading(false);
  }, [authScopeKey, setTasksState]);

  const refreshTasks = useCallback(
    async (params?: {
      status?: TaskStatus | "all";
      date?: string;
      search?: string;
    }) => {
      const requestScopeKey = authScopeKey;

      if (!user) {
        setTasksState([]);
        return;
      }

      setLoading(true);
      try {
        if (isDeliveryStaff) {
          const data = await DeliveryTaskService.getTasks({
            page: 1,
            pageSize: 20,
            status: params?.status,
            date: params?.date,
            search: params?.search,
          });
          if (activeScopeRef.current === requestScopeKey) {
            setTasksState(filterOwnedTasks(data).map(mergeTaskWithExisting));
          }
          return;
        }

        // 1) Preferred: backend identifies staff from access token.
        const requestParams = {
          page: 1,
          pageSize: 20,
          status: params?.status,
          date: params?.date,
          search: params?.search,
        };

        let data = await TaskService.getTasks(requestParams);
        if (__DEV__) {
        }

        // 2) Fallback: some deployments still require explicit staffId.
        if (data.length === 0) {
          const candidateIds = [user.id, user.userId]
            .filter(
              (value, idx, arr): value is string =>
                !!value && arr.indexOf(value) === idx,
            )
            .filter((value) => isGuid(value));

          for (const staffId of candidateIds) {
            data = await TaskService.getTasks({
              ...requestParams,
              staffId,
            });
            if (__DEV__) {
              console.log(
                "[TaskContext] fetch by staffId",
                staffId,
                "->",
                data.length,
              );
            }

            if (data.length > 0) {
              break;
            }
          }
        }

        const fullTasks = await Promise.all(
          data.map(async (task) => {
            const detail = await TaskService.getTaskById(task.id);

            if (!detail) {
              return task;
            }

            const hydrated = await hydrateTaskPhotosWithPersistedUploadedAt(detail);
            return {
              ...task,
              ...hydrated,
            };
          }),
        );

        if (activeScopeRef.current === requestScopeKey) {
          setTasksState(filterOwnedTasks(fullTasks).map(mergeTaskWithExisting));
        }
      } catch (err) {
        console.log("Load tasks error:", err);
      } finally {
        if (activeScopeRef.current === requestScopeKey) {
          setLoading(false);
        }
      }
    },
    [
      authScopeKey,
      filterOwnedTasks,
      isDeliveryStaff,
      mergeTaskWithExisting,
      setTasksState,
      user,
    ],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    refreshTasks();
  }, [authScopeKey]);

  const updateLocalTask = (
    updated: Task,
    opts?: { skipHydratePhotos?: boolean },
  ) => {
    const apply = (next: Task) => {
      if (!isOwnedTask(next)) {
        setTasksState((prev) => prev.filter((task) => task.id !== next.id));
        return;
      }

      setTasksState((prev) => {
        const exists = prev.some((t) => t.id === next.id);
        if (!exists) {
          return [next, ...prev];
        }

        return prev.map((t) => (t.id === next.id ? next : t));
      });
    };

    const shouldHydrate =
      !opts?.skipHydratePhotos && (updated.photos?.length ?? 0) > 0;

    if (!shouldHydrate) {
      apply(updated);
      return;
    }

    void hydrateTaskPhotosWithPersistedUploadedAt(updated).then((enriched) => {
      apply(enriched);
    });
  };

  const getTaskById = async (
    taskId: string,
    options?: { forceRefresh?: boolean },
  ) => {
    const requestScopeKey = activeScopeRef.current;
    const forceRefresh = !!options?.forceRefresh;
    const existing = tasksRef.current.find((t) => t.id === taskId);
    if (existing && !forceRefresh) {
      if (isOwnedTask(existing)) {
        return existing;
      }

      setTasksState((prev) => prev.filter((item) => item.id !== taskId));
    }

    if (isDeliveryStaff) {
      const task = await DeliveryTaskService.getTaskById(taskId);

      const mappedTask = task
        ? {
            ...task,
            evidenceUrls: (task as any).evidences || [], // ✅ FIX Ở ĐÂY
          }
        : task;
      if (activeScopeRef.current !== requestScopeKey) {
        return undefined;
      }

      if (mappedTask && isOwnedTask(mappedTask)) {
        const hydrated = await hydrateTaskPhotosWithPersistedUploadedAt(mappedTask);

        const mergedTask: Task = existing
          ? {
              ...hydrated,
              photos: mergePhotos(existing.photos || [], hydrated.photos || []),
              relatedImageUrls: mergeImageUrls(
                existing.relatedImageUrls || [],
                hydrated.relatedImageUrls || [],
              ),
            }
          : hydrated;

        updateLocalTask(mergedTask, { skipHydratePhotos: true });
        return mergedTask;
      }

      setTasksState((prev) => prev.filter((item) => item.id !== taskId));

      return undefined;
    }

    const task = await TaskService.getTaskById(taskId);
    if (activeScopeRef.current !== requestScopeKey) {
      return undefined;
    }

    if (task && isOwnedTask(task)) {
      const hydrated = await hydrateTaskPhotosWithPersistedUploadedAt(task);
      const localPhotos = await recallTaskLocalPhotos(taskId);

      const mergedTask: Task = existing
        ? {
            ...hydrated,
            photos: mergePhotos(
              mergePhotos(localPhotos, existing.photos || []),
              hydrated.photos || [],
            ),
            relatedImageUrls: mergeImageUrls(
              existing.relatedImageUrls || [],
              hydrated.relatedImageUrls || [],
            ),
          }
        : hydrated;

      if (!existing && localPhotos.length) {
        mergedTask.photos = mergePhotos(localPhotos, mergedTask.photos || []);
      }

      updateLocalTask(mergedTask, { skipHydratePhotos: true });
      return mergedTask;
    }

    setTasksState((prev) => prev.filter((item) => item.id !== taskId));
    return undefined;
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    if (isDeliveryStaff) {
      let updated: Task;

      if (status === "delivering") {
        updated = await DeliveryTaskService.startDelivery(taskId);
      } else if (status === "arrived") {
        updated = await DeliveryTaskService.markArrived(taskId);
      } else {
        throw new Error("Unsupported delivery status update");
      }

      updateLocalTask(updated);
      return;
    }

    const updated = await TaskService.updateStatus(taskId, status);
    updateLocalTask(updated);
  };

  const addTaskNote = async (taskId: string, content: string) => {
    if (isDeliveryStaff) {
      throw new Error(
        "Delivery staff note editing is not enabled in this flow",
      );
    }

    const note: TaskNote = {
      id: `note_${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      createdBy: "current_user",
      authorName: "You",
    };

    const updated = await TaskService.addNote(taskId, note);
    updateLocalTask(updated);
  };

  const addTaskPhoto = async (
    taskId: string,
    photoData: Omit<TaskPhoto, "id" | "uploadedAt"> & {
      fileName?: string;
      mimeType?: string;
    },
  ) => {
    if (isDeliveryStaff) {
      const existing = tasksRef.current.find((task) => task.id === taskId);

      if (!existing) {
        throw new Error("Task not found");
      }

      const photo: TaskPhoto & {
        fileName?: string;
        mimeType?: string;
      } = {
        id: `photo_${Date.now()}`,
        url: photoData.url,
        type: photoData.type,
        uploadedAt: new Date().toISOString(),
        uploadedBy: photoData.uploadedBy,
        captureStage: photoData.captureStage,
        source: "local_capture",
        fileName: photoData.fileName,
        mimeType: photoData.mimeType,
      };

      const uploadedUrl = await DeliveryTaskService.addPhoto(existing, photo);
      const uploadedPhoto: TaskPhoto = {
        ...photo,
        url: uploadedUrl,
      };

      await persistTaskPhotoUploadedAt(
        existing.id,
        uploadedUrl,
        uploadedPhoto.uploadedAt,
      );

      updateLocalTask(
        {
          ...existing,
          photos: mergePhotos(
            [uploadedPhoto, ...(existing.photos || [])],
            existing.photos || [],
          ),
          relatedImageUrls: mergeImageUrls(
            [uploadedUrl, ...(existing.relatedImageUrls || [])],
            existing.relatedImageUrls || [],
          ),
        },
        { skipHydratePhotos: true },
      );
      return uploadedUrl;
    }

    // Service tasks: backend may block evidence upload until CheckedOut.
    // Upload to Cloudinary instead; those URLs are used as evidenceUrls
    // for updateCheckedInStatus / updateCheckedOutStatus.
    const existing = tasksRef.current.find((task) => task.id === taskId);
    if (!existing) {
      throw new Error("Task not found");
    }

    const uploadedUrl = await uploadImageToCloudinary(photoData.url, {
      fileName:
        photoData.fileName ||
        `${photoData.type || "photo"}_${existing.taskCode || taskId}_${Date.now()}`,
      mimeType: photoData.mimeType,
    });

    const uploadedPhoto: TaskPhoto = {
      id: `photo_${Date.now()}`,
      url: uploadedUrl,
      type: photoData.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: photoData.uploadedBy,
      captureStage: photoData.captureStage,
      source: "local_capture",
    };

    await persistTaskPhotoUploadedAt(
      existing.id,
      uploadedUrl,
      uploadedPhoto.uploadedAt,
    );

    await persistTaskLocalPhoto(existing.id, uploadedPhoto);

    updateLocalTask(
      {
        ...existing,
        photos: mergePhotos(
          [uploadedPhoto, ...(existing.photos || [])],
          existing.photos || [],
        ),
        relatedImageUrls: mergeImageUrls(
          [uploadedUrl, ...(existing.relatedImageUrls || [])],
          existing.relatedImageUrls || [],
        ),
      },
      { skipHydratePhotos: true },
    );

    return uploadedUrl;
  };

  const checkIn = async (taskId: string) => {
    if (isDeliveryStaff) {
      throw new Error("Check-in is not used for delivery tasks");
    }

    const updated = await TaskService.checkIn(taskId);
    updateLocalTask(updated);
  };

  const checkInWithEvidence = async (taskId: string, evidenceUrls: string[]) => {
    if (isDeliveryStaff) {
      throw new Error("Check-in is not used for delivery tasks");
    }

    const updated = await TaskService.checkInWithEvidence(taskId, evidenceUrls);
    updateLocalTask(updated);
  };

  const checkOut = async (taskId: string, note?: string) => {
    if (isDeliveryStaff) {
      throw new Error("Check-out is not used for delivery tasks");
    }

    const updated = await TaskService.checkOut(taskId, note);
    updateLocalTask(updated);
  };

  const checkOutWithEvidence = async (
    taskId: string,
    evidenceUrls: string[],
    note?: string,
  ) => {
    if (isDeliveryStaff) {
      throw new Error("Check-out is not used for delivery tasks");
    }

    const updated = await TaskService.checkOutWithEvidence(
      taskId,
      evidenceUrls,
      note,
    );
    updateLocalTask(updated);
  };

  const forcedCancel = async (
    taskId: string,
    payload?: { staffNote?: string },
  ) => {
    if (isDeliveryStaff) {
      throw new Error("Forced cancel is not used for delivery tasks");
    }

    const updated = await TaskService.forcedCancel(taskId, payload);
    updateLocalTask(updated);
  };

  const startProcessing = async (taskId: string) => {
    if (isDeliveryStaff) {
      throw new Error("Processing flow is not used for delivery tasks");
    }

    const updated = await TaskService.startProcessing(taskId);
    updateLocalTask(updated);
  };

  const completeTask = async (taskId: string, payload?: { evidenceUrl?: string }) => {
    if (isDeliveryStaff) {
      throw new Error("Complete action is not used for delivery tasks");
    }

    const updated = await TaskService.completeTask(taskId, payload);
    updateLocalTask(updated);
  };

  const startDelivery = async (taskId: string, evidenceUrls: string[] = []) => {
    const existing = tasksRef.current.find((task) => task.id === taskId);
    const updated = await DeliveryTaskService.startDelivery(
      taskId,
      evidenceUrls,
    );

    if (existing) {
      updateLocalTask({
        ...updated,
        photos: mergePhotos(existing.photos || [], updated.photos || []),
        relatedImageUrls: mergeImageUrls(
          existing.relatedImageUrls || [],
          updated.relatedImageUrls || [],
        ),
      });
      return;
    }

    updateLocalTask(updated);
  };

  const markArrived = async (taskId: string) => {
    const existing = tasksRef.current.find((task) => task.id === taskId);
    const updated = await DeliveryTaskService.markArrived(taskId);
    updateLocalTask(
      existing
        ? {
            ...updated,
            photos: mergePhotos(existing.photos || [], updated.photos || []),
            relatedImageUrls: mergeImageUrls(
              existing.relatedImageUrls || [],
              updated.relatedImageUrls || [],
            ),
          }
        : updated,
    );
  };

  const markDelivered = async (
    taskId: string,
    evidenceUrls: string[],
    options?: { paymentEvidenceUrl?: string },
  ) => {
    const existing = tasksRef.current.find((task) => task.id === taskId);
    const updated = await DeliveryTaskService.markDelivered(
      taskId,
      evidenceUrls,
      options,
    );
    const paymentUrl = String(options?.paymentEvidenceUrl ?? "").trim();
    const paymentPhoto =
      paymentUrl && existing
        ? ({
            id: `payment_${existing.taskCode || existing.id}_${Date.now()}`,
            url: paymentUrl,
            type: "payment",
            uploadedAt: new Date().toISOString(),
            uploadedBy: String(user?.id ?? user?.userId ?? "delivery_staff"),
            captureStage: "delivery_success",
          } as TaskPhoto)
        : null;

    const patched: Task = paymentUrl
      ? {
          ...updated,
          paymentEvidenceUrl: paymentUrl,
          photos: paymentPhoto
            ? mergePhotos([paymentPhoto, ...(existing?.photos || [])], updated.photos || [])
            : updated.photos,
          relatedImageUrls: mergeImageUrls(
            paymentPhoto ? [paymentUrl, ...(existing?.relatedImageUrls || [])] : (existing?.relatedImageUrls || []),
            updated.relatedImageUrls || [],
          ),
        }
      : updated;
    updateLocalTask(
      existing
        ? {
          ...patched,
          photos: mergePhotos(existing.photos || [], patched.photos || []),
          relatedImageUrls: mergeImageUrls(
            existing.relatedImageUrls || [],
            patched.relatedImageUrls || [],
          ),
          }
        : patched,
    );
  };

  const markReturned = async (
    taskId: string,
    payload:
      | { reason: string; evidenceUrls: string[]; damagedItems?: any[] }
      | string,
    evidenceUrls?: string[],
  ) => {
    const existing = tasksRef.current.find((task) => task.id === taskId);
    const resolvedReason =
      typeof payload === "string" ? payload : String(payload?.reason ?? "");
    const resolvedEvidenceUrls =
      typeof payload === "string"
        ? evidenceUrls ?? []
        : payload?.evidenceUrls ?? [];

    const updated = await DeliveryTaskService.markReturned(taskId, {
      reason: resolvedReason,
      evidenceUrls: resolvedEvidenceUrls,
      damagedItems:
        typeof payload === "string" ? [] : (payload?.damagedItems ?? []),
    });
    updateLocalTask(
      existing
        ? {
            ...updated,
            photos: mergePhotos(existing.photos || [], updated.photos || []),
            relatedImageUrls: mergeImageUrls(
              existing.relatedImageUrls || [],
              updated.relatedImageUrls || [],
            ),
          }
        : updated,
    );
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        refreshTasks,
        getTaskById,
        updateTaskStatus,
        addTaskNote,
        addTaskPhoto,
        checkIn,
        checkInWithEvidence,
        checkOut,
        checkOutWithEvidence,
        startProcessing,
        completeTask,
        forcedCancel,
        startDelivery,
        markArrived,
        markDelivered,
        markReturned,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTask must be used inside TaskProvider");
  }
  return context;
};

function mergePhotos(localPhotos: TaskPhoto[], remotePhotos: TaskPhoto[]) {
  const normalizeUrlKey = (value?: string) => String(value ?? "").trim();
  const byUrl = new Map<string, TaskPhoto>();

  for (const photo of remotePhotos) {
    const key = normalizeUrlKey(photo.url);
    if (!key) continue;
    byUrl.set(key, { ...photo, url: key });
  }

  for (const photo of localPhotos) {
    const key = normalizeUrlKey(photo.url);
    if (!key) continue;
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...photo, url: key });
      continue;
    }

    const resolvedType =
      (existing.type === "evidence" || !existing.type) && photo.type !== "evidence"
        ? photo.type
        : existing.type;
    const resolvedSource = existing.source || photo.source;

    byUrl.set(key, {
      ...existing,
      type: resolvedType,
      source: resolvedSource,
      captureStage: existing.captureStage || photo.captureStage,
      uploadedBy: existing.uploadedBy || photo.uploadedBy,
      uploadedAt: preferLocalUploadedTimestamp(photo.uploadedAt, existing.uploadedAt),
    });
  }

  return Array.from(byUrl.values());
}

function preferLocalUploadedTimestamp(
  preferred?: string,
  fallback?: string,
): string {
  const p = (preferred ?? "").trim();
  const f = (fallback ?? "").trim();
  const pOk = !!p && !Number.isNaN(Date.parse(p));
  const fOk = !!f && !Number.isNaN(Date.parse(f));
  if (pOk) return new Date(p).toISOString();
  if (fOk) return new Date(f).toISOString();
  return "";
}

function mergeImageUrls(localUrls: string[], remoteUrls: string[]) {
  const normalizeUrlKey = (value?: string) => String(value ?? "").trim();
  return Array.from(
    new Set(
      [...remoteUrls, ...localUrls]
        .map((url) => normalizeUrlKey(url))
        .filter(Boolean),
    ),
  );
}

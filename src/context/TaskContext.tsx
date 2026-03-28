import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  ReactNode,
} from "react";

import { Task, TaskStatus, TaskNote, TaskPhoto } from "../types";
import { TaskService } from "../services/task.service";
import { useAuth } from "./AuthContext";

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
    case "Cancelled":
    case "ForcedCancelled": // 🔥 thêm dòng này
      return "cancelled";
    default:
      return "pending";
  }
};

// const mapTaskFromApi = (item: any): Task => {
//   return {
//     id: item.serviceTaskId,
//     taskCode: item.serviceTaskId?.slice(0, 8),

//     title:
//       item.serviceOrderItems?.[0]?.servicePackageName ||
//       "Không có tiêu đề",

//     description: item.customerNote || "",

//     status: mapStatus(item.status),

//     dueDate: item.appointmentDate?.split("T")[0],
//     dueTime: item.appointmentDate?.split("T")[1]?.slice(0, 5),

//     totalPrice: item.totalPrice,
//     paymentMethod: item.paymentMethod,
//     paymentStatus: item.paymentStatus,
//     serviceOrderStatus: item.serviceOrderStatus,

//     customer: {
//       id: item.soId || item.serviceTaskId,
//       name: item.receiverName,
//       phone: item.phoneNumber,
//       address: item.address,
//       note: item.customerNote,
//     },

//     products: (item.serviceOrderItems || []).map((i: any) => ({
//       id: i.serviceOrderItemId,
//       name: i.servicePackageName,
//       quantity: i.quantity || 1,
//     })),

//     photos: (item.serviceOrderImageUrl || []).map(
//       (url: string, idx: number) => ({
//         url,
//         type: idx === 0 ? "before" : "after",
//       }),
//     ),

//     checkInOut: {
//       checkIn: item.checkIn
//         ? { time: item.checkIn }
//         : undefined,
//       checkOut: item.checkOut
//         ? { time: item.checkOut, durationMinutes: 0 }
//         : undefined,
//     },

//     servicePackageMapping: item.serviceOrderItems?.[0]
//   ? {
//       servicePackageMappingId:
//         item.serviceOrderItems[0].servicePackageMappingId,

//       price: item.serviceOrderItems[0].totalPrice,

//       duration: undefined,

//       servicePackage: {
//         packageName: item.serviceOrderItems[0].servicePackageName,
//         status: "-",
//         suitableFor: "-",
//       },

//       productType: {
//         productTypeName:
//           item.serviceOrderItems[0].productTypeName,
//       },
//     }
//   : undefined,
//   };
// };

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
  ) => Promise<void>;

  checkIn: (taskId: string) => Promise<void>;
  checkOut: (taskId: string, note?: string) => Promise<void>;
  startProcessing: (taskId: string) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshTasks = useCallback(async (params?: {
    status?: TaskStatus | "all";
    date?: string;
    search?: string;
  }) => {
    if (!user) {
      setTasks([]);
      return;
    }

    setLoading(true);
    try {
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
        // console.log("[TaskContext] fetch by token ->", data.length);
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

    if (detail) {
      return {
        ...task,
        ...detail,
      };
    }

    return task;
  })
);

      setTasks(fullTasks);
    } catch (err) {
      console.log("Load tasks error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTasks();
  }, [refreshTasks]);

  const updateLocalTask = (updated: Task) => {
    setTasks((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      if (!exists) {
        return [updated, ...prev];
      }

      return prev.map((t) => (t.id === updated.id ? updated : t));
    });
  };

  const getTaskById = async (
    taskId: string,
    options?: { forceRefresh?: boolean },
  ) => {
    const forceRefresh = !!options?.forceRefresh;
    const existing = tasks.find((t) => t.id === taskId);
    if (existing && !forceRefresh) return existing;

    const task = await TaskService.getTaskById(taskId);
    if (task) {
      // Keep optimistic local photos when backend is eventually consistent.
      const mergedTask: Task = existing
        ? {
            ...task,
            photos: mergePhotos(existing.photos || [], task.photos || []),
          }
        : task;

      updateLocalTask(mergedTask);
      return mergedTask;
    }
    return undefined;
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    const updated = await TaskService.updateStatus(taskId, status);
    updateLocalTask(updated);
  };

  const addTaskNote = async (taskId: string, content: string) => {
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
    const photo: TaskPhoto & {
      fileName?: string;
      mimeType?: string;
    } = {
      ...photoData,
      id: `photo_${Date.now()}`,
      uploadedAt: new Date().toISOString(),
    };

    const updated = await TaskService.addPhoto(taskId, photo);

    // Some backend responses are eventually consistent for image URL arrays.
    // Keep UX responsive by showing the uploaded image immediately.
    const hasUploadedPhoto = (updated.photos || []).some(
      (item) => item.url === photo.url,
    );

    if (hasUploadedPhoto) {
      updateLocalTask(updated);
      return;
    }

    const merged: Task = {
      ...updated,
      photos: [
        ...(updated.photos || []),
        {
          id: photo.id,
          url: photo.url,
          type: photo.type,
          uploadedAt: photo.uploadedAt,
          uploadedBy: photo.uploadedBy,
        },
      ],
    };

    updateLocalTask(merged);
  };

  const checkIn = async (taskId: string) => {
    const updated = await TaskService.checkIn(taskId);
    updateLocalTask(updated);
  };

  const checkOut = async (taskId: string, note?: string) => {
    const updated = await TaskService.checkOut(taskId, note);
    updateLocalTask(updated);
  };

  const startProcessing = async (taskId: string) => {
    const updated = await TaskService.startProcessing(taskId);
    updateLocalTask(updated);
  };

  const completeTask = async (taskId: string) => {
    const updated = await TaskService.completeTask(taskId);
    updateLocalTask(updated);
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
        checkOut,
        startProcessing,
        completeTask,
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
  const byUrl = new Map<string, TaskPhoto>();

  for (const photo of remotePhotos) {
    if (!photo.url) continue;
    byUrl.set(photo.url, photo);
  }

  for (const photo of localPhotos) {
    if (!photo.url) continue;
    if (!byUrl.has(photo.url)) {
      byUrl.set(photo.url, photo);
    }
  }

  return Array.from(byUrl.values());
}

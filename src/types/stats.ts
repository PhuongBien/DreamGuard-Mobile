// Dashboard / Stats Types

export interface DailyStats {
  date: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
}
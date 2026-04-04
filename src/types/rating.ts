// Rating Types

export interface Rating {
  id: string;
  score: number; // 1-5
  comment?: string | null;
  customerName?: string | null;
  customerAvatar?: string | null;
  serviceOrderId?: string | null;
  serviceOrderCode?: string | null;
  staffId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

import {
  TradeInOrder,
  TradeInOrderStatus,
  TradeInOrderListParams,
  TradeInOrderSearchParams,
} from "../types";
import {
  fetchTradeInWaitingOrders as apiFetchTradeInWaitingOrders,
  searchTradeInOrders as apiSearchTradeInOrders,
  fetchTradeInOrderById as apiFetchTradeInOrderById,
  updateTradeInOrderProcessing as apiUpdateTradeInOrderProcessing,
  updateTradeInOrderDelivered as apiUpdateTradeInOrderDelivered,
  updateTradeInOrderCompleted as apiUpdateTradeInOrderCompleted,
  cancelTradeInOrder as apiCancelTradeInOrder,
  uploadTradeInOrderImage as apiUploadTradeInOrderImage,
} from "../utils/api";

const DEFAULT_PAGE_SIZE = 20;

const normalizeTradeInOrder = (raw: any): TradeInOrder => {
  return {
    id: raw.id || raw.tradeInOrderId || "",
    tradeInOrderId: raw.tradeInOrderId,
    orderCode: raw.orderCode || raw.code || "",
    status: (raw.status || "pending") as TradeInOrderStatus,
    
    customer: {
      id: raw.customer?.id || raw.customerId,
      name: raw.customer?.name || raw.customerName || "",
      phone: raw.customer?.phone || raw.customerPhone || "",
      address: raw.customer?.address || raw.deliveryAddress || "",
      note: raw.customer?.note || raw.customerNote,
    },
    
    devices: {
      oldDevice: raw.oldDevice ? {
        id: raw.oldDevice.id,
        name: raw.oldDevice.name || raw.oldDevice.model || "",
        model: raw.oldDevice.model,
        type: raw.oldDevice.type,
        description: raw.oldDevice.description,
        quantity: raw.oldDevice.quantity || 1,
        estimatedPrice: raw.oldDevice.estimatedPrice || raw.oldDevice.price,
      } : undefined,
      newDevice: raw.newDevice ? {
        id: raw.newDevice.id,
        name: raw.newDevice.name || raw.newDevice.model || "",
        model: raw.newDevice.model,
        type: raw.newDevice.type,
        description: raw.newDevice.description,
        quantity: raw.newDevice.quantity || 1,
        estimatedPrice: raw.newDevice.estimatedPrice || raw.newDevice.price,
      } : undefined,
    },
    
    priceAgreed: raw.priceAgreed || raw.agreementPrice || raw.totalPrice,
    notes: raw.notes || raw.staffNotes,
    
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    
    processingStartedAt: raw.processingStartedAt,
    deliveredAt: raw.deliveredAt,
    completedAt: raw.completedAt,
    
    assignedTo: raw.assignedTo || raw.staffId,
    assignedToName: raw.assignedToName || raw.staffName,
    
    photos: Array.isArray(raw.photos) ? raw.photos.map((p: any) => ({
      id: p.id,
      url: p.url || p.imageUrl,
      type: p.type || "device_condition",
      uploadedAt: p.uploadedAt,
    })) : [],
  };
};

export class TradeInOrderService {
  static async fetchWaitingOrders(
    params: TradeInOrderListParams = {},
  ): Promise<{ orders: TradeInOrder[]; total: number; }> {
    const response = await apiFetchTradeInWaitingOrders(params);
    
    if (!response.success || !response.data) {
      return { orders: [], total: 0 };
    }

    const { items = [], totalItems = 0 } = response.data as any;
    const orders = Array.isArray(items)
      ? items.map((raw) => normalizeTradeInOrder(raw))
      : [];

    return { orders, total: totalItems };
  }

  static async searchOrders(
    params: TradeInOrderSearchParams = {},
  ): Promise<{ orders: TradeInOrder[]; total: number; }> {
    const response = await apiSearchTradeInOrders(params);
    
    if (!response.success || !response.data) {
      return { orders: [], total: 0 };
    }

    const { items = [], totalItems = 0 } = response.data as any;
    const orders = Array.isArray(items)
      ? items.map((raw) => normalizeTradeInOrder(raw))
      : [];

    return { orders, total: totalItems };
  }

  static async fetchById(tradeInOrderId: string): Promise<TradeInOrder | null> {
    const response = await apiFetchTradeInOrderById(tradeInOrderId);
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateProcessing(
    tradeInOrderId: string,
    notes?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderProcessing(tradeInOrderId, notes);
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateDelivered(
    tradeInOrderId: string,
    notes?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderDelivered(tradeInOrderId, notes);
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateCompleted(
    tradeInOrderId: string,
    notes?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderCompleted(tradeInOrderId, notes);
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async cancel(
    tradeInOrderId: string,
    reason?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiCancelTradeInOrder(tradeInOrderId, reason);
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async uploadImage(
    tradeInOrderId: string,
    imageUri: string,
    imageType?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUploadTradeInOrderImage(
      tradeInOrderId,
      imageUri,
      imageType,
    );
    
    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }
}

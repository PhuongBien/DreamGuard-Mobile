import { TradeInOrder } from "../types";
import {
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
    tradeInOrderId: raw.tradeInOrderId || raw.id || raw.orderId || "",
    customerId: raw.customer?.id || raw.customerId,
    orderId: raw.orderId,
    orderCode: raw.orderCode || raw.code || raw.orderCode || "",
    status: raw.status || raw.orderStatus || raw.statusDescription || "pending",
    receiverName:
      raw.customer?.name || raw.customerName || raw.receiverName || "",
    phoneNumber:
      raw.customer?.phone || raw.customerPhone || raw.phoneNumber || "",
    address: raw.customer?.address || raw.deliveryAddress || raw.address || "",
    description: raw.description || raw.notes || raw.staffNotes,
    tradeInPrice: raw.tradeInPrice,
    minTradeInPrice:
      raw.minTradeInPrice ??
      raw.mintradeInPrice ??
      raw.min_trade_in_price ??
      undefined,
    maxTradeInPrice:
      raw.maxTradeInPrice ??
      raw.maxtradeInPrice ??
      raw.max_trade_in_price ??
      undefined,
    amountToPay: raw.amountToPay,
    depositAmount: raw.depositAmount,
    isGood: typeof raw.isGood === "boolean" ? raw.isGood : undefined,
    oldProductVariantUrl:
      typeof raw.oldProductVariantUrl === "string"
        ? raw.oldProductVariantUrl
        : undefined,
    newProductVariantUrl:
      typeof raw.newProductVariantUrl === "string"
        ? raw.newProductVariantUrl
        : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    payments: Array.isArray(raw.payments)
      ? raw.payments.map((payment: any) => ({
          id: String(payment.id ?? ""),
          orderCode: String(payment.orderCode ?? ""),
          paymentType: String(payment.paymentType ?? payment.type ?? ""),
          status: String(payment.status ?? ""),
          amount: Number(payment.amount ?? payment.paidAmount ?? 0),
          paymentMethod: String(payment.paymentMethod ?? payment.method ?? ""),
          createdAt: String(payment.createdAt ?? ""),
        }))
      : undefined,
    orderItem: raw.orderItem
      ? {
          id: raw.orderItem.id,
          itemName: raw.orderItem.itemName || raw.orderItem.name || "",
          quantity: raw.orderItem.quantity ?? 1,
          unitPrice: raw.orderItem.unitPrice ?? raw.orderItem.price ?? 0,
          totalPrice: raw.orderItem.totalPrice ?? raw.orderItem.price ?? 0,
          tradeInUsedAmount:
            raw.orderItem.tradeInUsedAmount != null
              ? Number(raw.orderItem.tradeInUsedAmount)
              : undefined,
        }
      : undefined,
    productVariant: raw.productVariant
      ? {
          id: raw.productVariant.id,
          sku: raw.productVariant.sku || raw.productVariant.code || "",
          basePrice:
            raw.productVariant.basePrice ?? raw.productVariant.price ?? 0,
          salePrice:
            raw.productVariant.salePrice ??
            raw.productVariant.discountPrice ??
            raw.productVariant.basePrice ??
            0,
          size: raw.productVariant.size,
        }
      : undefined,
    tradeInImages: Array.isArray(raw.tradeInImages)
      ? raw.tradeInImages.map((p: any) => ({
          id: p.id,
          imageUrl: p.imageUrl || p.url,
        }))
      : Array.isArray(raw.photos)
        ? raw.photos.map((p: any) => ({
            id: p.id,
            imageUrl: p.imageUrl || p.url,
          }))
        : undefined,
  };
};

export class TradeInOrderService {
  // Fetch orders assigned to staff (waiting for staff action)

  static async fetchById(tradeInOrderId: string): Promise<TradeInOrder | null> {
    const response = await apiFetchTradeInOrderById(tradeInOrderId);

    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateProcessing(
    tradeInOrderId: string,
    payload?: { notes?: string; shippingDate?: string },
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderProcessing(
      tradeInOrderId,
      payload,
    );

    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateDelivered(
    tradeInOrderId: string,
    notes?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderDelivered(
      tradeInOrderId,
      notes,
    );

    if (!response.success || !response.data) {
      return null;
    }

    return normalizeTradeInOrder(response.data);
  }

  static async updateCompleted(
    tradeInOrderId: string,
    notes?: string,
  ): Promise<TradeInOrder | null> {
    const response = await apiUpdateTradeInOrderCompleted(
      tradeInOrderId,
      notes,
    );

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

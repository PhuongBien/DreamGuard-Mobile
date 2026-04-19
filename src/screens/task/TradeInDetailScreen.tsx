import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { TradeInOrder, TradeInOrderStatus } from "../../types";
import { TaskStackParamList } from "../../types/navigation";
import {
  BorderRadius,
  Colors,
  Shadow,
  Spacing,
  Typography,
} from "../../constants/theme";
import { formatDate } from "../../utils/date";
import { TradeInOrderService } from "../../services/trade-in-order.service";
import { uploadImageToCloudinary } from "../../utils/cloudinary";

type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

const TRADEIN_STATUS_LABELS: Record<TradeInOrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  ready_for_delivery: "Ready for Delivery",
  processing: "Processing",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function TradeInDetailScreen({ route, navigation }: Props) {
  const { taskId } = route.params;

  const [order, setOrder] = useState<TradeInOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);

  const orderRef = useRef<TradeInOrder | null>(null);

  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const loaded = await TradeInOrderService.fetchById(taskId);
      if (loaded) {
        setOrder(loaded);
        orderRef.current = loaded;
      }
    } catch (error) {
      console.error("Failed to load TradeIn order:", error);
      Alert.alert("Error", "Failed to load order details");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useFocusEffect(
    useCallback(() => {
      loadOrder();
    }, [loadOrder]),
  );

  const canUpdateStatus = useMemo(() => {
    if (!order) return false;
    return (
      order.status === "ready_for_delivery" ||
      order.status === "processing" ||
      order.status === "delivered"
    );
  }, [order]);

  const handlePickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedPhotos((prev) => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  }, []);

  const handleUploadPhotos = useCallback(async () => {
    if (!order || selectedPhotos.length === 0) return;

    try {
      setActionLoading(true);

      for (const photoUri of selectedPhotos) {
        const cloudinaryUrl = await uploadImageToCloudinary(photoUri);
        if (cloudinaryUrl) {
          await TradeInOrderService.uploadImage(
            order.id,
            cloudinaryUrl,
            "device_condition",
          );
        }
      }

      Alert.alert("Success", "Photos uploaded successfully");
      setSelectedPhotos([]);
      await loadOrder();
    } catch (error) {
      console.error("Failed to upload photos:", error);
      Alert.alert("Error", "Failed to upload photos");
    } finally {
      setActionLoading(false);
    }
  }, [order, selectedPhotos, loadOrder]);

  const handleStatusUpdate = useCallback(
    async (newStatus: TradeInOrderStatus) => {
      if (!order) return;

      Alert.alert(
        "Confirm Status Update",
        `Update order status to ${TRADEIN_STATUS_LABELS[newStatus]}?`,
        [
          { text: "Cancel", onPress: () => {} },
          {
            text: "Update",
            onPress: async () => {
              try {
                setActionLoading(true);
                let updated: TradeInOrder | null = null;

                if (newStatus === "processing") {
                  updated = await TradeInOrderService.updateProcessing(order.id);
                } else if (newStatus === "delivered") {
                  updated = await TradeInOrderService.updateDelivered(order.id);
                } else if (newStatus === "completed") {
                  updated = await TradeInOrderService.updateCompleted(order.id);
                }

                if (updated) {
                  setOrder(updated);
                  orderRef.current = updated;
                  Alert.alert("Success", "Order status updated");
                }
              } catch (error) {
                console.error("Failed to update order:", error);
                Alert.alert("Error", "Failed to update order status");
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
    },
    [order],
  );

  const handleCancel = useCallback(async () => {
    if (!order) return;

    Alert.prompt(
      "Cancel Order",
      "Please provide a reason for cancellation:",
      [
        { text: "Cancel", onPress: () => {} },
        {
          text: "Confirm",
          onPress: async (reason) => {
            try {
              setActionLoading(true);
              const updated = await TradeInOrderService.cancel(
                order.id,
                reason,
              );
              if (updated) {
                setOrder(updated);
                Alert.alert("Success", "Order has been cancelled");
              }
            } catch (error) {
              console.error("Failed to cancel order:", error);
              Alert.alert("Error", "Failed to cancel order");
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      "plain-text",
    );
  }, [order]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary700} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusStyle = getStatusStyle(order.status);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trade-In Order</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardCode}>{order.orderCode}</Text>
              <Text style={styles.cardTimestamp}>
                {formatDate(order.createdAt || new Date().toISOString())}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
              <Text style={[styles.statusText, { color: statusStyle.text }]}>
                {TRADEIN_STATUS_LABELS[order.status]}
              </Text>
            </View>
          </View>
        </View>

        <Section title="Customer Information">
          <KeyValueRow label="Name" value={order.customer.name} />
          <KeyValueRow label="Phone" value={order.customer.phone} />
          <KeyValueRow label="Address" value={order.customer.address} />
          {order.customer.note && (
            <KeyValueRow label="Note" value={order.customer.note} />
          )}
        </Section>

        <Section title="Device Information">
          {order.devices.oldDevice && (
            <>
              <KeyValueRow label="Old Device" value={order.devices.oldDevice.name} />
              {order.devices.oldDevice.model && (
                <KeyValueRow label="Model" value={order.devices.oldDevice.model} />
              )}
              {order.devices.oldDevice.description && (
                <KeyValueRow
                  label="Condition"
                  value={order.devices.oldDevice.description}
                />
              )}
            </>
          )}

          {order.devices.newDevice && (
            <>
              <KeyValueRow label="New Device" value={order.devices.newDevice.name} />
              {order.devices.newDevice.model && (
                <KeyValueRow label="Model" value={order.devices.newDevice.model} />
              )}
            </>
          )}
        </Section>

        {order.priceAgreed && (
          <Section title="Trade-In Value">
            <KeyValueRow
              label="Agreed Price"
              value={`${order.priceAgreed.toLocaleString()} VND`}
            />
          </Section>
        )}

        <Section title="Device Photos">
          <View style={styles.photosContainer}>
            {selectedPhotos.length > 0 && (
              <>
                <Text style={styles.photosLabel}>
                  New Photos ({selectedPhotos.length})
                </Text>
                <View style={styles.photoGrid}>
                  {selectedPhotos.map((uri, idx) => (
                    <View key={idx} style={styles.photoWrapper}>
                      <Image source={{ uri }} style={styles.photoThumb} />
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() =>
                          setSelectedPhotos((p) => p.filter((_, i) => i !== idx))
                        }
                      >
                        <Ionicons name="close" size={16} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}

            {order.photos && order.photos.length > 0 && (
              <>
                <Text style={styles.photosLabel}>
                  Uploaded Photos ({order.photos.length})
                </Text>
                <View style={styles.photoGrid}>
                  {order.photos.map((photo, idx) => (
                    <Image
                      key={idx}
                      source={{ uri: photo.url }}
                      style={styles.photoThumb}
                    />
                  ))}
                </View>
              </>
            )}

            {selectedPhotos.length === 0 && (!order.photos || order.photos.length === 0) && (
              <Text style={styles.noPhotosText}>No photos yet</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.pickPhotoBtn}
            onPress={handlePickImage}
            disabled={actionLoading}
          >
            <Ionicons name="image-outline" size={20} color={Colors.primary700} />
            <Text style={styles.pickPhotoBtnText}>Add Photo</Text>
          </TouchableOpacity>

          {selectedPhotos.length > 0 && (
            <PrimaryButton
              label="Upload Photos"
              onPress={handleUploadPhotos}
              loading={actionLoading}
              style={styles.uploadBtn}
            />
          )}
        </Section>

        {canUpdateStatus && (
          <Section title="Actions">
            {order.status === "ready_for_delivery" && (
              <PrimaryButton
                label="Start Processing"
                onPress={() => handleStatusUpdate("processing")}
                loading={actionLoading}
                icon="play-circle-outline"
              />
            )}

            {order.status === "processing" && (
              <>
                <PrimaryButton
                  label="Mark as Delivered"
                  onPress={() => handleStatusUpdate("delivered")}
                  loading={actionLoading}
                  icon="checkmark-done-outline"
                />
                <PrimaryButton
                  label="Cancel Order"
                  onPress={handleCancel}
                  loading={actionLoading}
                  style={styles.dangerBtn}
                  textStyle={styles.dangerBtnText}
                  icon="close-circle-outline"
                />
              </>
            )}

            {order.status === "delivered" && (
              <>
                <PrimaryButton
                  label="Mark as Completed"
                  onPress={() => handleStatusUpdate("completed")}
                  loading={actionLoading}
                  icon="checkmark-circle-outline"
                />
                <PrimaryButton
                  label="Cancel Order"
                  onPress={handleCancel}
                  loading={actionLoading}
                  style={styles.dangerBtn}
                  textStyle={styles.dangerBtnText}
                  icon="close-circle-outline"
                />
              </>
            )}
          </Section>
        )}

        {order.notes && (
          <Section title="Notes">
            <Text style={styles.noteText}>{order.notes}</Text>
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  loading,
  icon,
  style,
  textStyle,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: string;
  style?: any;
  textStyle?: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={Colors.white} />
      ) : (
        <>
          {icon && <Ionicons name={icon as any} size={18} color={Colors.white} />}
          <Text style={[styles.buttonText, textStyle]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function getStatusStyle(status: TradeInOrderStatus) {
  switch (status) {
    case "processing":
      return { bg: "#DBEAFE", text: "#1D4ED8" };
    case "ready_for_delivery":
      return { bg: "#FEE2E2", text: "#B91C1C" };
    case "delivered":
      return { bg: "#E0F2FE", text: "#0369A1" };
    case "completed":
      return { bg: "#DCFCE7", text: "#166534" };
    case "cancelled":
      return { bg: "#F3F4F6", text: "#6B7280" };
    default:
      return { bg: "#FEF3C7", text: "#92400E" };
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.primary900,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.base,
  },
  errorText: {
    color: Colors.gray700,
    fontSize: Typography.lg,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardCode: {
    color: Colors.gray700,
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  cardTimestamp: {
    marginTop: 4,
    color: Colors.gray500,
    fontSize: Typography.xs,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.primary900,
    fontSize: Typography.md,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  sectionContent: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  kvRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  kvLabel: {
    color: Colors.gray600,
    fontSize: Typography.sm,
    fontWeight: "600",
    marginBottom: 4,
  },
  kvValue: {
    color: Colors.gray900,
    fontSize: Typography.base,
    fontWeight: "500",
  },
  photosContainer: {
    marginBottom: Spacing.md,
  },
  photosLabel: {
    color: Colors.gray700,
    fontSize: Typography.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  photoWrapper: {
    position: "relative",
    width: "31%",
    aspectRatio: 1,
  },
  photoThumb: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.gray100,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary700,
    alignItems: "center",
    justifyContent: "center",
  },
  noPhotosText: {
    color: Colors.gray500,
    fontSize: Typography.sm,
    fontStyle: "italic",
    paddingVertical: Spacing.base,
  },
  pickPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary700,
    backgroundColor: Colors.primary50,
    marginBottom: Spacing.sm,
  },
  pickPhotoBtnText: {
    color: Colors.primary700,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  uploadBtn: {
    marginTop: Spacing.base,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary700,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  buttonText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  dangerBtn: {
    backgroundColor: "#EF4444",
  },
  dangerBtnText: {
    color: Colors.white,
  },
  noteText: {
    color: Colors.gray700,
    fontSize: Typography.base,
    lineHeight: 22,
  },
});

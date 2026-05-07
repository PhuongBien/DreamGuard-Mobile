import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { useTask } from "../../context/TaskContext";
import { Task } from "../../types";
import { TaskStackParamList } from "../../types/navigation";
import { uploadImageToCloudinary } from "../../utils/cloudinary";
import { DeliveryTaskService } from "../../services/delivery-task.service";
import {
  BorderRadius,
  Colors,
  Spacing,
  Typography,
} from "../../constants/theme";

type Props = NativeStackScreenProps<TaskStackParamList, "DeliveryPhotoCapture">;

type ReturnOutcome = "delivery_failed" | "return" | "exchange";

const RETURN_OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  delivery_failed: "Delivery failed.",
  return: "Returns",
  exchange: "Exchange (renew)",
};

const RETURN_REASONS: Record<ReturnOutcome, string[]> = {
  delivery_failed: [
    "Customer not home",
    "Unable to contact customer",
    "Customer refused to accept the package",
    "Wrong delivery address",
    "Other",
  ],
  return: [
    "Customer requests return",
    "Product is damaged",
    "Wrong item delivered",
    "Missing accessories/items",
    "Other",
  ],
  exchange: [
    "Exchange due to product defect",
    "Exchange requested",
    "Wrong item delivered",
    "Schedule new delivery",
    "Other",
  ],
};

const CANCEL_REASONS: string[] = [
  "Device mismatch / negotiation failed",
  "Customer refused the trade-in request",
  "Unable to verify condition",
  "Other",
];

type DamagedDraft = {
  selected: boolean;
  damagedQuantity: number;
  itemReason: string;
};

export default function DeliveryPhotoCaptureScreen({
  route,
  navigation,
}: Props) {
  const {
    shippingTaskId,
    mode,
    tradeInFlow,
    requiresCodPaymentEvidence = false,
  } = route.params;
  const { tasks, markDelivered, markReturned, addTaskPhoto } = useTask();

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [codPaymentUri, setCodPaymentUri] = useState<string | null>(null);
  const [returnOutcome, setReturnOutcome] =
    useState<ReturnOutcome>("delivery_failed");
  const [reason, setReason] = useState<string>(() => {
    return mode === "forced_cancelled" ? CANCEL_REASONS[0] : RETURN_REASONS.delivery_failed[0];
  });
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [damagedDraftByItemId, setDamagedDraftByItemId] = useState<
    Record<string, DamagedDraft>
  >({});

  const isReturnedMode = mode === "returned";
  const isForcedCancelledMode = mode === "forced_cancelled";
  // For trade-in flow, the delivered endpoint expects only `evidenceUrls`,
  // so we include COD payment proof as an extra evidence photo when needed.
  const needsCodReceipt = mode === "delivered" && requiresCodPaymentEvidence;
  const needsReason = isReturnedMode || isForcedCancelledMode;
  const usesCustomReason =
    needsReason && reason.trim().toLowerCase() === "other";
  const finalReason = usesCustomReason ? customReason.trim() : reason.trim();

  const showReturnOutcomeAndDamagedItems = isReturnedMode && !tradeInFlow;
  const reasonOptions = isForcedCancelledMode
    ? CANCEL_REASONS
    : isReturnedMode
      ? showReturnOutcomeAndDamagedItems
        ? RETURN_REASONS[returnOutcome]
        : RETURN_REASONS.delivery_failed
      : RETURN_REASONS.delivery_failed;

  const task = useMemo(
    () => tasks.find((t: Task) => t.id === shippingTaskId),
    [shippingTaskId, tasks],
  );
  const availableProducts = useMemo(
    () => (task?.products || []).filter((p) => !!p?.id),
    [task],
  );
  const itemReasonOptions = useMemo(
    () => ["Damaged", "Wrong item delivered", "Missing items", "Other"],
    [],
  );

  const copy = useMemo(
    () =>
      isForcedCancelledMode
        ? {
            title: "Forced cancel (trade-in).",
            subtitle:
              "Capture evidence and provide a reason (e.g. old device not matching the negotiation).",
            button: "Confirm forced cancel",
          }
        : isReturnedMode
          ? {
              title: "Delivery failed.",
              subtitle:
                "Select status (delivery failed / return / exchange), select reason, select damaged products and take evidence photos before updating.",
              button: "Confirm failed delivery",
            }
          : {
              title: "Delivery successful",
              subtitle: needsCodReceipt
                ? "Capture delivery proof, then a separate photo proving COD payment was received."
                : "Capture evidence of successful delivery.",
              button: "Confirm successful delivery",
            },
    [isReturnedMode, isForcedCancelledMode, needsCodReceipt],
  );

  const takeDeliveryPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Missing camera permission",
          "Camera permission is required to capture evidence.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setImageUris((prev) => {
          const nextUri = result.assets[0].uri;
          if (prev.includes(nextUri)) return prev;
          return [...prev, nextUri];
        });
      }
    } catch (error: any) {
      Alert.alert(
        "Cannot take photo",
        error?.message || "An error occurred while opening the camera.",
      );
    }
  };

  const takeCodPaymentPhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Missing camera permission",
          "Camera permission is required to capture payment proof.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        setCodPaymentUri(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert(
        "Cannot take photo",
        error?.message || "An error occurred while opening the camera.",
      );
    }
  };

  const handleSubmit = async () => {
    if (!imageUris.length) {
      Alert.alert(
        "Missing evidence",
        "You need to capture a photo before confirming.",
      );
      return;
    }

    if (needsCodReceipt && !codPaymentUri) {
      Alert.alert(
        "Missing COD payment proof",
        "COD orders require a photo proving payment was collected.",
      );
      return;
    }

    if (needsReason && !finalReason) {
      Alert.alert(
        "Missing reason",
        "You need to select a reason before confirming.",
      );
      return;
    }

    try {
      setLoading(true);

      const uploadedUrls: string[] = [];

      if (tradeInFlow) {
        for (const imageUri of imageUris) {
          const uploadedUrl = await uploadImageToCloudinary(imageUri);
          if (uploadedUrl) uploadedUrls.push(uploadedUrl);
        }
        if (!uploadedUrls.length) {
          throw new Error("Could not upload evidence images.");
        }
        if (isForcedCancelledMode) {
          await DeliveryTaskService.markForcedCancelledForTradeIn(
            shippingTaskId,
            finalReason,
            uploadedUrls,
          );
        } else if (isReturnedMode) {
          await DeliveryTaskService.markReturnedForTradeIn(
            shippingTaskId,
            finalReason,
            uploadedUrls,
          );
        } else {
          // Trade-in "delivered" requires evidenceUrls.
          // Business requirement: include BOTH delivery proof and COD payment proof (if required)
          // in the same ShippingTask delivered-for-tradeIn request.
          const evidenceUrlsForDelivered = [...uploadedUrls];
          if (needsCodReceipt && codPaymentUri) {
            const paymentUrl = await uploadImageToCloudinary(codPaymentUri);
            if (!paymentUrl) {
              throw new Error("Could not upload COD payment proof.");
            }
            evidenceUrlsForDelivered.push(paymentUrl);
          }

          await DeliveryTaskService.markDeliveredForTradeIn(
            shippingTaskId,
            evidenceUrlsForDelivered,
          );
        }
      } else {
        for (const imageUri of imageUris) {
          const uploadedUrl = await addTaskPhoto(shippingTaskId, {
            url: imageUri,
            type: "evidence",
            uploadedBy: "delivery_staff",
            captureStage: isReturnedMode
              ? "delivery_failed"
              : isForcedCancelledMode
                ? "delivery_failed"
                : "delivery_success",
          });
          uploadedUrls.push(uploadedUrl);
        }

        if (isReturnedMode) {
          const damagedItems = Object.entries(damagedDraftByItemId)
            .filter(
              ([_, draft]) => draft?.selected && draft.damagedQuantity > 0,
            )
            .map(([orderItemId, draft]) => ({
              orderItemId,
              damagedQuantity: draft.damagedQuantity,
            }));

          const outcomeLabel = RETURN_OUTCOME_LABELS[returnOutcome];
          const baseReason = `${outcomeLabel} - ${finalReason}`.trim();
          // IMPORTANT:
          // - Backend is expected to store `reason` (often in `staffNote`).
          // - Do NOT serialize damaged item details into `reason`.
          // - Send damaged items through `damagedItems` only.
          const reasonText = baseReason;

          await markReturned(shippingTaskId, {
            reason: reasonText,
            evidenceUrls: uploadedUrls,
            damagedItems,
          });
        } else {
          let paymentEvidenceUrl: string | undefined;
          if (needsCodReceipt && codPaymentUri) {
            const url = await uploadImageToCloudinary(codPaymentUri);
            if (!url) throw new Error("Could not upload COD payment proof.");
            paymentEvidenceUrl = url;
          }
          await markDelivered(shippingTaskId, uploadedUrls, {
            paymentEvidenceUrl,
          });
        }
      }

      Alert.alert(
        "Success",
        isForcedCancelledMode
          ? "The task has been updated as forced cancelled."
          : isReturnedMode
            ? "The task has been updated as a failed delivery."
            : "The task has been updated as a successful delivery.",
        [{ text: "OK", onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert(
        "Cannot update",
        error?.message || "Cannot submit evidence for this task.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.subtitle}>{copy.subtitle}</Text>

      {needsReason ? (
        <View style={styles.reasonBlock}>
          {showReturnOutcomeAndDamagedItems ? (
            <>
              <Text style={styles.sectionLabel}>Processing status</Text>
              <View style={styles.reasonWrap}>
                {(Object.keys(RETURN_OUTCOME_LABELS) as ReturnOutcome[]).map(
                  (key) => {
                    const active = returnOutcome === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[
                          styles.reasonChip,
                          active && styles.reasonChipActive,
                        ]}
                        activeOpacity={0.85}
                        disabled={loading}
                        onPress={() => {
                          setReturnOutcome(key);
                          setReason(RETURN_REASONS[key][0]);
                          setCustomReason("");
                        }}
                      >
                        <Text
                          style={[
                            styles.reasonText,
                            active && styles.reasonTextActive,
                          ]}
                        >
                          {RETURN_OUTCOME_LABELS[key]}
                        </Text>
                      </TouchableOpacity>
                    );
                  },
                )}
              </View>
            </>
          ) : null}

          <Text style={styles.sectionLabel}>Reason</Text>

          <View style={styles.reasonWrap}>
            {reasonOptions.map((item) => {
              const active = reason === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                  activeOpacity={0.85}
                  disabled={loading}
                  onPress={() => setReason(item)}
                >
                  <Text
                    style={[
                      styles.reasonText,
                      active && styles.reasonTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {usesCustomReason ? (
            <TextInput
              style={styles.customReasonInput}
              value={customReason}
              onChangeText={setCustomReason}
              placeholder="Enter a specific reason"
              placeholderTextColor={Colors.gray400}
              editable={!loading}
              multiline
            />
          ) : null}

          {showReturnOutcomeAndDamagedItems ? (
            <View style={styles.damagedBlock}>
              <Text style={styles.sectionLabel}>Select damaged products</Text>
              {availableProducts.length ? (
                availableProducts.map((product) => {
                  // IMPORTANT:
                  // Backend expects damagedItems[].orderItemId to match the stable order item id.
                  // Our ProductItem has `orderItemId?` (preferred) and `id` (may be local fallback).
                  const orderItemKey = String(
                    product.orderItemId ?? product.id ?? "",
                  ).trim();
                  if (!orderItemKey) return null;

                  const draft = damagedDraftByItemId[orderItemKey] ?? {
                    selected: false,
                    damagedQuantity: 1,
                    itemReason: itemReasonOptions[0],
                  };
                  const maxQty = Math.max(
                    1,
                    Number(product.totalQuantity ?? product.quantity ?? 1),
                  );
                  const qty = Math.min(
                    Math.max(1, draft.damagedQuantity || 1),
                    maxQty,
                  );
                  const active = !!draft.selected;

                  return (
                    <View key={orderItemKey} style={styles.damagedRow}>
                      <TouchableOpacity
                        style={styles.damagedSelectBtn}
                        activeOpacity={0.85}
                        disabled={loading}
                        onPress={() =>
                          setDamagedDraftByItemId((prev) => ({
                            ...prev,
                            [orderItemKey]: {
                              ...draft,
                              selected: !draft.selected,
                              damagedQuantity: qty,
                            },
                          }))
                        }
                      >
                        <Ionicons
                          name={active ? "checkbox-outline" : "square-outline"}
                          size={22}
                          color={active ? Colors.primary700 : Colors.gray500}
                        />
                        <View style={styles.damagedInfo}>
                          <Text style={styles.damagedName}>{product.name}</Text>
                          <Text style={styles.damagedMeta}>
                            maximum quantity: {maxQty}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View style={styles.damagedControls}>
                        <View style={styles.qtyRow}>
                          <Text style={styles.qtyLabel}>Quantity</Text>
                          
                          <View style={styles.qtyStepper}>
                            <TouchableOpacity
                              style={[styles.qtyStepperBtn, (!active || qty <= 1 || loading) && styles.qtyStepperBtnDisabled]}
                              activeOpacity={0.8}
                              disabled={!active || qty <= 1 || loading}
                              onPress={() => {
                                setDamagedDraftByItemId((prev) => ({
                                  ...prev,
                                  [orderItemKey]: {
                                    ...draft,
                                    selected: true,
                                    damagedQuantity: Math.max(1, qty - 1),
                                  },
                                }));
                              }}
                            >
                              <Ionicons name="remove" size={20} color={(!active || qty <= 1 || loading) ? Colors.gray400 : Colors.primary700} />
                            </TouchableOpacity>

                            <TextInput
                              style={[
                                styles.qtyInput,
                                !active && styles.qtyInputDisabled,
                              ]}
                              value={String(qty)}
                              editable={active && !loading}
                              keyboardType="number-pad"
                              onChangeText={(txt) => {
                                const raw = Number(txt.replace(/[^\d]/g, ""));
                                const next = Number.isFinite(raw) ? raw : 1;
                                const clamped = Math.min(
                                  Math.max(1, next),
                                  maxQty,
                                );
                                setDamagedDraftByItemId((prev) => ({
                                  ...prev,
                                  [orderItemKey]: {
                                    ...draft,
                                    selected: true,
                                    damagedQuantity: clamped,
                                  },
                                }));
                              }}
                            />

                            <TouchableOpacity
                              style={[styles.qtyStepperBtn, (!active || qty >= maxQty || loading) && styles.qtyStepperBtnDisabled]}
                              activeOpacity={0.8}
                              disabled={!active || qty >= maxQty || loading}
                              onPress={() => {
                                setDamagedDraftByItemId((prev) => ({
                                  ...prev,
                                  [orderItemKey]: {
                                    ...draft,
                                    selected: true,
                                    damagedQuantity: Math.min(maxQty, qty + 1),
                                  },
                                }));
                              }}
                            >
                              <Ionicons name="add" size={20} color={(!active || qty >= maxQty || loading) ? Colors.gray400 : Colors.primary700} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* <Text style={styles.qtyLabel}>Lý do sản phẩm</Text>
                        <View style={styles.itemReasonWrap}>
                          {itemReasonOptions.map((opt) => {
                            const on = draft.itemReason === opt;
                            return (
                              <TouchableOpacity
                                key={`${product.id}_${opt}`}
                                style={[
                                  styles.itemReasonChip,
                                  on && styles.itemReasonChipActive,
                                  (!active || loading) &&
                                    styles.itemReasonChipDisabled,
                                ]}
                                activeOpacity={0.85}
                                disabled={!active || loading}
                                onPress={() =>
                                  setDamagedDraftByItemId((prev) => ({
                                    ...prev,
                                    [product.id]: {
                                      ...draft,
                                      selected: true,
                                      itemReason: opt,
                                    },
                                  }))
                                }
                              >
                                <Text
                                  style={[
                                    styles.itemReasonText,
                                    on && styles.itemReasonTextActive,
                                  ]}
                                >
                                  {opt}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View> */}
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.damagedEmpty}>
                  No products were found in the order to select from.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Delivery evidence photos</Text>
      <TouchableOpacity
        style={styles.captureBox}
        activeOpacity={0.85}
        onPress={takeDeliveryPhoto}
        disabled={loading}
      >
        {imageUris.length ? (
          <View style={styles.previewGrid}>
            {imageUris.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.previewImage} />
            ))}
          </View>
        ) : (
          <View style={styles.placeholderWrap}>
            <Ionicons name="camera-outline" size={40} color={Colors.gray400} />
            <Text style={styles.placeholderTitle}>
              Capture using camera only
            </Text>
            <Text style={styles.placeholderSubTitle}>
              Tap to open the camera. You can capture multiple evidence photos.
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.retakeButton}
        activeOpacity={0.85}
        disabled={loading}
        onPress={takeDeliveryPhoto}
      >
        <Ionicons name="refresh-outline" size={16} color={Colors.primary700} />
        <Text style={styles.retakeText}>
          {imageUris.length ? "Capture more photos" : "Open camera"}
        </Text>
      </TouchableOpacity>

      {imageUris.length ? (
        <TouchableOpacity
          style={styles.clearButton}
          activeOpacity={0.85}
          disabled={loading}
          onPress={() => setImageUris([])}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={styles.clearButtonText}>Clear all delivery photos</Text>
        </TouchableOpacity>
      ) : null}

      {needsCodReceipt ? (
        <>
          <Text style={styles.sectionLabel}>
            COD — proof payment received{" "}
            <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.captureBox}
            activeOpacity={0.85}
            onPress={takeCodPaymentPhoto}
            disabled={loading}
          >
            {codPaymentUri ? (
              <Image
                source={{ uri: codPaymentUri }}
                style={styles.codPreview}
              />
            ) : (
              <View style={styles.placeholderWrap}>
                <Ionicons
                  name="cash-outline"
                  size={40}
                  color={Colors.gray400}
                />
                <Text style={styles.placeholderTitle}>
                  Capture payment receipt
                </Text>
                <Text style={styles.placeholderSubTitle}>
                  Photo showing cash handed over, signed receipt, or other proof
                  the customer paid.
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.retakeButton}
            activeOpacity={0.85}
            disabled={loading}
            onPress={takeCodPaymentPhoto}
          >
            <Ionicons
              name="refresh-outline"
              size={16}
              color={Colors.primary700}
            />
            <Text style={styles.retakeText}>
              {codPaymentUri ? "Retake payment proof" : "Open camera"}
            </Text>
          </TouchableOpacity>

          {codPaymentUri ? (
            <TouchableOpacity
              style={styles.clearButton}
              activeOpacity={0.85}
              disabled={loading}
              onPress={() => setCodPaymentUri(null)}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={styles.clearButtonText}>Remove payment proof</Text>
            </TouchableOpacity>
          ) : null}
        </>
      ) : null}

      <TouchableOpacity
        style={[
          styles.submitButton,
          (!imageUris.length ||
            (needsCodReceipt && !codPaymentUri) ||
            loading) &&
            styles.submitButtonDisabled,
        ]}
        activeOpacity={0.85}
        disabled={
          !imageUris.length || (needsCodReceipt && !codPaymentUri) || loading
        }
        onPress={handleSubmit}
      >
        {loading ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.submitButtonText}>{copy.button}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F4F7FB",
    padding: Spacing.base,
  },
  title: {
    color: Colors.primary900,
    fontSize: Typography["2xl"],
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    color: Colors.gray600,
    fontSize: Typography.base,
    lineHeight: 22,
  },
  sectionLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    color: Colors.primary900,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  reasonBlock: {
    marginTop: Spacing.sm,
  },
  reasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  reasonChipActive: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  reasonText: {
    color: Colors.gray700,
    fontSize: Typography.sm,
    fontWeight: "600",
  },
  reasonTextActive: {
    color: "#B91C1C",
  },
  captureBox: {
    minHeight: 300,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  previewGrid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 8,
  },
  previewImage: {
    width: "48%",
    height: 140,
    borderRadius: BorderRadius.md,
  },
  codPreview: {
    width: "92%",
    height: 220,
    marginVertical: 12,
    borderRadius: BorderRadius.md,
    alignSelf: "center",
  },
  requiredMark: {
    color: Colors.error,
  },
  placeholderWrap: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  placeholderTitle: {
    marginTop: 12,
    color: Colors.primary900,
    fontSize: Typography.md,
    fontWeight: "700",
  },
  placeholderSubTitle: {
    marginTop: 6,
    color: Colors.gray500,
    fontSize: Typography.base,
    textAlign: "center",
    lineHeight: 20,
  },
  retakeButton: {
    marginTop: Spacing.base,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  retakeText: {
    color: Colors.primary700,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  clearButton: {
    marginTop: Spacing.sm,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  clearButtonText: {
    color: Colors.error,
    fontSize: Typography.base,
    fontWeight: "600",
  },
  customReasonInput: {
    marginTop: Spacing.base,
    minHeight: 92,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.gray800,
    fontSize: Typography.base,
    textAlignVertical: "top",
  },
  damagedBlock: {
    marginTop: Spacing.lg,
    gap: 10,
  },
  damagedRow: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.md,
    padding: 12,
    gap: 10,
  },
  damagedSelectBtn: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  damagedInfo: {
    flex: 1,
    gap: 4,
  },
  damagedName: {
    color: Colors.gray800,
    fontSize: Typography.base,
    fontWeight: "700",
  },
  damagedMeta: {
    color: Colors.gray500,
    fontSize: Typography.xs,
    lineHeight: 16,
  },
  damagedControls: {
    gap: 10,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  qtyLabel: {
    color: Colors.gray700,
    fontSize: Typography.sm,
    fontWeight: "700",
  },
  qtyInput: {
    width: 60,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray300,
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    color: Colors.gray800,
    fontSize: Typography.base,
    fontWeight: "700",
    textAlign: "center",
  },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  qtyStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyStepperBtnDisabled: {
    opacity: 0.5,
  },
  qtyInputDisabled: {
    opacity: 0.45,
  },
  itemReasonWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  itemReasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray300,
  },
  itemReasonChipActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  itemReasonChipDisabled: {
    opacity: 0.45,
  },
  itemReasonText: {
    color: Colors.gray700,
    fontSize: Typography.xs,
    fontWeight: "700",
  },
  itemReasonTextActive: {
    color: "#1D4ED8",
  },
  damagedEmpty: {
    color: Colors.gray600,
    fontSize: Typography.base,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: "auto",
    minHeight: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary700,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    color: Colors.white,
    fontSize: Typography.md,
    fontWeight: "700",
  },
});

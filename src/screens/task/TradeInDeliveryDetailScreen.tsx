// import React, {
//   useCallback,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   Image,
//   ScrollView,
//   StatusBar,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import { NativeStackScreenProps } from "@react-navigation/native-stack";
// import { useFocusEffect } from "@react-navigation/native";
// import * as ImagePicker from "expo-image-picker";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

// import {
//   TradeInOrder,
//   ShippingTask,
//   StaffProfile,
//   VariantDetail,
//   PaymentHistoryItem,
// } from "../../types";
// import { TaskStackParamList } from "../../types/navigation";
// import {
//   BorderRadius,
//   Colors,
//   Shadow,
//   Spacing,
//   Typography,
// } from "../../constants/theme";
// import { formatDate } from "../../utils/date";
// import { TradeInOrderService } from "../../services/trade-in-order.service";
// import { uploadImageToCloudinary } from "../../utils/cloudinary";
// import {
//   fetchShippingTaskById,
//   fetchShippingTasksByTradeInOrderId,
//   fetchStaffById,
//   fetchVariantById,
//   fetchPaymentAdminByOrderCode,
//   updateShippingTaskDeliveringForTradeIn,
//   updateShippingTaskDeliveredForTradeIn,
//   updateShippingTaskReturnedForTradeIn,
//   ShippingTaskStatusPayload,
// } from "../../utils/api";

// type Props = NativeStackScreenProps<TaskStackParamList, "TaskDetail">;

// const TRADEIN_DELIVERY_STATUS_LABELS = {
//   pending: "Pending",
//   delivering: "Delivering",
//   arrived: "Arrived",
//   delivered: "Delivered",
//   returned: "Returned",
// } as const;

// export default function TradeInDeliveryDetailScreen({
//   route,
//   navigation,
// }: Props) {
//   const { taskId, shippingTaskId: routeShippingTaskId } = route.params as any;
//   console.log("👉 [DEBUG] route.params:", route.params);
//   console.log("👉 [DEBUG] taskId:", taskId);
//   console.log("👉 [DEBUG] routeShippingTaskId:", routeShippingTaskId);

//   const [order, setOrder] = useState<TradeInOrder | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [actionLoading, setActionLoading] = useState(false);
//   const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
//   const [deliveryStatus, setDeliveryStatus] = useState<
//     "pending" | "delivering" | "arrived" | "delivered" | "returned"
//   >("pending");
//   const [failureReason, setFailureReason] = useState<string>("");
//   const [shippingTask, setShippingTask] = useState<ShippingTask | null>(null);
//   const [assignedStaff, setAssignedStaff] = useState<StaffProfile | null>(null);
//   const [variantDetail, setVariantDetail] = useState<VariantDetail | null>(
//     null,
//   );
//   const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>(
//     [],
//   );
//   const [shippingTaskLoading, setShippingTaskLoading] = useState(false);
//   const [paymentLoading, setPaymentLoading] = useState(false);

//   const orderRef = useRef<TradeInOrder | null>(null);
//   const shippingTaskId = routeShippingTaskId || order?.shippingTaskId;

//   const loadAssignedStaff = useCallback(async (staffId?: string) => {
//     if (!staffId) return null;
//     try {
//       return (await fetchStaffById(staffId)).data;
//     } catch (error) {
//       return null;
//     }
//   }, []);

//   const loadVariantDetail = useCallback(async (variantId?: string) => {
//     if (!variantId) return null;
//     try {
//       return (await fetchVariantById(variantId)).data;
//     } catch (error) {
//       return null;
//     }
//   }, []);

//   const loadPaymentHistory = useCallback(async (orderCode?: string) => {
//     if (!orderCode) {
//       setPaymentHistory([]);
//       return;
//     }

//     try {
//       setPaymentLoading(true);
//       console.log("📡 fetchPaymentAdminByOrderCode:", orderCode);
//       const response = await fetchPaymentAdminByOrderCode(orderCode);
//       console.log("✅ payment response:", response.data);
//       setPaymentHistory(response.data?.items ?? []);
//     } catch (error) {
//       setPaymentHistory([]);
//     } finally {
//       setPaymentLoading(false);
//     }
//   }, []);

//   const loadShippingTaskInfo = useCallback(
//     async (order: TradeInOrder) => {
//       const taskIdToLoad =
//         routeShippingTaskId || order.shippingTaskId || order.tradeInOrderId;
//       if (!taskIdToLoad) return null;

//       try {
//         setShippingTaskLoading(true);
//         if (routeShippingTaskId || order.shippingTaskId) {
//           console.log("📡 fetchShippingTaskById:", taskIdToLoad);
//           const response = await fetchShippingTaskById(taskIdToLoad);
//           console.log("✅ shippingTask response:", response.data);
//           return response.data;
//         }

//         console.log("📡 fetchShippingTasksByTradeInOrderId:", taskIdToLoad);
//         const response = await fetchShippingTasksByTradeInOrderId(taskIdToLoad);
//         console.log("✅ shippingTasks list:", response.data);
//         return response.data?.items?.[0] ?? null;
//       } catch (error) {
//         return null;
//       } finally {
//         setShippingTaskLoading(false);
//       }
//     },
//     [routeShippingTaskId],
//   );

//   const loadOrder = useCallback(async () => {
//     console.log("🚀 [loadOrder] START");

//     if (!taskId) {
//       console.error("❌ taskId is undefined → STOP CALL API");
//       return;
//     }
//     try {
//       setLoading(true);
//       console.log("📡 Calling fetchById with taskId:", taskId);
//       const loaded = await TradeInOrderService.fetchById(taskId);
//       console.log("✅ fetchById response:", loaded);
//       if (loaded) {
//         setOrder(loaded);
//         orderRef.current = loaded;

//         const shippingTaskData = await loadShippingTaskInfo(loaded);
//         setShippingTask(shippingTaskData ?? null);

//         if (shippingTaskData?.staffId) {
//           const staff = await loadAssignedStaff(shippingTaskData.staffId);
//           setAssignedStaff(staff ?? null);
//         }

//         if (
//           loaded.devices.newDevice?.type === "variant" &&
//           loaded.devices.newDevice.id
//         ) {
//           const variant = await loadVariantDetail(loaded.devices.newDevice.id);
//           setVariantDetail(variant ?? null);
//         }

//         await loadPaymentHistory(loaded.orderCode);
//       }
//     } catch (error: any) {
//       console.error("❌ Failed to load TradeIn order FULL ERROR:", error);
//       console.error("❌ error.response:", error?.response);
//       console.error("❌ error.response.data:", error?.response?.data);
//       Alert.alert("Error", "Failed to load order details");
//     } finally {
//       setLoading(false);
//     }
//   }, [
//     taskId,
//     loadAssignedStaff,
//     loadPaymentHistory,
//     loadShippingTaskInfo,
//     loadVariantDetail,
//   ]);

//   useFocusEffect(
//     useCallback(() => {
//       loadOrder();
//     }, [loadOrder]),
//   );

//   const handlePickEvidencePhoto = useCallback(async () => {
//     try {
//       const result = await ImagePicker.launchCameraAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: true,
//         aspect: [4, 3],
//         quality: 0.8,
//       });

//       if (!result.canceled && result.assets[0]) {
//         setEvidencePhotos((prev) => [...prev, result.assets[0].uri]);
//       }
//     } catch (error) {
//       Alert.alert("Error", "Failed to capture image");
//     }
//   }, []);

//   const handleUploadEvidencePhotos = useCallback(
//     async (newStatus: "delivering" | "arrived" | "delivered" | "returned") => {
//       if (!shippingTaskId || evidencePhotos.length === 0) {
//         Alert.alert("Error", "Please add at least one evidence photo");
//         return;
//       }

//       try {
//         setActionLoading(true);

//         const evidenceUrls: string[] = [];
//         for (const photoUri of evidencePhotos) {
//           const cloudinaryUrl = await uploadImageToCloudinary(photoUri);
//           if (cloudinaryUrl) {
//             evidenceUrls.push(cloudinaryUrl);
//           }
//         }

//         if (evidenceUrls.length === 0) {
//           Alert.alert("Error", "Failed to upload photos");
//           return;
//         }

//         const payload: ShippingTaskStatusPayload = {
//           evidenceUrls,
//           ...(newStatus === "returned" && { reason: failureReason }),
//         };

//         let response;
//         if (newStatus === "delivering") {
//           response = await updateShippingTaskDeliveringForTradeIn(
//             shippingTaskId,
//             payload,
//           );
//         } else if (newStatus === "delivered") {
//           response = await updateShippingTaskDeliveredForTradeIn(
//             shippingTaskId,
//             payload,
//           );
//         } else if (newStatus === "returned") {
//           response = await updateShippingTaskReturnedForTradeIn(
//             shippingTaskId,
//             payload,
//           );
//         }

//         if (response?.success) {
//           setDeliveryStatus(newStatus);
//           setEvidencePhotos([]);
//           setFailureReason("");
//           Alert.alert(
//             "Success",
//             `Order status updated to ${TRADEIN_DELIVERY_STATUS_LABELS[newStatus]}`,
//           );
//         }
//       } catch (error) {
//         console.error("Failed to update delivery status:", error);
//         Alert.alert("Error", "Failed to update delivery status");
//       } finally {
//         setActionLoading(false);
//       }
//     },
//     [shippingTaskId, evidencePhotos, failureReason],
//   );

//   if (loading) {
//     return (
//       <SafeAreaView style={styles.safe} edges={["top"]}>
//         <StatusBar
//           barStyle="light-content"
//           backgroundColor={Colors.primary900}
//         />
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color={Colors.primary700} />
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (!order) {
//     return (
//       <SafeAreaView style={styles.safe} edges={["top"]}>
//         <StatusBar
//           barStyle="light-content"
//           backgroundColor={Colors.primary900}
//         />
//         <View style={styles.errorContainer}>
//           <Text style={styles.errorText}>Order not found</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   return (
//     <SafeAreaView style={styles.safe} edges={["top"]}>
//       <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />

//       <View style={styles.header}>
//         <TouchableOpacity onPress={() => navigation.goBack()}>
//           <Ionicons name="chevron-back" size={24} color={Colors.white} />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Trade-In Delivery</Text>
//         <View style={{ width: 24 }} />
//       </View>

//       <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
//         {/* Order Card */}
//         <View style={styles.card}>
//           <View style={styles.cardHeader}>
//             <View>
//               <Text style={styles.cardCode}>{order.orderCode}</Text>
//               <Text style={styles.cardTimestamp}>
//                 {formatDate(order.createdAt || new Date().toISOString())}
//               </Text>
//             </View>
//             <View
//               style={[
//                 styles.statusBadge,
//                 { backgroundColor: getDeliveryStatusColor(deliveryStatus).bg },
//               ]}
//             >
//               <Text
//                 style={[
//                   styles.statusText,
//                   { color: getDeliveryStatusColor(deliveryStatus).text },
//                 ]}
//               >
//                 {TRADEIN_DELIVERY_STATUS_LABELS[deliveryStatus]}
//               </Text>
//             </View>
//           </View>
//         </View>

//         {/* Shipping Task Details */}
//         <Section title="Shipping Task">
//           {shippingTaskLoading ? (
//             <ActivityIndicator size="small" color={Colors.primary700} />
//           ) : (
//             <>
//               <KeyValueRow
//                 label="Task ID"
//                 value={shippingTask?.shippingTaskId || "Not available"}
//               />
//               <KeyValueRow
//                 label="Status"
//                 value={shippingTask?.status || "Not available"}
//               />
//               <KeyValueRow
//                 label="Assigned Staff"
//                 value={
//                   shippingTask?.staffName ||
//                   assignedStaff?.fullName ||
//                   "Not assigned"
//                 }
//               />
//               <KeyValueRow
//                 label="Shipping Date"
//                 value={
//                   shippingTask?.shippingDate
//                     ? formatDate(shippingTask.shippingDate)
//                     : "Not set"
//                 }
//               />
//               <KeyValueRow
//                 label="Completion Date"
//                 value={
//                   shippingTask?.completionDate
//                     ? formatDate(shippingTask.completionDate)
//                     : "Not set"
//                 }
//               />
//               <KeyValueRow
//                 label="Staff Note"
//                 value={shippingTask?.staffNote || "No note"}
//               />
//               {shippingTask?.evidences?.length !== undefined && (
//                 <KeyValueRow
//                   label="Evidence count"
//                   value={`${shippingTask.evidences?.length ?? 0}`}
//                 />
//               )}
//             </>
//           )}
//         </Section>

//         {/* Recipient Information */}
//         <Section title="Recipient Information">
//           <KeyValueRow
//             label="Order ID"
//             value={order.orderId || order.tradeInOrderId || order.orderCode}
//           />
//           <KeyValueRow label="Name" value={order.customer.name} />
//           <KeyValueRow label="Phone" value={order.customer.phone} />
//           <KeyValueRow label="Address" value={order.customer.address} />
//           {order.customer.note && (
//             <KeyValueRow label="Note" value={order.customer.note} />
//           )}
//         </Section>

//         {/* Device Information */}
//         <Section title="Device Information">
//           {order.devices.oldDevice && (
//             <>
//               <Text style={styles.deviceSectionTitle}>
//                 Old Device (Trade-In)
//               </Text>
//               <KeyValueRow label="Name" value={order.devices.oldDevice.name} />
//               {order.devices.oldDevice.model && (
//                 <KeyValueRow
//                   label="Model"
//                   value={order.devices.oldDevice.model}
//                 />
//               )}
//               {order.devices.oldDevice.type && (
//                 <KeyValueRow
//                   label="Type"
//                   value={order.devices.oldDevice.type}
//                 />
//               )}
//               {order.devices.oldDevice.description && (
//                 <KeyValueRow
//                   label="Condition"
//                   value={order.devices.oldDevice.description}
//                 />
//               )}
//               {order.devices.oldDevice.quantity && (
//                 <KeyValueRow
//                   label="Quantity"
//                   value={String(order.devices.oldDevice.quantity)}
//                 />
//               )}
//             </>
//           )}

//           {order.devices.oldDevice && order.devices.newDevice && (
//             <View style={styles.divider} />
//           )}

//           {order.devices.newDevice && (
//             <>
//               <Text style={styles.deviceSectionTitle}>New Device</Text>
//               <KeyValueRow label="Name" value={order.devices.newDevice.name} />
//               {order.devices.newDevice.model && (
//                 <KeyValueRow
//                   label="Model"
//                   value={order.devices.newDevice.model}
//                 />
//               )}
//               {order.devices.newDevice.type && (
//                 <KeyValueRow
//                   label="Type"
//                   value={order.devices.newDevice.type}
//                 />
//               )}
//               {order.devices.newDevice.quantity && (
//                 <KeyValueRow
//                   label="Quantity"
//                   value={String(order.devices.newDevice.quantity)}
//                 />
//               )}
//             </>
//           )}

//           {!order.devices.oldDevice && order.productVariant && (
//             <>
//               <View style={styles.divider} />
//               <Text style={styles.deviceSectionTitle}>Product Variant</Text>
//               <KeyValueRow label="Name" value={order.productVariant.name} />
//               {order.productVariant.model && (
//                 <KeyValueRow label="Size" value={order.productVariant.model} />
//               )}
//               {order.productVariant.estimatedPrice !== undefined && (
//                 <KeyValueRow
//                   label="Estimated Price"
//                   value={`${order.productVariant.estimatedPrice.toLocaleString()} VND`}
//                 />
//               )}
//             </>
//           )}
//         </Section>

//         {(assignedStaff || shippingTask?.staffId) && (
//           <Section title="Assigned Staff">
//             <KeyValueRow
//               label="Name"
//               value={
//                 assignedStaff?.fullName || shippingTask?.staffName || "Unknown"
//               }
//             />
//             {assignedStaff?.phoneNumber && (
//               <KeyValueRow label="Phone" value={assignedStaff.phoneNumber} />
//             )}
//             {assignedStaff?.address && (
//               <KeyValueRow label="Address" value={assignedStaff.address} />
//             )}
//             {assignedStaff?.position && (
//               <KeyValueRow label="Position" value={assignedStaff.position} />
//             )}
//           </Section>
//         )}

//         {variantDetail && (
//           <Section title="Variant Details">
//             <KeyValueRow label="SKU" value={variantDetail.sku} />
//             {variantDetail.size && (
//               <KeyValueRow label="Size" value={variantDetail.size} />
//             )}
//             {variantDetail.basePrice !== undefined && (
//               <KeyValueRow
//                 label="Base Price"
//                 value={`${variantDetail.basePrice.toLocaleString()} VND`}
//               />
//             )}
//             {variantDetail.salePrice !== undefined && (
//               <KeyValueRow
//                 label="Sale Price"
//                 value={`${variantDetail.salePrice.toLocaleString()} VND`}
//               />
//             )}
//             {variantDetail.stockStatus && (
//               <KeyValueRow label="Stock" value={variantDetail.stockStatus} />
//             )}
//           </Section>
//         )}

//         {(paymentHistory.length > 0 || paymentLoading) && (
//           <Section title="Payment History">
//             {paymentLoading ? (
//               <ActivityIndicator size="small" color={Colors.primary700} />
//             ) : (
//               paymentHistory.map((payment) => (
//                 <View key={payment.id} style={styles.paymentRow}>
//                   <KeyValueRow
//                     label="Type"
//                     value={payment.paymentType || "-"}
//                   />
//                   <KeyValueRow
//                     label="Method"
//                     value={payment.paymentMethod || "-"}
//                   />
//                   <KeyValueRow label="Status" value={payment.status || "-"} />
//                   <KeyValueRow
//                     label="Amount"
//                     value={payment.amount?.toLocaleString() ?? "-"}
//                   />
//                   <KeyValueRow
//                     label="Created"
//                     value={
//                       payment.createdAt ? formatDate(payment.createdAt) : "-"
//                     }
//                   />
//                 </View>
//               ))
//             )}
//           </Section>
//         )}

//         {/* Trade-In Value */}
//         <Section title="Trade-In Value">
//           {order.priceAgreed !== undefined ? (
//             <View style={styles.priceBox}>
//               <Text style={styles.priceLabel}>Agreed Price</Text>
//               <Text style={styles.priceValue}>
//                 {order.priceAgreed.toLocaleString()} VND
//               </Text>
//             </View>
//           ) : null}

//           {order.amountToPay !== undefined && (
//             <View style={styles.priceBox}>
//               <Text style={styles.priceLabel}>Amount to Pay</Text>
//               <Text style={styles.priceValue}>
//                 {order.amountToPay.toLocaleString()} VND
//               </Text>
//             </View>
//           )}

//           {order.depositAmount !== undefined && (
//             <View style={styles.priceBox}>
//               <Text style={styles.priceLabel}>Deposit</Text>
//               <Text style={styles.priceValue}>
//                 {order.depositAmount.toLocaleString()} VND
//               </Text>
//             </View>
//           )}
//         </Section>

//         {/* Evidence Photos */}
//         <Section title="Delivery Evidence">
//           <View style={styles.photosContainer}>
//             {evidencePhotos.length > 0 && (
//               <>
//                 <Text style={styles.photosLabel}>
//                   Evidence Photos ({evidencePhotos.length})
//                 </Text>
//                 <View style={styles.photoGrid}>
//                   {evidencePhotos.map((uri, idx) => (
//                     <View key={idx} style={styles.photoWrapper}>
//                       <Image source={{ uri }} style={styles.photoThumb} />
//                       <TouchableOpacity
//                         style={styles.photoRemoveBtn}
//                         onPress={() =>
//                           setEvidencePhotos((p) =>
//                             p.filter((_, i) => i !== idx),
//                           )
//                         }
//                       >
//                         <Ionicons name="close" size={16} color={Colors.white} />
//                       </TouchableOpacity>
//                     </View>
//                   ))}
//                 </View>
//               </>
//             )}

//             {evidencePhotos.length === 0 && (
//               <Text style={styles.noPhotosText}>
//                 No evidence photos yet. Capture photo of delivery process.
//               </Text>
//             )}
//           </View>

//           <TouchableOpacity
//             style={styles.cameraBtn}
//             onPress={handlePickEvidencePhoto}
//             disabled={actionLoading}
//           >
//             <MaterialCommunityIcons
//               name="camera"
//               size={20}
//               color={Colors.primary700}
//             />
//             <Text style={styles.cameraBtnText}>Capture Evidence</Text>
//           </TouchableOpacity>
//         </Section>

//         {/* Delivery Actions */}
//         {deliveryStatus !== "delivered" && deliveryStatus !== "returned" && (
//           <Section title="Delivery Status">
//             {deliveryStatus === "pending" && (
//               <PrimaryButton
//                 label="Start Delivering"
//                 onPress={() => handleUploadEvidencePhotos("delivering")}
//                 loading={actionLoading}
//                 icon="play-circle-outline"
//               />
//             )}

//             {deliveryStatus === "delivering" && (
//               <>
//                 <PrimaryButton
//                   label="Mark as Arrived"
//                   onPress={() => setDeliveryStatus("arrived")}
//                   icon="location-outline"
//                   style={styles.secondaryBtn}
//                   textStyle={styles.secondaryBtnText}
//                 />
//                 <PrimaryButton
//                   label="Confirm Delivered"
//                   onPress={() => handleUploadEvidencePhotos("delivered")}
//                   loading={actionLoading}
//                   icon="checkmark-done-outline"
//                 />
//               </>
//             )}

//             {deliveryStatus === "arrived" && (
//               <>
//                 <PrimaryButton
//                   label="Confirm Delivered"
//                   onPress={() => handleUploadEvidencePhotos("delivered")}
//                   loading={actionLoading}
//                   icon="checkmark-done-outline"
//                 />
//                 <PrimaryButton
//                   label="Delivery Failed"
//                   onPress={() => {
//                     Alert.prompt(
//                       "Delivery Failed",
//                       "Please provide the reason for failed delivery:",
//                       [
//                         { text: "Cancel", onPress: () => {} },
//                         {
//                           text: "Confirm",
//                           onPress: (reason?: string) => {
//                             setFailureReason(reason || "");
//                             handleUploadEvidencePhotos("returned");
//                           },
//                         },
//                       ],
//                       "plain-text",
//                     );
//                   }}
//                   loading={actionLoading}
//                   style={styles.dangerBtn}
//                   textStyle={styles.dangerBtnText}
//                   icon="close-circle-outline"
//                 />
//               </>
//             )}
//           </Section>
//         )}

//         {/* Notes */}
//         {order.notes && (
//           <Section title="Notes">
//             <View style={styles.notesBox}>
//               <Text style={styles.noteText}>{order.notes}</Text>
//             </View>
//           </Section>
//         )}

//         <View style={{ height: Spacing.lg }} />
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// function Section({
//   title,
//   children,
// }: {
//   title: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <View style={styles.section}>
//       <Text style={styles.sectionTitle}>{title}</Text>
//       <View style={styles.sectionContent}>{children}</View>
//     </View>
//   );
// }

// function KeyValueRow({ label, value }: { label: string; value: string }) {
//   return (
//     <View style={styles.kvRow}>
//       <Text style={styles.kvLabel}>{label}</Text>
//       <Text style={styles.kvValue} numberOfLines={3}>
//         {value}
//       </Text>
//     </View>
//   );
// }

// function PrimaryButton({
//   label,
//   onPress,
//   loading,
//   icon,
//   style,
//   textStyle,
// }: {
//   label: string;
//   onPress: () => void;
//   loading?: boolean;
//   icon?: string;
//   style?: any;
//   textStyle?: any;
// }) {
//   return (
//     <TouchableOpacity
//       style={[styles.button, style]}
//       onPress={onPress}
//       disabled={loading}
//       activeOpacity={0.8}
//     >
//       {loading ? (
//         <ActivityIndicator size="small" color={Colors.white} />
//       ) : (
//         <>
//           {icon && (
//             <Ionicons name={icon as any} size={18} color={Colors.white} />
//           )}
//           <Text style={[styles.buttonText, textStyle]}>{label}</Text>
//         </>
//       )}
//     </TouchableOpacity>
//   );
// }

// function getDeliveryStatusColor(
//   status: "pending" | "delivering" | "arrived" | "delivered" | "returned",
// ) {
//   switch (status) {
//     case "delivering":
//       return { bg: "#FEE2E2", text: "#B91C1C" };
//     case "arrived":
//       return { bg: "#FEF3C7", text: "#92400E" };
//     case "delivered":
//       return { bg: "#DCFCE7", text: "#166534" };
//     case "returned":
//       return { bg: "#F3F4F6", text: "#6B7280" };
//     default:
//       return { bg: "#DBEAFE", text: "#1D4ED8" };
//   }
// }

// const styles = StyleSheet.create({
//   safe: {
//     flex: 1,
//     backgroundColor: "#EEF3F8",
//   },
//   header: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//     backgroundColor: Colors.primary900,
//     paddingHorizontal: Spacing.base,
//     paddingVertical: Spacing.base,
//   },
//   headerTitle: {
//     color: Colors.white,
//     fontSize: Typography.lg,
//     fontWeight: "700",
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   errorContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//     paddingHorizontal: Spacing.base,
//   },
//   errorText: {
//     color: Colors.gray700,
//     fontSize: Typography.lg,
//     fontWeight: "600",
//   },
//   content: {
//     flex: 1,
//     paddingHorizontal: Spacing.base,
//     paddingVertical: Spacing.base,
//   },
//   card: {
//     backgroundColor: Colors.white,
//     borderRadius: BorderRadius.lg,
//     padding: Spacing.base,
//     marginBottom: Spacing.md,
//     ...Shadow.sm,
//   },
//   cardHeader: {
//     flexDirection: "row",
//     justifyContent: "space-between",
//     alignItems: "center",
//   },
//   cardCode: {
//     color: Colors.gray700,
//     fontSize: Typography.sm,
//     fontWeight: "700",
//   },
//   cardTimestamp: {
//     marginTop: 4,
//     color: Colors.gray500,
//     fontSize: Typography.xs,
//   },
//   statusBadge: {
//     borderRadius: 999,
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//   },
//   statusText: {
//     fontSize: Typography.sm,
//     fontWeight: "700",
//   },
//   section: {
//     marginBottom: Spacing.md,
//   },
//   sectionTitle: {
//     color: Colors.primary900,
//     fontSize: Typography.md,
//     fontWeight: "700",
//     marginBottom: Spacing.sm,
//   },
//   sectionContent: {
//     backgroundColor: Colors.white,
//     borderRadius: BorderRadius.lg,
//     padding: Spacing.base,
//     ...Shadow.sm,
//   },
//   kvRow: {
//     paddingVertical: Spacing.sm,
//     borderBottomWidth: 1,
//     borderBottomColor: "#E5E7EB",
//   },
//   kvLabel: {
//     color: Colors.gray600,
//     fontSize: Typography.sm,
//     fontWeight: "600",
//     marginBottom: 4,
//   },
//   kvValue: {
//     color: Colors.gray900,
//     fontSize: Typography.base,
//     fontWeight: "500",
//     lineHeight: 22,
//   },
//   deviceSectionTitle: {
//     color: Colors.primary700,
//     fontSize: Typography.sm,
//     fontWeight: "700",
//     marginTop: Spacing.base,
//     marginBottom: Spacing.sm,
//   },
//   divider: {
//     height: 1,
//     backgroundColor: "#E5E7EB",
//     marginVertical: Spacing.base,
//   },
//   priceBox: {
//     backgroundColor: "#F0F9FF",
//     borderRadius: BorderRadius.md,
//     padding: Spacing.base,
//     borderLeftWidth: 4,
//     borderLeftColor: Colors.primary700,
//   },
//   priceLabel: {
//     color: Colors.gray600,
//     fontSize: Typography.sm,
//     fontWeight: "600",
//     marginBottom: 4,
//   },
//   priceValue: {
//     color: Colors.primary900,
//     fontSize: Typography.lg,
//     fontWeight: "700",
//   },
//   photosContainer: {
//     marginBottom: Spacing.base,
//   },
//   photosLabel: {
//     color: Colors.gray700,
//     fontSize: Typography.sm,
//     fontWeight: "600",
//     marginBottom: Spacing.sm,
//   },
//   noPhotosText: {
//     color: Colors.gray500,
//     fontSize: Typography.sm,
//     fontStyle: "italic",
//     textAlign: "center",
//     paddingVertical: Spacing.base,
//   },
//   photoGrid: {
//     flexDirection: "row",
//     flexWrap: "wrap",
//     gap: Spacing.sm,
//     marginBottom: Spacing.base,
//   },
//   photoWrapper: {
//     position: "relative",
//     width: "30%",
//   },
//   photoThumb: {
//     width: "100%",
//     aspectRatio: 1,
//     borderRadius: BorderRadius.md,
//     backgroundColor: Colors.gray200,
//   },
//   photoRemoveBtn: {
//     position: "absolute",
//     top: -8,
//     right: -8,
//     backgroundColor: Colors.error,
//     borderRadius: 999,
//     width: 28,
//     height: 28,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   cameraBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: Spacing.md,
//     borderWidth: 2,
//     borderColor: Colors.primary700,
//     borderRadius: BorderRadius.md,
//     borderStyle: "dashed",
//     backgroundColor: "rgba(29, 78, 216, 0.05)",
//   },
//   cameraBtnText: {
//     color: Colors.primary700,
//     fontSize: Typography.md,
//     fontWeight: "600",
//     marginLeft: Spacing.sm,
//   },
//   button: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     paddingVertical: Spacing.md,
//     paddingHorizontal: Spacing.base,
//     backgroundColor: Colors.primary700,
//     borderRadius: BorderRadius.md,
//     marginBottom: Spacing.sm,
//   },
//   buttonText: {
//     color: Colors.white,
//     fontSize: Typography.base,
//     fontWeight: "700",
//     marginLeft: Spacing.sm,
//   },
//   secondaryBtn: {
//     backgroundColor: Colors.gray200,
//   },
//   secondaryBtnText: {
//     color: Colors.gray700,
//   },
//   dangerBtn: {
//     backgroundColor: Colors.error,
//   },
//   dangerBtnText: {
//     color: Colors.white,
//   },
//   notesBox: {
//     backgroundColor: "#FFFBEB",
//     borderRadius: BorderRadius.md,
//     padding: Spacing.base,
//     borderLeftWidth: 4,
//     borderLeftColor: "#F59E0B",
//   },
//   noteText: {
//     color: Colors.gray700,
//     fontSize: Typography.sm,
//     lineHeight: 22,
//   },
//   paymentRow: {
//     marginBottom: Spacing.sm,
//     paddingBottom: Spacing.sm,
//     borderBottomWidth: 1,
//     borderBottomColor: "#E5E7EB",
//   },
// });

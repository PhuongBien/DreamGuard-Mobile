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
import { TaskStackParamList } from "../../types/navigation";
import { BorderRadius, Colors, Spacing, Typography } from "../../constants/theme";

type Props = NativeStackScreenProps<TaskStackParamList, "DeliveryPhotoCapture">;

const FAILED_REASONS = [
  "The guest is not home.",
  "Cannot contact the guest.",
  "The guest refused to receive the item.",
  "Incorrect delivery address.",
  "Other reasons.",
];

export default function DeliveryPhotoCaptureScreen({ route, navigation }: Props) {
  const { taskId, mode } = route.params;
  const { markDelivered, markReturned, addTaskPhoto } = useTask();

  const [imageUris, setImageUris] = useState<string[]>([]);
  const [reason, setReason] = useState<string>(FAILED_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isReturnedMode = mode === "returned";
  const usesCustomReason = isReturnedMode && reason === "Other reasons.";
  const finalReason = usesCustomReason ? customReason.trim() : reason.trim();

  const copy = useMemo(
    () =>
      isReturnedMode
        ? {
            title: "Delivery failed.",
            subtitle: "Select a reason and capture evidence before returning the item.",
            button: "Confirm failed delivery",
          }
        : {
            title: "Delivery successful",
            subtitle: "Capture evidence of successful delivery.",
            button: "Confirm successful delivery",
          },
    [isReturnedMode],
  );

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert("Missing camera permission", "Camera permission is required to capture evidence.");
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
      Alert.alert("Cannot take photo", error?.message || "An error occurred while opening the camera.");
    }
  };

  const handleSubmit = async () => {
    if (!imageUris.length) {
      Alert.alert("Missing evidence", "You need to capture a photo before confirming.");
      return;
    }

    if (isReturnedMode && !finalReason) {
      Alert.alert("Missing reason", "You need to select a reason for the failed delivery.");
      return;
    }

    try {
      setLoading(true);

      const uploadedUrls: string[] = [];

      for (const imageUri of imageUris) {
        const uploadedUrl = await addTaskPhoto(taskId, {
          url: imageUri,
          type: "evidence",
          uploadedBy: "delivery_staff",
          captureStage: isReturnedMode ? "delivery_failed" : "delivery_success",
        });
        uploadedUrls.push(uploadedUrl);
      }

      if (isReturnedMode) {
        await markReturned(taskId, finalReason, uploadedUrls);
      } else {
        await markDelivered(taskId, uploadedUrls);
      }

      Alert.alert(
        "Success",
        isReturnedMode
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

      {isReturnedMode ? (
        <View style={styles.reasonBlock}>
          <Text style={styles.sectionLabel}>Select a reason</Text>

          <View style={styles.reasonWrap}>
            {FAILED_REASONS.map((item) => {
              const active = reason === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.reasonChip, active && styles.reasonChipActive]}
                  activeOpacity={0.85}
                  onPress={() => setReason(item)}
                >
                  <Text style={[styles.reasonText, active && styles.reasonTextActive]}>
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
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Evidence photos</Text>
      <TouchableOpacity
        style={styles.captureBox}
        activeOpacity={0.85}
        onPress={takePhoto}
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
            <Text style={styles.placeholderTitle}>Capture using camera only</Text>
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
        onPress={takePhoto}
      >
        <Ionicons name="refresh-outline" size={16} color={Colors.primary700} />
        <Text style={styles.retakeText}>{imageUris.length ? "Capture more photos" : "Open camera"}</Text>
      </TouchableOpacity>

      {imageUris.length ? (
        <TouchableOpacity
          style={styles.clearButton}
          activeOpacity={0.85}
          disabled={loading}
          onPress={() => setImageUris([])}
        >
          <Ionicons name="trash-outline" size={16} color={Colors.error} />
          <Text style={styles.clearButtonText}>Clear all photos</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={[styles.submitButton, (!imageUris.length || loading) && styles.submitButtonDisabled]}
        activeOpacity={0.85}
        disabled={!imageUris.length || loading}
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

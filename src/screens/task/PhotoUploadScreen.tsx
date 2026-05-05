import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { TaskStackParamList } from "../../types/navigation";
import { useTask } from "../../context/TaskContext";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../../constants/theme";

type Props = NativeStackScreenProps<TaskStackParamList, "PhotoUpload">;

const PHOTO_LABELS: Record<"before" | "after" | "payment", string> = {
  before: "Before Photo",
  after: "After Photo",
  payment: "Payment Confirmation",
};

export const PhotoUploadScreen = ({ route, navigation }: Props) => {
  const { shippingTaskId, photoType, openCameraImmediately } = route.params;
  const { addTaskPhoto, getTaskById } = useTask();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const autoCameraLaunchedRef = useRef(false);

  const takePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        // Alert.alert("Permission denied", "Permission to access the camera is required.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        setImageUri(asset.uri);
        setImageMeta({
          fileName: asset.fileName || undefined,
          mimeType: asset.mimeType || undefined,
        });
      }
    } catch (error: any) {
      Alert.alert(
        "Error taking photo",
        error?.message || "Unable to open camera.",
      );
    }
  }, []);

  useEffect(() => {
    if (!openCameraImmediately || autoCameraLaunchedRef.current) return;
    autoCameraLaunchedRef.current = true;
    void takePhoto();
  }, [openCameraImmediately, takePhoto]);

  const handleChooseImage = () => {
    // Only allow capturing a new photo via camera (no library uploads).
    takePhoto();
  };

  const handleUpload = async () => {
    if (!imageUri) {
      Alert.alert(
        "No Image Selected",
        "Please select or take a photo before uploading.",
      );
      return;
    }

    try {
      setLoading(true);

      await addTaskPhoto(shippingTaskId, {
        url: imageUri,
        type: photoType,
        uploadedBy: "current_user",
        fileName: imageMeta?.fileName,
        mimeType: imageMeta?.mimeType,
      });

      await getTaskById(shippingTaskId, { forceRefresh: true });

      Alert.alert("Success", "Photo has been uploaded.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const message = error?.message || "Unable to upload photo.";
      Alert.alert("Upload Error", message);
    } finally {
      setLoading(false);
    }
  };

  const label = PHOTO_LABELS[photoType] ?? photoType;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{label}</Text>

      <TouchableOpacity
        style={styles.imageBox}
        onPress={handleChooseImage}
        activeOpacity={0.8}
        disabled={loading}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.placeholderWrap}>
            <Ionicons name="camera-outline" size={40} color={Colors.gray400} />
            <Text style={styles.placeholder}>
              Tap to take a photo
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity
          style={styles.rePickButton}
          onPress={handleChooseImage}
          disabled={loading}
        >
          <Ionicons
            name="refresh-outline"
            size={16}
            color={Colors.primary700}
          />
          <Text style={styles.rePickText}>Retake photo</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, (!imageUri || loading) && styles.buttonDisabled]}
        onPress={handleUpload}
        disabled={!imageUri || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.base,
    backgroundColor: Colors.gray50 ?? "#F8FAFB",
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.primary900,
    marginBottom: Spacing.base,
    textAlign: "center",
  },
  imageBox: {
    height: 260,
    borderWidth: 1.5,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    overflow: "hidden",
  },
  placeholderWrap: {
    alignItems: "center",
    gap: 8,
  },
  placeholder: {
    color: Colors.gray400,
    fontSize: Typography.sm,
    marginTop: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  rePickButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    marginBottom: Spacing.base,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rePickText: {
    color: Colors.primary700,
    fontSize: Typography.sm,
    fontWeight: "500",
  },
  button: {
    backgroundColor: Colors.primary700,
    padding: 16,
    borderRadius: BorderRadius.base,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: Colors.gray300,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: Typography.base,
  },
});

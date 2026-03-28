import React, { useState } from "react";
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
import { Colors, Spacing, Typography, BorderRadius } from "../../constants/theme";

type Props = NativeStackScreenProps<TaskStackParamList, "PhotoUpload">;

const PHOTO_LABELS: Record<"before" | "after", string> = {
  before: "Ảnh trước",
  after: "Ảnh sau",
};

export const PhotoUploadScreen = ({ route, navigation }: Props) => {
  const { taskId, photoType } = route.params;
  const { addTaskPhoto, getTaskById } = useTask();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{
    fileName?: string;
    mimeType?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const pickFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
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
      Alert.alert("Lỗi chọn ảnh", error?.message || "Không thể mở thư viện ảnh.");
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập camera.");
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
      Alert.alert("Lỗi chụp ảnh", error?.message || "Không thể mở camera.");
    }
  };

  const handleChooseImage = () => {
    Alert.alert(
      "Chọn ảnh",
      "Bạn muốn chụp ảnh mới hay chọn từ thư viện?",
      [
        { text: "Chụp ảnh", onPress: takePhoto },
        { text: "Thư viện", onPress: pickFromLibrary },
        { text: "Hủy", style: "cancel" },
      ]
    );
  };

  const handleUpload = async () => {
    if (!imageUri) {
      Alert.alert("Chưa chọn ảnh", "Vui lòng chọn hoặc chụp ảnh trước khi tải lên.");
      return;
    }

    try {
      setLoading(true);

      await addTaskPhoto(taskId, {
        url: imageUri,
        type: photoType,
        uploadedBy: "current_user",
        fileName: imageMeta?.fileName,
        mimeType: imageMeta?.mimeType,
      });

      await getTaskById(taskId, { forceRefresh: true });

      Alert.alert("Thành công", "Ảnh đã được tải lên.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      const message = error?.message || "Không thể tải lên ảnh.";
      Alert.alert("Lỗi tải ảnh", message);
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
            <Text style={styles.placeholder}>Nhấn để chọn hoặc chụp ảnh</Text>
          </View>
        )}
      </TouchableOpacity>

      {imageUri && (
        <TouchableOpacity
          style={styles.rePickButton}
          onPress={handleChooseImage}
          disabled={loading}
        >
          <Ionicons name="refresh-outline" size={16} color={Colors.primary700} />
          <Text style={styles.rePickText}>Chọn ảnh khác</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          (!imageUri || loading) && styles.buttonDisabled,
        ]}
        onPress={handleUpload}
        disabled={!imageUri || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Tải lên</Text>
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
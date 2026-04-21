import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { TaskStackParamList } from "../../types/navigation";
import { useTask } from "../../context/TaskContext";
import {
  Colors,
  Spacing,
  Typography,
  BorderRadius,
} from "../../constants/theme";

type Props = NativeStackScreenProps<TaskStackParamList, "AddNote">;

export default function AddNoteScreen({ route, navigation }: Props) {
  const { shippingTaskId } = route.params;
  const { addTaskNote } = useTask();

  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) {
      Alert.alert("Missing note", "Please enter a note before saving.");
      return;
    }

    setLoading(true);

    try {
      await addTaskNote(shippingTaskId, note.trim());

      Alert.alert("Success", "Note added successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to save note.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.primary50 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Add Note</Text>

        <Text style={styles.label}>Task ID</Text>
        <View style={styles.taskBox}>
          <Text style={styles.taskText}>{shippingTaskId}</Text>
        </View>

        <Text style={styles.label}>Note</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Enter task note..."
          placeholderTextColor={Colors.gray400}
          multiline
          numberOfLines={6}
          value={note}
          onChangeText={setNote}
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Save Note</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.primary900,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.gray600,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  taskBox: {
    backgroundColor: Colors.gray200,
    padding: 12,
    borderRadius: BorderRadius.base,
    marginBottom: Spacing.lg,
  },
  taskText: {
    color: Colors.gray800,
    fontSize: Typography.base,
  },
  textArea: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.base,
    borderWidth: 1,
    borderColor: Colors.gray300,
    padding: 14,
    fontSize: Typography.base,
    minHeight: 140,
    marginBottom: Spacing.lg,
  },
  saveBtn: {
    backgroundColor: Colors.primary600,
    paddingVertical: 16,
    borderRadius: BorderRadius.base,
    alignItems: "center",
  },
  saveText: {
    color: "#fff",
    fontSize: Typography.base,
    fontWeight: "700",
  },
});

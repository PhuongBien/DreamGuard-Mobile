import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../types/navigation";
import { Spacing, Colors } from "../../constants/theme";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ route, navigation }: Props) {
  const { phoneNumber } = route.params;
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!otpCode.trim()) {
      Alert.alert("Error", "Please enter the OTP code.");
      return;
    }
    if (!newPassword) {
      Alert.alert("Error", "Please enter a new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Password confirmation does not match.");
      return;
    }

    try {
      setLoading(true);
      const { resetPasswordService } = await import("../../services/auth.service");
      await resetPasswordService(phoneNumber, otpCode.trim(), newPassword);

      Alert.alert("Success", "Password has been reset successfully.", [
        { text: "OK", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || !otpCode.trim() || !newPassword || !confirmPassword;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Image
              source={require("../../../assets/logo2.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Phone: {phoneNumber}</Text>
        </View>

        <Text style={styles.label}>OTP Code</Text>
        <TextInput
          placeholder="6-digit code"
          placeholderTextColor="#8A97A6"
          style={styles.input}
          value={otpCode}
          onChangeText={setOtpCode}
          keyboardType="number-pad"
          maxLength={6}
        />

        <Text style={styles.label}>New Password</Text>
        <TextInput
          placeholder="••••••••"
          placeholderTextColor="#8A97A6"
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          placeholder="••••••••"
          placeholderTextColor="#8A97A6"
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, isDisabled && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={isDisabled}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("Login")}
          disabled={loading}
        >
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E6EDF3" },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: "center",
    paddingTop: 90,
    paddingBottom: Spacing["2xl"],
  },
  logoWrap: {
    width: 80,
    height: 80,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  logoImage: { width: "100%", height: "100%" },
  title: { fontSize: 22, fontWeight: "600", color: "#1F3B63", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#5F6C7B", marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", color: "#5F6C7B", marginBottom: 6 },
  input: {
    backgroundColor: "#F4F7FA",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: "#2E5B9A",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  backText: { textAlign: "center", color: "#2E5B9A", fontSize: 14, fontWeight: "500" },
});
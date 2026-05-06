// KBS Staff App — Login Screen

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Image,
  Pressable,
} from "react-native";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../../constants/theme";
import { KBSButton } from "../../components/shared";
import { useAuth } from "../../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import AntDesign from "@expo/vector-icons/AntDesign";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../../types/navigation";
// import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const getLoginErrorMessage = (error: unknown): string => {
  const fallback = "Incorrect password or phone number, please log in again.";

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const normalized = rawMessage.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  const hasPasswordHint = /password|mat\s*khau|mật\s*khẩu/.test(normalized);
  const hasPhoneHint =
    /phone|phone\s*number|so\s*dien\s*thoai|số\s*điện\s*thoại/.test(
      normalized,
    ) ||
    normalized.includes("user not found") ||
    normalized.includes("account not found") ||
    normalized.includes("phone not found");

  if (hasPasswordHint && !hasPhoneHint) {
    return "Incorrect password";
  }

  if (hasPhoneHint && !hasPasswordHint) {
    return "Incorrect phone number";
  }

  return fallback;
};

export default function LoginScreen({ navigation }: Props) {
  const { login, isLoading, error } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (error) {
      setErrorMsg(getLoginErrorMessage(error));
    }
  }, [error]);

  const handleLogin = async () => {
    setErrorMsg("");

    if (!phoneNumber.trim()) {
      setErrorMsg("Please enter your phone number.");
      return;
    }

    const cleanedPhone = phoneNumber.replace(/\D/g, "");
    if (cleanedPhone.length < 9) {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }

    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    try {
      await login(cleanedPhone, password);
    } catch (err: unknown) {
      setErrorMsg(getLoginErrorMessage(err));
    }
  };

  const [checked, setChecked] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary900} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={styles.logoWrap}>
              {/* <Text style={styles.logoEmoji}>🛏️</Text> */}
              <Image
                source={require("../../../assets/logo2.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brand}>KBS Staff</Text>
          </View>

          {/* ── Form Card ── */}
          <View style={styles.card}>
            {/* Background mờ */}
            <View style={styles.cardBg} />

            {/* Nội dung rõ */}
            <View style={styles.cardContent}>
              {/* <Text style={styles.cardTitle}>Log in</Text> */}

              {/* Phone */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Phone Number</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errorMsg && phoneNumber === "" && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    underlineColorAndroid="transparent"
                    placeholder="e.g. 0387412289"
                    placeholderTextColor={Colors.gray400}
                    value={phoneNumber}
                    onChangeText={(v) => {
                      setPhoneNumber(v);
                      setErrorMsg("");
                    }}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    underlineColorAndroid="transparent"
                    placeholder="••••••••"
                    placeholderTextColor={Colors.gray400}
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      setErrorMsg("");
                    }}
                    // Removed secureTextEntry to prevent screen share black screen
                  />
                </View>
              </View>

              {/* Error */}
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Remember + Forgot */}
              {/* <View style={styles.row}>
                <Pressable
                  style={styles.checkboxWrap}
                  onPress={() => setChecked(!checked)}
                >
                  <View
                    style={[styles.checkbox, checked && styles.checkboxChecked]}
                  >
                    {checked && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>

                  <Text style={styles.remember}>Remember me</Text>
                </Pressable>

                <TouchableOpacity
                  onPress={() => navigation.navigate("ForgotPassword")}
                >
                  <Text style={{ color: "#2E5B9A" }}>Forgot password?</Text>
                </TouchableOpacity>
              </View> */}

              {/* Login Button */}
              <KBSButton
                title="Log in"
                onPress={handleLogin}
                loading={isLoading}
                size="lg"
                style={styles.loginBtn}
              />
            </View>

            <View>
              <Text style={styles.subtitle}>
                Staff Management System for Children's Bedding
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary50 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing["2xl"],
  },

  // Header
  header: {
    alignItems: "center",
    paddingTop: 90,
    paddingBottom: Spacing["2xl"],
  },
  logoWrap: {
    width: 80,
    height: 80,
    // borderRadius: 24,
    // backgroundColor: Colors.white,
    marginBottom: Spacing.md,
    overflow: "hidden",
    // ...Shadow.base,
  },
  logoImage: {
    width: "100%",
    height: "100%",
    // borderRadius: 24,
  },
  brand: {
    fontSize: Typography["3xl"],
    fontWeight: "800",
    color: Colors.primary900,
    letterSpacing: 1,
  },

  // Card
  // card: {
  //   backgroundColor: Colors.primary50,
  //   borderRadius: BorderRadius.xl,
  //   padding: Spacing.xl,
  //   // ...Shadow.lg,
  // },

  card: {
    position: "relative",
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },

  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.white,
    opacity: 0,
  },

  cardContent: {
    padding: Spacing.xl,
  },

  cardTitle: {
    fontSize: Typography.xl,
    fontWeight: "700",
    color: Colors.primary900,
    marginBottom: Spacing.lg,
  },

  // Fields
  fieldWrap: { marginBottom: Spacing.base },
  label: {
    fontSize: Typography.sm,
    fontWeight: "600",
    color: Colors.gray600,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.base,
    paddingHorizontal: 12,
    height: 52,
    backgroundColor: Colors.gray100,
    borderColor: Colors.gray300,
  },

  inputWrapFocus: {
    borderColor: Colors.primary500,
  },
  inputError: { borderColor: Colors.error },
  inputIcon: { fontSize: 18, marginRight: 8 },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.gray800,
    borderWidth: 0,
    paddingVertical: 0,
    borderColor: "transparent",
  },
  eyeBtn: { padding: 4 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },

  checkboxWrap: {
    flexDirection: "row",
    alignItems: "center",
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#999",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "transparent",
  },

  checkboxChecked: {
    backgroundColor: "#4F46E5", // màu primary
    borderColor: "#4F46E5",
  },

  remember: {
    fontSize: 14,
    color: "#555",
  },

  // checkbox: {
  //   width: 16,
  //   height: 16,
  //   borderRadius: 4,
  //   borderWidth: 1,
  //   borderColor: "#CBD5E1",
  //   marginRight: 8,
  // },

  // remember: {
  //   fontSize: 13,
  //   color: "#475569",
  // },

  forgot: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "500",
  },

  // Error
  errorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: BorderRadius.sm,
    padding: 10,
    marginBottom: Spacing.base,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.sm,
    fontWeight: "500",
  },

  // Login button
  loginBtn: { marginTop: Spacing.sm },

  footersubtitle: {
    marginTop: Spacing["2xl"],
    alignItems: "center",
  },

  subtitle: {
    fontSize: Typography.base,
    color: Colors.primary800,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 22,
  },

  // Demo section
  // demoSection: { marginTop: Spacing.xl },
  // demoHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  // demoDivider: { flex: 1, height: 1, backgroundColor: Colors.primary700 },
  // demoHeaderText: {
  //   color: Colors.primary100, fontSize: Typography.xs,
  //   fontWeight: '700', letterSpacing: 1.5, marginHorizontal: 12,
  // },
  // demoHint: {
  //   color: Colors.primary100, fontSize: Typography.xs,
  //   textAlign: 'center', marginBottom: 12,
  // },
  // demoCard: {
  //   backgroundColor: Colors.primary800,
  //   borderRadius: BorderRadius.base, padding: 12,
  //   flexDirection: 'row', alignItems: 'center',
  //   marginBottom: 8, gap: 10,
  //   borderWidth: 1, borderColor: Colors.primary700,
  // },
  // demoAvatar: {
  //   width: 40, height: 40, borderRadius: 20,
  //   backgroundColor: Colors.primary700,
  //   alignItems: 'center', justifyContent: 'center',
  // },
  // demoName: { color: Colors.white, fontSize: Typography.sm, fontWeight: '600' },
  // demoRole: { color: Colors.primary100, fontSize: Typography.xs, marginTop: 2 },
  // demoEmail: { color: Colors.primary100, fontSize: Typography.xs },

  // Footer
  // footer: {
  //   color: Colors.primary100, textAlign: 'center',
  //   fontSize: Typography.xs, marginTop: Spacing.xl, opacity: 0.6,
  // },
});

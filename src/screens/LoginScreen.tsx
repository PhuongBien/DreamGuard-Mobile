// ============================================================
// KBS Staff App — Login Screen
// ============================================================

import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  Image,
} from "react-native";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { KBSButton } from "../components/shared";
import { useAuth } from "../context/AuthContext";
import { SafeAreaView } from "react-native-safe-area-context";
import AntDesign from "@expo/vector-icons/AntDesign";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";

// import { useAuth } from '../hooks/useAuth';

// Demo accounts shown on login screen for easy testing
const DEMO_ACCOUNTS = [
  {
    name: "Nguyễn Văn An",
    role: "Nhân viên giao hàng",
    email: "an.nguyen@kbs.vn",
    password: "demo123",
  },
  {
    name: "Trần Thị Bích",
    role: "Nhân viên vệ sinh",
    email: "bich.tran@kbs.vn",
    password: "demo123",
  },
  {
    name: "Lê Hoàng Minh",
    role: "Quản lý",
    email: "minh.le@kbs.vn",
    password: "demo123",
  },
  {
    name: "Phạm Thị Lan",
    role: "Nhân viên kho",
    email: "lan.pham@kbs.vn",
    password: "demo123",
  },
];

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async () => {
    setErrorMsg("");

    if (!email.trim()) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!password) {
      setErrorMsg("Please enter your password.");
      return;
    }

    await login(email, password);
  };

  const fillDemo = (acc: (typeof DEMO_ACCOUNTS)[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setErrorMsg("");
  };

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
                source={require("../../assets/logo2.png")}
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

              {/* Email */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Company email</Text>
                <View
                  style={[
                    styles.inputWrap,
                    errorMsg && email === "" && styles.inputError,
                  ]}
                >
                  <TextInput
                    style={styles.input}
                    underlineColorAndroid="transparent"
                    placeholder="your.name@kbs.vn"
                    placeholderTextColor={Colors.gray400}
                    value={email}
                    onChangeText={(v) => {
                      setEmail(v);
                      setErrorMsg("");
                    }}
                    keyboardType="email-address"
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
                    secureTextEntry={!showPass}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPass((s) => !s)}
                    style={styles.eyeBtn}
                  >
                    {showPass ? (
                      <AntDesign name="eye" size={22} color="gray" />
                    ) : (
                      <AntDesign name="eye-invisible" size={22} color="gray" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Error */}
              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              {/* Remember + Forgot */}
              <View style={styles.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.checkbox} />
                  <Text style={styles.remember}>Remember me</Text>
                </View>

                <TouchableOpacity>
                  <Text style={styles.forgot}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },

  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },

  remember: {
    fontSize: 13,
    color: '#475569',
  },

  forgot: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
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

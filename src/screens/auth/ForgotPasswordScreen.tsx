// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   TextInput,
//   StyleSheet,
//   TouchableOpacity,
//   Alert,
//   ActivityIndicator,
//   KeyboardAvoidingView,
//   Platform,
//   Image,
// } from "react-native";

// import { SafeAreaView } from "react-native-safe-area-context";
// import { NativeStackScreenProps } from "@react-navigation/native-stack";
// import { AuthStackParamList } from "../../types/navigation";
// import { Spacing } from "../../constants/theme";

// type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

// export default function ForgotPasswordScreen({ navigation }: Props) {
//   const [phoneNumber, setPhoneNumber] = useState("");
//   const [loading, setLoading] = useState(false);

//   const validatePhone = (value: string) => {
//     const cleaned = value.replace(/\D/g, "");
//     return cleaned.length >= 9;
//   };

//   const handleReset = async () => {
//     const trimmedPhone = phoneNumber.trim();

//     if (!trimmedPhone) {
//       Alert.alert("Error", "Please enter your phone number");
//       return;
//     }

//     if (!validatePhone(trimmedPhone)) {
//       Alert.alert("Invalid Phone", "Please enter a valid phone number.");
//       return;
//     }

//     try {
//       setLoading(true);
//       const { forgotPasswordService } = await import("../../services/auth.service");
//       await forgotPasswordService(trimmedPhone.replace(/\D/g, ""));

//       Alert.alert("OTP Sent", "OTP đã được gửi tới email đăng ký.", [
//         {
//           text: "OK",
//           onPress: () =>
//             navigation.navigate("ResetPassword", { phoneNumber: trimmedPhone }),
//         },
//       ]);
//     } catch (error: any) {
//       Alert.alert("Error", error?.message || "Something went wrong. Please try again.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const isDisabled = !phoneNumber.trim() || loading;

//   return (
//     <SafeAreaView style={styles.safe}>
//       <KeyboardAvoidingView
//         style={styles.container}
//         behavior={Platform.OS === "ios" ? "padding" : undefined}
//       >
//         {/* Logo */}
//         <View style={styles.header}>
//         <View style={styles.logoWrap}>
//           {/* <Text style={styles.logoEmoji}>🛏️</Text> */}
//           <Image
//             source={require("../../../assets/logo2.png")}
//             style={styles.logoImage}
//             resizeMode="contain"
//           />
//         </View>

//         <Text style={styles.title}>Forgot Password</Text>
//         </View>

//         <Text style={styles.description}>
//           Enter your registered phone number to receive OTP and reset password
//         </Text>

//         {/* Phone Input */}
//         <Text style={styles.label}>PHONE NUMBER</Text>
//         <TextInput
//           placeholder="0387412289"
//           placeholderTextColor="#8A97A6"
//           style={styles.input}
//           value={phoneNumber}
//           onChangeText={setPhoneNumber}
//           keyboardType="phone-pad"
//           autoCapitalize="none"
//           autoCorrect={false}
//           returnKeyType="done"
//         />

//         {/* Send Button */}
//         <TouchableOpacity
//           style={[styles.button, isDisabled && styles.buttonDisabled]}
//           onPress={handleReset}
//           disabled={isDisabled}
//         >
//           {loading ? (
//             <ActivityIndicator color="#FFFFFF" />
//           ) : (
//             <Text style={styles.buttonText}>Send Reset Link</Text>
//           )}
//         </TouchableOpacity>

//         {/* Back to Login */}
//         <TouchableOpacity
//           onPress={() => navigation.goBack()}
//           disabled={loading}
//         >
//           <Text style={styles.backText}>Back to Log in</Text>
//         </TouchableOpacity>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   safe: {
//     flex: 1,
//     backgroundColor: "#E6EDF3",
//   },

//   container: {
//     flex: 1,
//     paddingHorizontal: 24,
//     // justifyContent: "center",
//   },

//   // logo: {
//   //   fontSize: 42,
//   //   fontWeight: "700",
//   //   textAlign: "center",
//   //   color: "#1F3B63",
//   //   marginBottom: 16,
//   // },

//   header: {
//     alignItems: "center",
//     paddingTop: 90,
//     paddingBottom: Spacing["2xl"],
//   },

//   logoWrap: {
//     width: 80,
//     height: 80,
//     // borderRadius: 24,
//     // backgroundColor: Colors.white,
//     marginBottom: Spacing.md,
//     overflow: "hidden",
//     // ...Shadow.base,
//   },

//   logoImage: {
//     width: "100%",
//     height: "100%",
//     // borderRadius: 24,
//   },

//   title: {
//     fontSize: 22,
//     fontWeight: "600",
//     textAlign: "center",
//     color: "#1F3B63",
//     marginBottom: 8,
//   },

//   description: {
//     fontSize: 14,
//     textAlign: "center",
//     color: "#5F6C7B",
//     marginBottom: 32,
//   },

//   label: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#5F6C7B",
//     marginBottom: 6,
//   },

//   input: {
//     backgroundColor: "#F4F7FA",
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     paddingVertical: 14,
//     marginBottom: 24,
//     fontSize: 14,
//   },

//   button: {
//     backgroundColor: "#2E5B9A",
//     paddingVertical: 16,
//     borderRadius: 14,
//     alignItems: "center",
//     marginBottom: 20,
//   },

//   buttonDisabled: {
//     opacity: 0.6,
//   },

//   buttonText: {
//     color: "#FFFFFF",
//     fontSize: 16,
//     fontWeight: "600",
//   },

//   backText: {
//     textAlign: "center",
//     color: "#2E5B9A",
//     fontSize: 14,
//     fontWeight: "500",
//   },
// });

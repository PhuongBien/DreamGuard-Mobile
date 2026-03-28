// // KBS Staff App — Navigation Options

// import React from "react";
// import { View, StyleSheet, Platform } from "react-native";
// import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
// import { Colors, Typography } from "../constants/theme";

// // Default Stack Options

// export const defaultStackOptions: NativeStackNavigationOptions = {
//   headerTitleAlign: "center",
//   headerTintColor: Colors.white,
//   headerBackTitleVisible: false,
//   headerShadowVisible: false,

//   headerTitleStyle: {
//     fontSize: Typography.lg,
//     fontWeight: "700",
//   },

//   headerBackground: () => <HeaderBackground />,
// };

// // Header Background Component

// function HeaderBackground() {
//   return <View style={styles.headerBackground} />;
// }

// // Styles

// const styles = StyleSheet.create({
//   headerBackground: {
//     flex: 1,
//     backgroundColor: Colors.primary500,
//     // borderBottomLeftRadius: 16,
//     // borderBottomRightRadius: 16,

//     // Android shadow
//     elevation: 8,

//     // iOS shadow
//     ...Platform.select({
//       ios: {
//         shadowColor: "#000",
//         shadowOffset: { width: 0, height: 4 },
//         shadowOpacity: 0.25,
//         shadowRadius: 6,
//       },
//     }),
//   },
// });
import React from 'react';
import { View } from 'react-native';
import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Colors, Typography } from '../constants/theme';

export const defaultStackOptions: NativeStackNavigationOptions = {
  headerTitleAlign: 'center',
  headerTintColor: Colors.white,
  headerShadowVisible: false,

  headerTitleStyle: {
    fontSize: Typography.lg,
    fontWeight: '700',
  },

  headerBackTitleVisible: false,

  headerBackground: () => (
    <View
      style={{
        flex: 1,
        backgroundColor: Colors.primary900,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
        elevation: 8, // Android shadow only
      }}
    />
  ),
};
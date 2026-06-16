import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useThemeColors } from '../theme';

interface LoadingScreenProps {
  size?: 'small' | 'large';
}

export function LoadingScreen({ size = 'large' }: LoadingScreenProps) {
  const colors = useThemeColors();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size={size} color={colors.primary} />
    </View>
  );
}

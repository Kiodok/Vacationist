import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { ThemedIcon } from './ThemedIcon';
import type { IoniconsName } from './ThemedIcon';
import { useThemeColors } from '../theme';
import { useResolvedTheme } from '../themeContext';

interface FloatingActionButtonProps {
  onPress: () => void;
  icon?: IoniconsName;
  testID?: string;
}

export function FloatingActionButton({
  onPress,
  icon = 'add',
  testID,
}: FloatingActionButtonProps) {
  const colors = useThemeColors();
  const theme = useResolvedTheme();
  const fabColor = theme === 'colorful' ? colors.textPrimary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: fabColor, shadowColor: fabColor },
        pressed && styles.fabPressed,
      ]}
    >
      <ThemedIcon name={icon} size={28} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabPressed: {
    opacity: 0.85,
  },
});

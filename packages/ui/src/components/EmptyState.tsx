import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ThemedIcon } from './ThemedIcon';
import type { IoniconsName } from './ThemedIcon';
import { useThemeColors } from '../theme';

interface EmptyStateProps {
  icon: IoniconsName;
  title: string;
  subtitle: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View style={styles.container}>
      <ThemedIcon name={icon} size={48} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      {action && (
        <Pressable style={[styles.button, { backgroundColor: colors.primary }]} onPress={action.onPress}>
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

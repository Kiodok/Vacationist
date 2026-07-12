import { Pressable, Text, ActivityIndicator } from 'react-native';
import { useResolvedTheme } from '../themeContext';
import { useThemeColors } from '../theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string; spinner: string }> = {
  primary: {
    container: 'bg-primary',
    text: 'font-semibold',
    spinner: '#FFFFFF',
  },
  secondary: {
    container: 'bg-transparent border border-primary',
    text: 'text-primary font-semibold',
    spinner: '#6C63FF',
  },
  ghost: {
    container: 'bg-transparent',
    text: 'text-primary',
    spinner: '#6C63FF',
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  className = '',
}: ButtonProps) {
  const theme = useResolvedTheme();
  const colors = useThemeColors();
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  // In colorful mode, bg-primary is #8c6196 — white text has poor contrast.
  // Use colors.surface (#FECE8A) for text and spinner on primary buttons.
  const isPrimaryColorful = variant === 'primary' && theme === 'colorful';
  const spinnerColor = isPrimaryColorful ? colors.surface : styles.spinner;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`min-h-[48px] rounded-md px-lg items-center justify-center flex-row gap-sm ${styles.container} ${isDisabled ? 'opacity-50' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <>
          {icon}
          <Text
            className={`text-body ${styles.text}`}
            style={isPrimaryColorful ? { color: colors.surface } : variant === 'primary' ? { color: '#FFFFFF' } : undefined}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

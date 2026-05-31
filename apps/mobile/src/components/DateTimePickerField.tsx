import { useState, useRef } from 'react';
import { View, Text, Pressable, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { i18n } from '@vacationist/i18n';
import { colors } from '@vacationist/ui';

type RNDateTimePickerType =
  typeof import('@react-native-community/datetimepicker').default;

let RNDateTimePicker: RNDateTimePickerType | null = null;
if (Platform.OS !== 'web') {
  RNDateTimePicker = require('@react-native-community/datetimepicker').default;
}

interface DateTimePickerFieldProps {
  label?: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  error?: string;
  mode: 'date' | 'time';
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
};

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const locale = LOCALE_MAP[i18n.language] ?? 'en-US';
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTimeString(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function parseToDate(value: string | null | undefined, mode: 'date' | 'time'): Date {
  if (!value) return new Date();
  if (mode === 'date') {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getDisplayText(
  value: string | null | undefined,
  mode: 'date' | 'time',
  placeholder: string,
): string {
  if (!value) return placeholder;
  return mode === 'date' ? formatDateDisplay(value) : value;
}

export function DateTimePickerField({
  label,
  value,
  onChange,
  error,
  mode,
  placeholder,
  minimumDate,
  maximumDate,
}: DateTimePickerFieldProps) {
  const [show, setShow] = useState(false);
  const webInputRef = useRef<HTMLInputElement>(null);
  const defaultPlaceholder = mode === 'date' ? 'Select date' : 'Select time';
  const displayPlaceholder = placeholder ?? defaultPlaceholder;

  if (Platform.OS === 'web') {
    const minStr = minimumDate ? toDateString(minimumDate) : undefined;
    const maxStr = maximumDate ? toDateString(maximumDate) : undefined;

    return (
      <View className="gap-xs">
        {label && (
          <Text className="text-label text-text-muted uppercase">{label}</Text>
        )}
        <div style={{
          backgroundColor: '#1A1A1A',
          border: '1px solid #2E2E2E',
          borderRadius: 4,
          minHeight: 48,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          gap: 8,
        }}>
          <input
            ref={webInputRef as React.RefObject<HTMLInputElement>}
            type={mode}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            min={mode === 'date' ? minStr : undefined}
            max={mode === 'date' ? maxStr : undefined}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: value ? '#F2F2F2' : colors.textMuted,
              fontSize: 16,
              fontFamily: 'inherit',
              height: 48,
              width: '100%',
              colorScheme: 'dark',
              cursor: 'pointer',
            }}
          />
          {mode === 'time' && (
            <button
              type="button"
              onClick={() => {
                const input = webInputRef.current;
                if (input) {
                  input.focus();
                  try { input.showPicker(); } catch {}
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
            </button>
          )}
        </div>
        {error && (
          <Text className="text-danger text-body-small">{error}</Text>
        )}
      </View>
    );
  }

  const dateValue = parseToDate(value, mode);
  const displayText = getDisplayText(value, mode, displayPlaceholder);

  return (
    <View className="gap-xs">
      {label && (
        <Text className="text-label text-text-muted uppercase">{label}</Text>
      )}
      <Pressable
        onPress={() => setShow(true)}
        className="bg-surface border border-border rounded-sm px-md min-h-[48px] flex-row items-center justify-between"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Text
          className={`text-body flex-1 ${value ? 'text-text-primary' : 'text-text-muted'}`}
        >
          {displayText}
        </Text>
        <Ionicons
          name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {error && (
        <Text className="text-danger text-body-small">{error}</Text>
      )}

      {show && Platform.OS === 'android' && RNDateTimePicker && (
        <RNDateTimePicker
          value={dateValue}
          mode={mode}
          is24Hour
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(event, date) => {
            setShow(false);
            if (event.type === 'set' && date) {
              onChange(mode === 'date' ? toDateString(date) : toTimeString(date));
            }
          }}
        />
      )}

      {show && Platform.OS === 'ios' && RNDateTimePicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable
            className="flex-1 justify-end bg-background/80"
            onPress={() => setShow(false)}
          >
            <View
              className="bg-surface-elevated rounded-t-lg px-md pt-sm pb-xl"
              onStartShouldSetResponder={() => true}
            >
              <View className="flex-row justify-between items-center mb-sm">
                <Pressable onPress={() => setShow(false)}>
                  <Text className="text-text-secondary text-body">Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShow(false);
                    onChange(
                      mode === 'date'
                        ? toDateString(dateValue)
                        : toTimeString(dateValue),
                    );
                  }}
                >
                  <Text className="text-primary text-body font-semibold">Done</Text>
                </Pressable>
              </View>
              <RNDateTimePicker
                value={dateValue}
                mode={mode}
                display="spinner"
                is24Hour
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                themeVariant="dark"
                onChange={(_event, date) => {
                  if (date) {
                    onChange(
                      mode === 'date'
                        ? toDateString(date)
                        : toTimeString(date),
                    );
                  }
                }}
              />
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { View, Text, Pressable, Platform, Modal } from 'react-native';
import { i18n } from '@vacationist/i18n';
import { colors, ThemedIcon, useThemeColors, useResolvedTheme } from '@vacationist/ui';

type RNDateTimePickerType =
  typeof import('@react-native-community/datetimepicker').default;

let RNDateTimePicker: RNDateTimePickerType | null = null;
if (Platform.OS !== 'web') {
  RNDateTimePicker = require('@react-native-community/datetimepicker').default;
}

interface WebTimeInputProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  style: CSSProperties;
}

/**
 * Web-only native `<input type="time">`, deliberately UNcontrolled.
 *
 * A time input is segmented: while the user is mid-edit (a segment blank) the browser reports
 * `value === ''` and `validity.badInput === true`. A controlled input would either propagate that `''`
 * as "cleared" — the transfer sheets then wipe the whole date+time field, date included — or, if the
 * parent ignores it, have React write the stale prop back over the half-typed digits. So the DOM keeps
 * its own partial state, and the parent only ever hears about a COMPLETE time, or a genuine clear
 * (empty AND not badInput, e.g. Firefox's clear button).
 *
 * The DOM is re-synced to `value` only when it isn't being edited (external changes), and on blur, which
 * discards an abandoned partial edit rather than leaving `--:--` on screen over a stored time.
 */
function WebTimeInput({ value, onChange, style }: WebTimeInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = value ?? '';

  useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement !== el && el.value !== shown) el.value = shown;
  }, [shown]);

  return (
    <input
      ref={inputRef}
      type="time"
      defaultValue={shown}
      style={style}
      onChange={(e) => {
        const el = e.currentTarget;
        if (el.value) onChange(el.value);
        else if (!el.validity.badInput) onChange(null);
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        if (el.value !== shown) el.value = shown;
      }}
    />
  );
}

interface DateTimePickerFieldProps {
  label?: string;
  /** Appends a red asterisk to the label instead of relying on "(optional)" suffix text — mark only genuinely required fields. */
  required?: boolean;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  error?: string;
  mode: 'date' | 'time';
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  // Opt-in: many call sites (trip create/edit) treat this field as required and
  // must not offer a clear affordance.
  clearable?: boolean;
}

const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
};

function formatDateDisplay(dateStr: string): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return dateStr;
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

function toMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
  required = false,
  value,
  onChange,
  error,
  mode,
  placeholder,
  minimumDate,
  maximumDate,
  clearable = false,
}: DateTimePickerFieldProps) {
  const [show, setShow] = useState(false);
  // iOS tray only: the value being spun. Committed to the form on Done, discarded on Cancel/backdrop.
  const [draft, setDraft] = useState<Date>(() => new Date());
  const defaultPlaceholder = mode === 'date' ? i18n.t('common:placeholder.selectDate') : i18n.t('common:placeholder.selectTime');
  const displayPlaceholder = placeholder ?? defaultPlaceholder;
  const themeColors = useThemeColors();
  const theme = useResolvedTheme();

  if (Platform.OS === 'web') {
    const minStr = minimumDate ? toDateString(minimumDate) : undefined;
    const maxStr = maximumDate ? toDateString(maximumDate) : undefined;
    const webInputStyle: CSSProperties = {
      flex: 1,
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      color: value ? themeColors.textPrimary : themeColors.textMuted,
      fontSize: 16,
      fontFamily: 'inherit',
      height: 48,
      width: '100%',
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      cursor: 'pointer',
    };

    return (
      <View className="gap-xs">
        {label && (
          <Text className="text-label text-text-muted uppercase">
            {label}{required && <Text className="text-danger"> *</Text>}
          </Text>
        )}
        <div style={{
          backgroundColor: themeColors.surface,
          border: `1px solid ${themeColors.border}`,
          borderRadius: 4,
          minHeight: 48,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 16,
          gap: 8,
        }}>
          {/* Both modes render a real, fully visible native <input>. v1.33.0 hid the time one
              (opacity: 0) behind a div mirroring `value`, to suppress the browser's clock glyph — which
              also hid the caret, the highlighted segment and every typed digit, so keyboard entry looked
              dead until the last keystroke. The browser's own picker indicator is the single icon now.
              Do not make this transparent again (see native-form-control-icon-suppression). */}
          {mode === 'time' ? (
            <WebTimeInput value={value} onChange={onChange} style={webInputStyle} />
          ) : (
            <input
              type={mode}
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value || null)}
              min={minStr}
              max={maxStr}
              style={webInputStyle}
            />
          )}
          {clearable && value && (
            <button
              type="button"
              aria-label={i18n.t('common:button.clear')}
              onClick={() => onChange(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <ThemedIcon name="close-circle" size={20} color={colors.textMuted} />
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

  // Normalize min/max to midnight to avoid time-component comparison issues
  // with Android's native DatePickerDialog, then clamp the picker's initial
  // value so Android opens at a date guaranteed to be within the allowed range.
  const normalizedMin = minimumDate && mode === 'date' ? toMidnight(minimumDate) : minimumDate;
  const normalizedMax = maximumDate && mode === 'date' ? toMidnight(maximumDate) : maximumDate;
  let pickerValue = dateValue;
  if (mode === 'date') {
    if (normalizedMin && pickerValue < normalizedMin) pickerValue = normalizedMin;
    if (normalizedMax && pickerValue > normalizedMax) pickerValue = normalizedMax;
  }

  const openPicker = () => {
    setDraft(pickerValue);
    setShow(true);
  };

  const commitDraft = () => {
    let selected = draft;
    if (mode === 'date') {
      if (normalizedMin && selected < normalizedMin) selected = normalizedMin;
      if (normalizedMax && selected > normalizedMax) selected = normalizedMax;
    }
    setShow(false);
    onChange(mode === 'date' ? toDateString(selected) : toTimeString(selected));
  };

  return (
    <View className="gap-xs">
      {label && (
        <Text className="text-label text-text-muted uppercase">{label}</Text>
      )}
      <View className="bg-surface border border-border rounded-sm px-md min-h-[48px] flex-row items-center gap-sm">
        <Pressable
          onPress={openPicker}
          className="flex-1 flex-row items-center justify-between py-md"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            className={`text-body flex-1 ${value ? 'text-text-primary' : 'text-text-muted'}`}
          >
            {displayText}
          </Text>
          <ThemedIcon
            name={mode === 'date' ? 'calendar-outline' : 'time-outline'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
        {clearable && value && (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            accessibilityLabel={i18n.t('common:button.clear')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <ThemedIcon name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {error && (
        <Text className="text-danger text-body-small">{error}</Text>
      )}

      {show && Platform.OS === 'android' && RNDateTimePicker && (
        <RNDateTimePicker
          value={pickerValue}
          mode={mode}
          is24Hour
          minimumDate={normalizedMin}
          maximumDate={normalizedMax}
          onChange={(event, date) => {
            setShow(false);
            if (event.type === 'set' && date) {
              let selected = date;
              if (mode === 'date') {
                if (normalizedMin && selected < normalizedMin) selected = normalizedMin;
                if (normalizedMax && selected > normalizedMax) selected = normalizedMax;
              }
              onChange(mode === 'date' ? toDateString(selected) : toTimeString(selected));
            }
          }}
        />
      )}

      {show && Platform.OS === 'ios' && RNDateTimePicker && (
        // No GestureHandlerRootView here on purpose (unlike SwipeToDismiss's Modals): this tray uses no
        // RNGH gesture — the native spinner must receive touches untouched.
        <Modal transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <View className="flex-1 justify-end">
            {/* The backdrop is a SIBLING of the panel, never its ancestor (same shape as
                SwipeToDismiss). Previously the panel sat inside the backdrop Pressable and set
                `onStartShouldSetResponder={() => true}` to stop taps falling through — which made
                JS claim every touch that began over the native UIDatePicker, so the spinner never
                received the pan and the tray opened but couldn't be operated. */}
            <Pressable
              className="absolute inset-0"
              onPress={() => setShow(false)}
              accessibilityLabel={i18n.t('common:button.cancel')}
            >
              <View className="flex-1 bg-background/80" />
            </Pressable>
            <View className="bg-surface-elevated rounded-t-lg px-md pt-sm pb-xl">
              <View className="flex-row justify-between items-center mb-sm">
                <Pressable onPress={() => setShow(false)}>
                  <Text className="text-text-secondary text-body">{i18n.t('common:button.cancel')}</Text>
                </Pressable>
                <Pressable onPress={commitDraft}>
                  <Text className="text-primary text-body font-semibold">{i18n.t('common:button.done')}</Text>
                </Pressable>
              </View>
              <RNDateTimePicker
                value={draft}
                mode={mode}
                display="spinner"
                is24Hour
                minimumDate={normalizedMin}
                maximumDate={normalizedMax}
                // Was hardcoded "dark" — unreadable in light/colorful, whose elevated surface is light.
                themeVariant={theme === 'dark' ? 'dark' : 'light'}
                onChange={(_event, date) => {
                  if (date) setDraft(date);
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

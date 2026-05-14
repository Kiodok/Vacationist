import { useMemo } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createActivitySchemaForTrip, type CreateActivityInput, ACTIVITY_CATEGORIES } from '@vacationist/types';
import { DateTimePickerField } from '../../../components/DateTimePickerField';

interface CreateActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateActivityInput) => void;
  isPending: boolean;
  tripStartDate: string;
  tripEndDate: string;
}

export function CreateActivitySheet({ visible, onClose, onSubmit, isPending, tripStartDate, tripEndDate }: CreateActivitySheetProps) {
  const schema = useMemo(
    () => createActivitySchemaForTrip(tripStartDate, tripEndDate),
    [tripStartDate, tripEndDate],
  );
  const { control, handleSubmit, reset, formState: { errors } } = useForm<CreateActivityInput>({
    resolver: zodResolver(schema),
    defaultValues: { title: '' },
  });

  const onValid = (data: CreateActivityInput) => {
    onSubmit(data);
    reset();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 justify-end">
        <Pressable
          className="absolute inset-0 bg-background/80"
          onPress={handleClose}
        />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
          {/* Handle bar */}
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-md">
            <Text className="text-heading-m text-text-primary">New Activity</Text>
            <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">Cancel</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="gap-md">
              {/* Title */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Title *</Text>
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="e.g. Visit Colosseum"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={100}
                    />
                  )}
                />
                {errors.title && (
                  <Text className="text-danger text-body-small">{errors.title.message}</Text>
                )}
              </View>

              {/* Description */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Description</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="What's the plan?"
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={3}
                      maxLength={1000}
                      style={{ minHeight: 80, textAlignVertical: 'top' }}
                    />
                  )}
                />
              </View>

              {/* Category */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Category</Text>
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange, value } }) => (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerClassName="gap-xs"
                    >
                      {ACTIVITY_CATEGORIES.map((cat) => (
                        <Pressable
                          key={cat}
                          onPress={() => onChange(value === cat ? undefined : cat)}
                          className={`px-md py-sm rounded-full ${
                            value === cat ? 'bg-primary' : 'bg-surface border border-border'
                          }`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text
                            className={`text-body-small capitalize ${
                              value === cat ? 'text-white font-semibold' : 'text-text-secondary'
                            }`}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                />
              </View>

              {/* Date */}
              <Controller
                control={control}
                name="activity_date"
                render={({ field: { onChange, value } }) => (
                  <DateTimePickerField
                    label="Date"
                    mode="date"
                    value={value}
                    onChange={onChange}
                    error={errors.activity_date?.message}
                    minimumDate={tripStartDate ? new Date(tripStartDate + 'T00:00:00') : undefined}
                    maximumDate={tripEndDate ? new Date(tripEndDate + 'T00:00:00') : undefined}
                  />
                )}
              />

              {/* Time row */}
              <View className="flex-row gap-sm">
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="start_time"
                    render={({ field: { onChange, value } }) => (
                      <DateTimePickerField
                        label="Start Time"
                        mode="time"
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  />
                </View>
                <View className="flex-1">
                  <Controller
                    control={control}
                    name="end_time"
                    render={({ field: { onChange, value } }) => (
                      <DateTimePickerField
                        label="End Time"
                        mode="time"
                        value={value}
                        onChange={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Cost Estimate */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Cost Estimate (€)</Text>
                <Controller
                  control={control}
                  name="cost_estimate"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="0.00"
                      value={value != null ? String(value) : ''}
                      onChangeText={(t) => {
                        const num = parseFloat(t);
                        onChange(isNaN(num) ? null : num);
                      }}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
              </View>

              {/* External URL */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">Link</Text>
                <Controller
                  control={control}
                  name="external_url"
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="https://..."
                      value={value ?? ''}
                      onChangeText={(t) => onChange(t || null)}
                      autoCapitalize="none"
                      keyboardType="url"
                      maxLength={2048}
                    />
                  )}
                />
                {errors.external_url && (
                  <Text className="text-danger text-body-small">{errors.external_url.message}</Text>
                )}
              </View>

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onValid)}
                disabled={isPending}
                className={`items-center py-sm rounded-md mt-sm ${
                  isPending ? 'bg-primary/50' : 'bg-primary'
                }`}
                style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-white text-body font-semibold">
                  {isPending ? 'Creating...' : 'Create Activity'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

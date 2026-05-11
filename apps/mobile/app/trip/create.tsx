import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@vacationist/ui';
import { createTripSchema, CURRENCY, SUPPORTED_TIMEZONES } from '@vacationist/types';
import type { CreateTripInput } from '@vacationist/types';
import { useCreateTrip } from '../../src/features/trips/hooks/useTrips';

export default function CreateTripScreen() {
  const router = useRouter();
  const createTrip = useCreateTrip();

  const { control, handleSubmit, formState: { errors } } = useForm<CreateTripInput>({
    resolver: zodResolver(createTripSchema),
    defaultValues: {
      title: '',
      description: '',
      start_date: '',
      end_date: '',
      budget_per_person: null,
      base_currency: 'EUR',
      timezone: 'Europe/Berlin',
    },
  });

  async function onSubmit(data: CreateTripInput) {
    try {
      const trip = await createTrip.mutateAsync(data);
      router.replace({ pathname: '/trip/[id]', params: { id: trip.id } } as never);
    } catch {
      // Error feedback handled by mutation onError callback
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-md pt-md pb-sm gap-md">
        <Pressable onPress={() => router.back()} className="p-xs">
          <Ionicons name="arrow-back" size={24} color="#F2F2F2" />
        </Pressable>
        <Text className="text-heading-l text-text-primary flex-1">New Trip</Text>
      </View>

      <ScrollView contentContainerClassName="px-md pb-3xl gap-md">
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Trip name"
              placeholder="e.g. Summer in Portugal"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.title?.message}
              autoCapitalize="sentences"
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Description (optional)"
              placeholder="What's this trip about?"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.description?.message}
              multiline
              numberOfLines={3}
            />
          )}
        />

        <View className="flex-row gap-md">
          <View className="flex-1">
            <Controller
              control={control}
              name="start_date"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Start date"
                  placeholder="YYYY-MM-DD"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.start_date?.message}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="end_date"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="End date"
                  placeholder="YYYY-MM-DD"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.end_date?.message}
                  keyboardType="numbers-and-punctuation"
                />
              )}
            />
          </View>
        </View>

        <View className="flex-row gap-md">
          <View className="flex-1">
            <Controller
              control={control}
              name="budget_per_person"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Budget per person (optional)"
                  placeholder="0.00"
                  value={value != null ? String(value) : ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    onChange(isNaN(num) ? null : num);
                  }}
                  onBlur={onBlur}
                  error={errors.budget_per_person?.message}
                  keyboardType="decimal-pad"
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="base_currency"
              render={({ field: { value, onChange } }) => (
                <View>
                  <Text className="text-label text-text-muted uppercase mb-xs">Currency</Text>
                  <View className="flex-row gap-sm">
                    {CURRENCY.map((c) => (
                      <Pressable
                        key={c}
                        onPress={() => onChange(c)}
                        className={`flex-1 min-h-[48px] rounded-sm items-center justify-center border ${
                          value === c
                            ? 'bg-primary border-primary'
                            : 'bg-surface border-border'
                        }`}
                      >
                        <Text
                          className={`text-body font-semibold ${
                            value === c ? 'text-white' : 'text-text-secondary'
                          }`}
                        >
                          {c}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="timezone"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-label text-text-muted uppercase mb-xs">Timezone</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-sm"
              >
                {SUPPORTED_TIMEZONES.map((tz) => {
                  const label = tz.replace('Europe/', '');
                  return (
                    <Pressable
                      key={tz}
                      onPress={() => onChange(tz)}
                      className={`px-md min-h-[40px] rounded-full items-center justify-center border ${
                        value === tz
                          ? 'bg-primary border-primary'
                          : 'bg-surface border-border'
                      }`}
                    >
                      <Text
                        className={`text-body-small ${
                          value === tz ? 'text-white font-semibold' : 'text-text-secondary'
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />

        <View className="mt-md">
          <Button
            label="Create Trip"
            onPress={handleSubmit(onSubmit)}
            loading={createTrip.isPending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

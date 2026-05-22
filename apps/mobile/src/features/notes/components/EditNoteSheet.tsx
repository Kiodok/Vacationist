import { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard, ActivityIndicator } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { updateTripNoteSchema, type UpdateTripNoteInput, type TripNote } from '@vacationist/types';

interface EditNoteSheetProps {
  visible: boolean;
  note: TripNote;
  canDelete: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTripNoteInput) => void;
  onDelete: () => void;
  isUpdatePending: boolean;
  isDeletePending: boolean;
}

export function EditNoteSheet({
  visible,
  note,
  canDelete,
  onClose,
  onSubmit,
  onDelete,
  isUpdatePending,
  isDeletePending,
}: EditNoteSheetProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateTripNoteInput>({
    resolver: zodResolver(updateTripNoteSchema),
    defaultValues: {
      title: note.title,
      description: note.description,
    },
  });

  const onValid = (data: UpdateTripNoteInput) => {
    Keyboard.dismiss();
    onSubmit(data);
  };

  const handleClose = () => {
    setConfirmDelete(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <View className="flex-1 justify-end">
          <Pressable className="absolute inset-0 bg-background/80" onPress={handleClose} />
          <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
            <View className="items-center mb-md">
              <View className="w-[36px] h-[4px] rounded-full bg-border" />
            </View>

            <View className="flex-row items-center justify-between mb-md">
              <Text className="text-heading-m text-text-primary">Edit Note</Text>
              <Pressable onPress={handleClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <Text className="text-text-secondary text-body">Cancel</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View className="gap-md">
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Title *</Text>
                  <Controller
                    control={control}
                    name="title"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="Note title"
                        value={value ?? ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        maxLength={100}
                        autoFocus
                      />
                    )}
                  />
                  {errors.title && (
                    <Text className="text-danger text-body-small">{errors.title.message}</Text>
                  )}
                </View>

                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">Description</Text>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="Add details, links, or anything useful…"
                        value={value ?? ''}
                        onChangeText={(v) => onChange(v || null)}
                        onBlur={onBlur}
                        maxLength={1000}
                        multiline
                        numberOfLines={5}
                        style={{ textAlignVertical: 'top', minHeight: 120 }}
                      />
                    )}
                  />
                </View>

                <Pressable
                  onPress={handleSubmit(onValid)}
                  disabled={isUpdatePending}
                  className={`items-center py-sm rounded-md ${isUpdatePending ? 'bg-primary/50' : 'bg-primary'}`}
                  style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-white text-body font-semibold">
                    {isUpdatePending ? 'Saving...' : 'Save Changes'}
                  </Text>
                </Pressable>

                {canDelete && !confirmDelete && (
                  <Pressable
                    onPress={() => setConfirmDelete(true)}
                    className="flex-row items-center justify-center gap-xs py-sm"
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF5C5C" />
                    <Text className="text-danger text-body-small font-semibold">Delete note</Text>
                  </Pressable>
                )}

                {canDelete && confirmDelete && (
                  <View className="rounded-md border border-danger p-md gap-sm">
                    <Text className="text-body-small text-text-secondary text-center">
                      Delete this note? This cannot be undone.
                    </Text>
                    <View className="flex-row gap-sm">
                      <Pressable
                        onPress={() => setConfirmDelete(false)}
                        className="flex-1 min-h-[44px] rounded-md border border-border items-center justify-center"
                        disabled={isDeletePending}
                      >
                        <Text className="text-body text-text-secondary">Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={onDelete}
                        className="flex-1 min-h-[44px] rounded-md bg-danger items-center justify-center"
                        disabled={isDeletePending}
                      >
                        {isDeletePending ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text className="text-body text-white font-semibold">Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

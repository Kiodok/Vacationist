import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Ionicons } from '@expo/vector-icons';
import { updateExpenseWithSplitsSchema, type UpdateExpenseWithSplitsInput, EXPENSE_SPLIT_METHOD, type ExpenseSplitMethod, type Currency, type Expense, type ExpenseSplit } from '@vacationist/types';
import type { TripMemberWithUser } from '@vacationist/api';
import { formatCurrency, roundCurrency, isNegligible } from '@vacationist/utils';

interface EditExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateExpenseWithSplitsInput) => void;
  isPending: boolean;
  expense: Expense;
  splits: ExpenseSplit[];
  members: TripMemberWithUser[];
  currency: Currency;
}

export function EditExpenseSheet({ visible, onClose, onSubmit, isPending, expense, splits, members, currency }: EditExpenseSheetProps) {
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');

  const SPLIT_METHOD_LABELS: Record<ExpenseSplitMethod, string> = {
    even: t('split.even'),
    exact: t('split.exact'),
    shares: t('split.shares'),
  };

  const initialSelectedIds = useMemo(() => new Set(splits.map((s) => s.user_id)), [splits]);
  const initialExact = useMemo(() => {
    const map: Record<string, string> = {};
    if (expense.split_method === 'exact') {
      for (const s of splits) map[s.user_id] = Number(s.amount_owed).toFixed(2);
    }
    return map;
  }, [splits, expense.split_method]);
  const initialShares = useMemo(() => {
    const map: Record<string, number> = {};
    if (expense.split_method === 'shares') {
      for (const s of splits) map[s.user_id] = 1;
    }
    return map;
  }, [splits, expense.split_method]);

  const [amountText, setAmountText] = useState(Number(expense.amount).toFixed(2));
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(initialSelectedIds);
  const [splitMethod, setSplitMethod] = useState<ExpenseSplitMethod>(expense.split_method);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>(initialExact);
  const [shareValues, setShareValues] = useState<Record<string, number>>(initialShares);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UpdateExpenseWithSplitsInput>({
    resolver: zodResolver(updateExpenseWithSplitsSchema),
    defaultValues: {
      title: expense.title,
      amount: Number(expense.amount),
      paid_by: expense.paid_by,
      split_method: expense.split_method,
      splits: splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount_owed) })),
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        title: expense.title,
        amount: Number(expense.amount),
        paid_by: expense.paid_by,
        split_method: expense.split_method,
        splits: splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount_owed) })),
      });
      setAmountText(Number(expense.amount).toFixed(2));
      setSelectedMembers(new Set(splits.map((s) => s.user_id)));
      setSplitMethod(expense.split_method);
      setExactAmounts(expense.split_method === 'exact' ? Object.fromEntries(splits.map((s) => [s.user_id, Number(s.amount_owed).toFixed(2)])) : {});
      setShareValues(expense.split_method === 'shares' ? Object.fromEntries(splits.map((s) => [s.user_id, 1])) : {});
    }
  }, [visible, expense, splits]);

  const totalAmount = watch('amount') ?? 0;

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        if (next.size > 1) next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleSplitMethodChange = (method: ExpenseSplitMethod) => {
    setSplitMethod(method);
    setValue('split_method', method);
  };

  const exactTotal = useMemo(() => {
    let sum = 0;
    for (const uid of selectedMembers) {
      const val = parseFloat(exactAmounts[uid] ?? '');
      if (!isNaN(val)) sum += val;
    }
    return roundCurrency(sum);
  }, [exactAmounts, selectedMembers]);

  const totalShares = useMemo(() => {
    let sum = 0;
    for (const uid of selectedMembers) {
      sum += shareValues[uid] ?? 1;
    }
    return sum;
  }, [shareValues, selectedMembers]);

  const buildSplits = () => {
    const memberIds = Array.from(selectedMembers);
    if (splitMethod === 'even') {
      return memberIds.map((user_id) => ({ user_id }));
    }
    if (splitMethod === 'exact') {
      return memberIds.map((user_id) => ({
        user_id,
        amount: parseFloat(exactAmounts[user_id] ?? '0') || 0,
      }));
    }
    return memberIds.map((user_id) => ({
      user_id,
      shares: shareValues[user_id] ?? 1,
    }));
  };

  const onValid = (data: UpdateExpenseWithSplitsInput) => {
    Keyboard.dismiss();
    onSubmit({ ...data, splits: buildSplits() });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-background/80" onPress={onClose} />
        <View className="bg-surface-elevated rounded-t-lg px-md pt-md pb-xl max-h-[85%]">
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-xs">
            <Text className="text-heading-m text-text-primary">{t('edit.title')}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>
          <Text className="text-body-small text-warning mb-md">{t('edit.warning')}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View className="gap-md">
              {/* Title */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.titleLabel')} *</Text>
                <Controller
                  control={control}
                  name="title"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="e.g. Dinner at Trattoria"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={100}
                    />
                  )}
                />
                {errors.title && <Text className="text-danger text-body-small">{errors.title.message}</Text>}
              </View>

              {/* Amount */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.amountLabel', { currency })} *</Text>
                <Controller
                  control={control}
                  name="amount"
                  render={({ field: { onChange } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder="0.00"
                      value={amountText}
                      onChangeText={(t) => {
                        const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1');
                        setAmountText(cleaned);
                        const num = parseFloat(cleaned);
                        onChange(isNaN(num) ? undefined : num);
                      }}
                      keyboardType="decimal-pad"
                    />
                  )}
                />
                {errors.amount && <Text className="text-danger text-body-small">{errors.amount.message}</Text>}
              </View>

              {/* Paid by */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.paidByLabel')}</Text>
                <Controller
                  control={control}
                  name="paid_by"
                  render={({ field: { onChange, value } }) => (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-xs">
                      {members.map((m) => (
                        <Pressable
                          key={m.user_id}
                          onPress={() => onChange(m.user_id)}
                          className={`px-md py-sm rounded-full ${value === m.user_id ? 'bg-primary' : 'bg-surface border border-border'}`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Text className={`text-body-small ${value === m.user_id ? 'text-white font-semibold' : 'text-text-secondary'}`} numberOfLines={1}>
                            {m.user.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  )}
                />
              </View>

              {/* Split method */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.splitMethodLabel')}</Text>
                <View className="flex-row gap-xs">
                  {EXPENSE_SPLIT_METHOD.map((method) => (
                    <Pressable
                      key={method}
                      onPress={() => handleSplitMethodChange(method)}
                      className={`flex-1 items-center py-sm rounded-md ${splitMethod === method ? 'bg-primary' : 'bg-surface border border-border'}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text className={`text-body-small font-medium ${splitMethod === method ? 'text-white' : 'text-text-secondary'}`}>
                        {SPLIT_METHOD_LABELS[method]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Split among */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">
                  {t('field.splitAmong', { selected: selectedMembers.size, total: members.length })}
                </Text>
                <View className="gap-sm">
                  {members.map((m) => {
                    const isSelected = selectedMembers.has(m.user_id);
                    const perPerson = splitMethod === 'even' && totalAmount > 0 && selectedMembers.size > 0
                      ? roundCurrency(totalAmount / selectedMembers.size)
                      : 0;
                    const memberShares = shareValues[m.user_id] ?? 1;
                    const shareAmount = splitMethod === 'shares' && totalAmount > 0 && totalShares > 0
                      ? roundCurrency((memberShares / totalShares) * totalAmount)
                      : 0;

                    return (
                      <View key={m.user_id} className="gap-xs">
                        <Pressable
                          onPress={() => toggleMember(m.user_id)}
                          className={`flex-row items-center gap-xs px-md py-sm rounded-full ${isSelected ? 'bg-primary' : 'bg-surface border border-border'}`}
                          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                        >
                          <Ionicons
                            name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={16}
                            color={isSelected ? '#FFFFFF' : '#A0A0A0'}
                          />
                          <Text className={`text-body-small flex-1 ${isSelected ? 'text-white font-semibold' : 'text-text-secondary'}`} numberOfLines={1}>
                            {m.user.name}
                          </Text>
                          {isSelected && splitMethod === 'even' && totalAmount > 0 && (
                            <Text className="text-white/70 text-body-small">{formatCurrency(perPerson, currency)}</Text>
                          )}
                        </Pressable>

                        {isSelected && splitMethod === 'exact' && (
                          <View className="flex-row items-center gap-xs ml-lg">
                            <Text className="text-text-muted text-body-small">{currency}</Text>
                            <TextInput
                              className="flex-1 bg-surface border border-border rounded-sm px-md py-xs text-text-primary text-body-small"
                              placeholderTextColor="#5C5C5C"
                              placeholder="0.00"
                              value={exactAmounts[m.user_id] ?? ''}
                              onChangeText={(t) => {
                                const cleaned = t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1');
                                setExactAmounts((prev) => ({ ...prev, [m.user_id]: cleaned }));
                              }}
                              keyboardType="decimal-pad"
                            />
                          </View>
                        )}

                        {isSelected && splitMethod === 'shares' && (
                          <View className="flex-row items-center gap-sm ml-lg">
                            <Pressable
                              onPress={() => setShareValues((prev) => ({ ...prev, [m.user_id]: Math.max(1, (prev[m.user_id] ?? 1) - 1) }))}
                              className="w-[32px] h-[32px] rounded-full bg-surface border border-border items-center justify-center"
                              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                            >
                              <Ionicons name="remove" size={16} color="#A0A0A0" />
                            </Pressable>
                            <Text className="text-text-primary text-body font-semibold w-[24px] text-center">
                              {memberShares}
                            </Text>
                            <Pressable
                              onPress={() => setShareValues((prev) => ({ ...prev, [m.user_id]: (prev[m.user_id] ?? 1) + 1 }))}
                              className="w-[32px] h-[32px] rounded-full bg-surface border border-border items-center justify-center"
                              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                            >
                              <Ionicons name="add" size={16} color="#A0A0A0" />
                            </Pressable>
                            {totalAmount > 0 && (
                              <Text className="text-text-muted text-body-small ml-xs">
                                = {formatCurrency(shareAmount, currency)}
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Exact sum indicator */}
              {splitMethod === 'exact' && totalAmount > 0 && (
                <View className={`flex-row items-center justify-between px-sm py-xs rounded-sm ${isNegligible(exactTotal - totalAmount) ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <Text className={`text-body-small ${isNegligible(exactTotal - totalAmount) ? 'text-success' : 'text-warning'}`}>
                    {isNegligible(exactTotal - totalAmount)
                      ? t('field.amountsMatch')
                      : t('field.remaining', { amount: formatCurrency(totalAmount - exactTotal, currency) })}
                  </Text>
                  <Text className={`text-body-small font-medium ${isNegligible(exactTotal - totalAmount) ? 'text-success' : 'text-warning'}`}>
                    {formatCurrency(exactTotal, currency)} / {formatCurrency(totalAmount, currency)}
                  </Text>
                </View>
              )}

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onValid)}
                disabled={isPending}
                className={`items-center py-sm rounded-md mt-sm ${isPending ? 'bg-primary/50' : 'bg-primary'}`}
                style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-white text-body font-semibold">
                  {isPending ? tCommon('label.saving') : tCommon('button.save')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

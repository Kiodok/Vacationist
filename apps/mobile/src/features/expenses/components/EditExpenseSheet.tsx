import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, Keyboard, Switch } from 'react-native';
import { ScrollView } from '@vacationist/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateExpenseWithSplitsSchema, type UpdateExpenseWithSplitsInput, EXPENSE_SPLIT_METHOD, type ExpenseSplitMethod, type Currency, type Expense, type ExpenseSplit } from '@vacationist/types';

// The "cover" whole-expense split method is retired from the create/edit UI (v1.33.0). Opening
// an existing cover expense here converts it to an even split (real payer restored) on save —
// see the conversion notice and the reset() seeding below.
type SelectableSplitMethod = Exclude<ExpenseSplitMethod, 'cover'>;
const SELECTABLE_SPLIT_METHODS = EXPENSE_SPLIT_METHOD.filter(
  (m): m is SelectableSplitMethod => m !== 'cover',
);
import type { TripMemberWithUser } from '@vacationist/api';
import { formatCurrency, roundCurrency, sanitizeDecimalInput, evenExactShares, storedExactShares, sumExactAmounts, isExactSplitBalanced } from '@vacationist/utils';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import { CurrencyPickerSheet } from '../../currencies/components/CurrencyPickerSheet';
import { useCurrencies, useCurrencyConversion } from '../../currencies/hooks/useCurrencies';
import { setLastUsedCurrency } from '../../currencies/utils/lastUsedCurrency';
import { BoundedVirtualList } from '../../../components/BoundedVirtualList';
import { OptionPickerSheet } from '../../../components/OptionPickerSheet';
import { useToastStore } from '../../../stores/toastStore';
import { SwipeToDismiss } from '../../../components/SwipeToDismiss';
import { SheetScrollArea } from '../../../components/SheetScrollArea';
import { ExpenseDocumentsSection } from './ExpenseDocumentsSection';
import { useExpenseCategoryLabels } from '../hooks/useExpenseCategoryLabels';

interface EditExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateExpenseWithSplitsInput) => void;
  isPending: boolean;
  expense: Expense;
  splits: ExpenseSplit[];
  members: TripMemberWithUser[];
  currency: Currency;
  currentUserId: string | undefined;
  /** Organizer — allowed to delete any attached document, not just their own upload. */
  canManage: boolean;
}

export function EditExpenseSheet({ visible, onClose, onSubmit, isPending, expense, splits, members, currency, currentUserId, canManage }: EditExpenseSheetProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation('common');
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';

  const SPLIT_METHOD_LABELS: Record<SelectableSplitMethod, string> = {
    even: t('split.even'),
    exact: t('split.exact'),
    shares: t('split.shares'),
  };

  const { labels: RELATED_TYPE_LABELS, options: categoryOptions } = useExpenseCategoryLabels();

  const allMemberIds = members.map((m) => m.user_id);

  // A split belonging to someone who has since deleted their account — delete_own_account
  // reassigns their open expense_splits.user_id to the "Deleted User" sentinel rather than
  // destroying the row (CLAUDE.md's Account Deletion section: intentional, disclosed retention
  // behavior, never touched here). Such a split has no entry in `members` at all.
  const orphanSplits = splits.filter((s) => !allMemberIds.includes(s.user_id));
  const hasOrphanSplit = orphanSplits.length > 0;
  const orphanTotal = orphanSplits.reduce(
    (sum, s) => sum + Number(s.amount_owed_original_currency ?? s.amount_owed),
    0,
  );

  // Legacy cover expense: expense.paid_by = covered person, splits[0].user_id = actual payer.
  // Cover is retired from this UI — such an expense is loaded already converted to an even
  // split with the real payer restored, and saving persists that conversion.
  const isCoverExpense = expense.split_method === 'cover';
  const coverActualPayer = isCoverExpense ? (splits[0]?.user_id ?? null) : null;
  const initialSplitMethod: SelectableSplitMethod = expense.split_method === 'cover' ? 'even' : expense.split_method;
  const initialPaidBy = isCoverExpense ? (coverActualPayer ?? currentUserId ?? expense.paid_by) : expense.paid_by;
  // Filtered to ids `members` actually has — a departed member's id would otherwise inflate
  // `selectedMembers.size` while having no chip to render, producing a "4 of 4" header next to a
  // list where one chip is visibly unchecked (the exact "Alex looks included" confusion reported
  // in the 22.09 test session; Alex was never in the split — the 4th share was the departed
  // member's, kept read-only below).
  const initialSelectedIds = isCoverExpense ? allMemberIds : splits.map((s) => s.user_id).filter((id) => allMemberIds.includes(id));

  // `expense.amount` is the grand total (bill + tip); the form edits the bill and the tip separately,
  // so split it back apart. `?? 0`: a row persisted by a pre-v1.39.0 build has no tip_amount.
  const initialTip = roundCurrency(Number(expense.tip_amount ?? 0));
  const initialBill = roundCurrency(Number(expense.amount) - initialTip);

  const [amountText, setAmountText] = useState(initialBill.toFixed(2));
  const [tipText, setTipText] = useState(initialTip > 0 ? initialTip.toFixed(2) : '');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set(initialSelectedIds));
  const [splitMethod, setSplitMethod] = useState<SelectableSplitMethod>(initialSplitMethod);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [shareValues, setShareValues] = useState<Record<string, number>>({});
  const [currencyPickerVisible, setCurrencyPickerVisible] = useState(false);
  const [paidByPickerVisible, setPaidByPickerVisible] = useState(false);
  const paidByOptions = members.map((m) => ({ value: m.user_id, label: m.user.name }));
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  const { data: currencies } = useCurrencies();
  const { convert, ratesAsOf } = useCurrencyConversion();

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UpdateExpenseWithSplitsInput>({
    resolver: zodResolver(updateExpenseWithSplitsSchema),
    defaultValues: {
      title: expense.title,
      description: expense.description ?? undefined,
      amount: initialBill,
      currency: expense.currency,
      paid_by: initialPaidBy,
      related_type: expense.related_type,
      split_method: initialSplitMethod,
      splits: isCoverExpense
        ? allMemberIds.map((user_id) => ({ user_id }))
        : splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount_owed) })),
      is_business: expense.is_business,
    },
  });

  useEffect(() => {
    if (visible) {
      reset({
        title: expense.title,
        description: expense.description ?? undefined,
        amount: initialBill,
        currency: expense.currency,
        paid_by: initialPaidBy,
        related_type: expense.related_type,
        split_method: initialSplitMethod,
        splits: isCoverExpense
          ? allMemberIds.map((user_id) => ({ user_id }))
          : splits.map((s) => ({ user_id: s.user_id, amount: Number(s.amount_owed) })),
        is_business: expense.is_business,
      });
      setAmountText(initialBill.toFixed(2));
      setTipText(initialTip > 0 ? initialTip.toFixed(2) : '');
      setSplitMethod(initialSplitMethod);
      setSelectedMembers(new Set(initialSelectedIds));
      setExactAmounts(expense.split_method === 'exact' ? storedExactShares(splits) : {});
      setShareValues(expense.split_method === 'shares' ? Object.fromEntries(splits.map((s) => [s.user_id, 1])) : {});
    }
  }, [visible, expense, splits]);

  // RHF `amount` is the bill; `totalAmount` (bill + tip) is what the split maths, the exact-sum check
  // and the FX preview work on, and what's submitted as `amount` — see CreateExpenseSheet.
  const billAmount = watch('amount') ?? 0;
  const tip = roundCurrency(parseFloat(tipText) || 0);
  const totalAmount = roundCurrency(billAmount + tip);
  const selectedCurrency = watch('currency') || currency;
  const isForeignCurrency = selectedCurrency !== currency;
  const selectedCurrencyEntry = (currencies ?? []).find((c) => c.code === selectedCurrency);
  const canConvertCurrency = !isForeignCurrency || selectedCurrencyEntry?.is_rate_available !== false;
  const convertedPreview = isForeignCurrency && totalAmount > 0
    ? convert(totalAmount, selectedCurrency, currency)
    : null;

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

  const handleSplitMethodChange = (method: SelectableSplitMethod) => {
    setSplitMethod(method);
    setValue('split_method', method);
    // Switching to "exact" starts from an even split of the total instead of a blank column the user
    // has to fill in cent by cent (an existing even expense would otherwise open with every share empty).
    if (method === 'exact' && selectedMembers.size > 1 && totalAmount > 0 && sumExactAmounts(selectedMembers, exactAmounts) === 0) {
      setExactAmounts(evenExactShares(Array.from(selectedMembers), totalAmount));
    }
  };

  const exactTotal = useMemo(() => {
    if (selectedMembers.size === 1) return roundCurrency(totalAmount);
    return sumExactAmounts(selectedMembers, exactAmounts);
  }, [exactAmounts, selectedMembers, totalAmount]);

  // "Remaining != 0" must block the submit button — an exact split that doesn't add up is rejected by
  // the RPC, which used to look like the button silently doing nothing.
  const exactBalanced = splitMethod !== 'exact' || isExactSplitBalanced(totalAmount, selectedMembers.size, exactTotal);

  const totalShares = useMemo(() => {
    let sum = 0;
    for (const uid of selectedMembers) {
      sum += shareValues[uid] ?? 1;
    }
    return sum;
  }, [shareValues, selectedMembers]);

  const buildSplits = () => {
    if (hasOrphanSplit) {
      // Locked: resubmit every stored split — living members AND the departed member's — with
      // their EXACT stored amounts, untouched by whatever the rest of the form did. Always as
      // 'exact' regardless of the expense's original method: that is the only shape the RPC
      // accepts a pre-computed amount for without silently recomputing it server-side.
      return Object.entries(storedExactShares(splits)).map(([user_id, amount]) => ({
        user_id,
        amount: parseFloat(amount),
      }));
    }
    const memberIds = Array.from(selectedMembers);
    if (splitMethod === 'even') {
      return memberIds.map((user_id) => ({ user_id }));
    }
    if (splitMethod === 'exact') {
      if (memberIds.length === 1) {
        return [{ user_id: memberIds[0], amount: totalAmount }];
      }
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
    // Always send tip_amount (0 when cleared) — omitting it would make the RPC keep the stored tip.
    onSubmit({
      ...data,
      amount: totalAmount,
      tip_amount: tip,
      // Locked splits are always resubmitted as pre-computed 'exact' amounts (see buildSplits) —
      // the method itself must match, or the RPC recomputes them from whatever method the form
      // still shows.
      split_method: hasOrphanSplit ? 'exact' : data.split_method,
      splits: buildSplits(),
    });
  };

  const convertedPayerName = members.find((m) => m.user_id === initialPaidBy)?.user.name ?? '';
  const canSubmit = !isPending && canConvertCurrency && exactBalanced;
  const onInvalid = () => useToastStore.getState().addToast('error', t('toast.checkForm'));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" className="flex-1">
      <SwipeToDismiss
        onDismiss={onClose}
        className="bg-surface-elevated rounded-t-lg px-md pt-md max-h-[85%]"
        style={{ paddingBottom: Math.max(insets.bottom, 32) + 16 }}
      >
          <View className="items-center mb-md">
            <View className="w-[36px] h-[4px] rounded-full bg-border" />
          </View>

          <View className="flex-row items-center justify-between mb-xs">
            <Text className="text-heading-m text-text-primary">{t('edit.title')}</Text>
            <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <Text className="text-text-secondary text-body">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>
          <Text className={`text-body-small text-warning ${isCoverExpense ? 'mb-xs' : 'mb-md'}`}>{t('edit.warning')}</Text>
          {isCoverExpense && (
            <Text className="text-body-small text-warning mb-md">
              {t('edit.coverConverted', { name: convertedPayerName })}
            </Text>
          )}

          <SheetScrollArea>
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
                      placeholder={t('placeholder.title')}
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      maxLength={100}
                    />
                  )}
                />
                {errors.title && <Text className="text-danger text-body-small">{errors.title.message}</Text>}
              </View>

              {/* Description */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.description')}</Text>
                <Controller
                  control={control}
                  name="description"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                      placeholderTextColor="#5C5C5C"
                      placeholder={t('placeholder.description')}
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      multiline
                      numberOfLines={3}
                      maxLength={500}
                      style={{ minHeight: 80, textAlignVertical: 'top' }}
                    />
                  )}
                />
              </View>

              {/* Category */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.categoryLabel')}</Text>
                <Controller
                  control={control}
                  name="related_type"
                  render={({ field: { onChange, value } }) => (
                    <>
                      <Pressable
                        onPress={() => setCategoryPickerVisible(true)}
                        className="bg-surface border border-border rounded-sm px-md py-sm flex-row items-center justify-between"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 48 })}
                      >
                        <Text className="text-body flex-1 text-text-primary">{value ? (RELATED_TYPE_LABELS[value] ?? value) : null}</Text>
                        <ThemedIcon name="chevron-down" size={18} color={colors.textMuted} />
                      </Pressable>
                      <OptionPickerSheet
                        visible={categoryPickerVisible}
                        title={t('field.categoryLabel')}
                        options={categoryOptions}
                        selectedValue={value ?? null}
                        onSelect={(v) => onChange(v)}
                        onClose={() => setCategoryPickerVisible(false)}
                      />
                    </>
                  )}
                />
              </View>

              {/* Amount + currency */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.amountLabel', { currency: selectedCurrency })} *</Text>
                <View className="flex-row gap-xs">
                  <Controller
                    control={control}
                    name="amount"
                    render={({ field: { onChange } }) => (
                      <TextInput
                        className="flex-1 bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                        placeholderTextColor="#5C5C5C"
                        placeholder="0.00"
                        value={amountText}
                        onChangeText={(text) => {
                          const cleaned = sanitizeDecimalInput(text);
                          setAmountText(cleaned);
                          const num = parseFloat(cleaned);
                          onChange(isNaN(num) ? undefined : num);
                        }}
                        keyboardType="decimal-pad"
                        // Locked splits are resubmitted as the exact STORED amounts (buildSplits) —
                        // changing the total here would make them silently fail the RPC's exact-sum
                        // check instead of clearly explaining why.
                        editable={!hasOrphanSplit}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name="currency"
                    render={({ field: { value } }) => (
                      <Pressable
                        onPress={() => setCurrencyPickerVisible(true)}
                        // Locked splits' stored amounts are in the CURRENT currency — changing it
                        // would silently mislabel a departed member's historical share.
                        disabled={hasOrphanSplit}
                        className="bg-surface border border-border rounded-sm px-md items-center justify-center min-w-[72px]"
                        style={({ pressed }) => ({ opacity: pressed || hasOrphanSplit ? 0.7 : 1 })}
                      >
                        <Text className="text-body font-semibold text-text-primary">{value || currency}</Text>
                      </Pressable>
                    )}
                  />
                </View>
                {errors.amount && <Text className="text-danger text-body-small">{errors.amount.message}</Text>}

                {/* Tip — optional; added on top of the amount and split with it. */}
                <Text className="text-label text-text-muted uppercase mt-xs">{t('field.tipLabel', { currency: selectedCurrency })}</Text>
                <TextInput
                  className="bg-surface border border-border rounded-sm px-md py-sm text-text-primary text-body"
                  placeholderTextColor={colors.textMuted}
                  placeholder="0.00"
                  value={tipText}
                  onChangeText={(text) => setTipText(sanitizeDecimalInput(text))}
                  keyboardType="decimal-pad"
                  editable={!hasOrphanSplit}
                />
                {tip > 0 && (
                  <View className="flex-row items-center justify-between">
                    <Text className="text-body-small text-text-secondary">{t('field.totalWithTip')}</Text>
                    <Text className="text-body-small text-text-primary font-semibold">{formatCurrency(totalAmount, selectedCurrency)}</Text>
                  </View>
                )}

                {isForeignCurrency && convertedPreview != null && (
                  <Text className="text-text-secondary text-body-small">
                    {t('field.convertedPreview', { amount: formatCurrency(convertedPreview, currency), asOf: ratesAsOf ?? '—' })}
                  </Text>
                )}
                {isForeignCurrency && !canConvertCurrency && (
                  <Text className="text-danger text-body-small">{t('field.conversionUnavailable', { currency: selectedCurrency })}</Text>
                )}
              </View>

              <CurrencyPickerSheet
                visible={currencyPickerVisible}
                selectedCode={selectedCurrency}
                onSelect={(code) => { setValue('currency', code); setLastUsedCurrency(expense.trip_id, code); }}
                onClose={() => setCurrencyPickerVisible(false)}
              />

              {/* Paid by */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.paidByLabel')}</Text>
                <Controller
                  control={control}
                  name="paid_by"
                  render={({ field: { onChange, value } }) => (
                    <>
                      <Pressable
                        onPress={() => setPaidByPickerVisible(true)}
                        className="bg-surface border border-border rounded-sm px-md py-sm flex-row items-center justify-between"
                        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, minHeight: 48 })}
                      >
                        <Text className="text-body flex-1 text-text-primary" numberOfLines={1}>
                          {members.find((m) => m.user_id === value)?.user.name ?? value}
                        </Text>
                        <ThemedIcon name="chevron-down" size={18} color={colors.textMuted} />
                      </Pressable>
                      <OptionPickerSheet
                        visible={paidByPickerVisible}
                        title={t('field.paidByLabel')}
                        options={paidByOptions}
                        selectedValue={value}
                        onSelect={(v) => onChange(v)}
                        onClose={() => setPaidByPickerVisible(false)}
                      />
                    </>
                  )}
                />
              </View>

              {/* Split method */}
              <View className="gap-xs">
                <Text className="text-label text-text-muted uppercase">{t('field.splitMethodLabel')}</Text>
                <View className="flex-row gap-xs" style={hasOrphanSplit ? { opacity: 0.5 } : undefined}>
                  {SELECTABLE_SPLIT_METHODS.map((method) => (
                    <Pressable
                      key={method}
                      onPress={() => handleSplitMethodChange(method)}
                      disabled={hasOrphanSplit}
                      className={`flex-1 items-center py-sm rounded-md ${splitMethod === method ? 'bg-primary' : 'bg-surface border border-border'}`}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <Text
                        className={`text-body-small font-medium ${splitMethod === method ? 'text-white' : 'text-text-secondary'}`}
                        style={splitMethod === method && isColorful ? { color: colors.surface } : undefined}
                      >
                        {SPLIT_METHOD_LABELS[method]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {hasOrphanSplit && (
                  <Text className="text-body-small text-text-muted">{t('edit.splitLocked')}</Text>
                )}
              </View>

              {/* Split among */}
              {(
                <View className="gap-xs">
                  <Text className="text-label text-text-muted uppercase">
                    {t('field.splitAmong', { selected: selectedMembers.size, total: members.length })}
                  </Text>
                  <BoundedVirtualList
                    data={members}
                    keyExtractor={(m) => m.user_id}
                    itemHeight={56}
                    renderItem={(m) => {
                      const isSelected = selectedMembers.has(m.user_id);
                      const perPerson = splitMethod === 'even' && totalAmount > 0 && selectedMembers.size > 0
                        ? roundCurrency(totalAmount / selectedMembers.size)
                        : 0;
                      const memberShares = shareValues[m.user_id] ?? 1;
                      const shareAmount = splitMethod === 'shares' && totalAmount > 0 && totalShares > 0
                        ? roundCurrency((memberShares / totalShares) * totalAmount)
                        : 0;

                      return (
                        <View className="gap-xs mb-sm" style={hasOrphanSplit ? { opacity: 0.5 } : undefined}>
                          <Pressable
                            onPress={() => toggleMember(m.user_id)}
                            disabled={hasOrphanSplit}
                            className={`flex-row items-center gap-xs px-md py-sm rounded-full ${isSelected ? 'bg-primary' : 'bg-surface border border-border'}`}
                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                          >
                            <ThemedIcon
                              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                              size={16}
                              color={isSelected ? (isColorful ? colors.surface : '#FFFFFF') : colors.textSecondary}
                            />
                            <Text
                              className={`text-body-small flex-1 ${isSelected ? 'text-white font-semibold' : 'text-text-secondary'}`}
                              style={isSelected && isColorful ? { color: colors.surface } : undefined}
                              numberOfLines={1}
                            >
                              {m.user.name}
                            </Text>
                            {isSelected && splitMethod === 'even' && totalAmount > 0 && (
                              <Text className="text-white/70 text-body-small" style={isColorful ? { color: colors.surface, opacity: 0.7 } : undefined}>{formatCurrency(perPerson, selectedCurrency)}</Text>
                            )}
                            {isSelected && splitMethod === 'exact' && selectedMembers.size === 1 && totalAmount > 0 && (
                              <Text className="text-white/70 text-body-small" style={isColorful ? { color: colors.surface, opacity: 0.7 } : undefined}>{formatCurrency(totalAmount, selectedCurrency)}</Text>
                            )}
                          </Pressable>

                          {isSelected && splitMethod === 'exact' && selectedMembers.size > 1 && (
                            <View className="flex-row items-center gap-xs ml-lg">
                              <Text className="text-text-muted text-body-small">{selectedCurrency}</Text>
                              <TextInput
                                className="flex-1 bg-surface border border-border rounded-sm px-md py-xs text-text-primary text-body-small"
                                placeholderTextColor="#5C5C5C"
                                placeholder="0.00"
                                value={exactAmounts[m.user_id] ?? ''}
                                onChangeText={(text) => {
                                  const cleaned = sanitizeDecimalInput(text);
                                  setExactAmounts((prev) => ({ ...prev, [m.user_id]: cleaned }));
                                }}
                                keyboardType="decimal-pad"
                                editable={!hasOrphanSplit}
                              />
                            </View>
                          )}

                          {isSelected && splitMethod === 'shares' && (
                            <View className="flex-row items-center gap-sm ml-lg">
                              <Pressable
                                onPress={() => setShareValues((prev) => ({ ...prev, [m.user_id]: Math.max(1, (prev[m.user_id] ?? 1) - 1) }))}
                                disabled={hasOrphanSplit}
                                className="w-[32px] h-[32px] rounded-full bg-surface border border-border items-center justify-center"
                                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                              >
                                <ThemedIcon name="remove" size={16} color={colors.textSecondary} />
                              </Pressable>
                              <Text className="text-text-primary text-body font-semibold w-[24px] text-center">
                                {memberShares}
                              </Text>
                              <Pressable
                                onPress={() => setShareValues((prev) => ({ ...prev, [m.user_id]: (prev[m.user_id] ?? 1) + 1 }))}
                                disabled={hasOrphanSplit}
                                className="w-[32px] h-[32px] rounded-full bg-surface border border-border items-center justify-center"
                                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                              >
                                <ThemedIcon name="add" size={16} color={colors.textSecondary} />
                              </Pressable>
                              {totalAmount > 0 && (
                                <Text className="text-text-muted text-body-small ml-xs">
                                  = {formatCurrency(shareAmount, selectedCurrency)}
                                </Text>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    }}
                  />
                  {hasOrphanSplit && (
                    <View className="flex-row items-center gap-xs px-md py-sm rounded-md bg-surface border border-border">
                      <ThemedIcon name="information-circle-outline" size={16} color={colors.textMuted} />
                      <Text className="text-body-small text-text-muted flex-1">
                        {t('edit.orphanShare', { amount: formatCurrency(orphanTotal, selectedCurrency) })}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Exact sum indicator */}
              {splitMethod === 'exact' && totalAmount > 0 && selectedMembers.size > 1 && (
                <View className={`flex-row items-center justify-between px-sm py-xs rounded-sm ${exactBalanced ? 'bg-success/10' : 'bg-warning/10'}`}>
                  <Text className={`text-body-small ${exactBalanced ? 'text-success' : 'text-warning'}`}>
                    {exactBalanced
                      ? t('field.amountsMatch')
                      : t('field.remaining', { amount: formatCurrency(totalAmount - exactTotal, selectedCurrency) })}
                  </Text>
                  <Text className={`text-body-small font-medium ${exactBalanced ? 'text-success' : 'text-warning'}`}>
                    {formatCurrency(exactTotal, selectedCurrency)} / {formatCurrency(totalAmount, selectedCurrency)}
                  </Text>
                </View>
              )}

              {/* Business expense */}
              <Controller
                control={control}
                name="is_business"
                render={({ field: { onChange, value } }) => (
                  <View className="flex-row items-center justify-between py-xs">
                    <Text className="text-body text-text-primary">{t('field.businessExpense')}</Text>
                    <Switch
                      value={value ?? false}
                      onValueChange={onChange}
                      trackColor={{ false: '#3E3E3E', true: isColorful ? colors.surface : colors.primary }}
                      thumbColor={isColorful ? colors.surfaceElevated : '#FFFFFF'}
                      ios_backgroundColor="#3E3E3E"
                    />
                  </View>
                )}
              />

              {/* Documents — the expense already exists while editing, so no staging needed
                  (unlike CreateExpenseSheet, which has no expenseId yet). */}
              <ExpenseDocumentsSection
                tripId={expense.trip_id}
                expenseId={expense.id}
                currentUserId={currentUserId}
                canManage={canManage}
              />

              {/* Submit */}
              <Pressable
                onPress={handleSubmit(onValid, onInvalid)}
                disabled={!canSubmit}
                className={`items-center py-sm rounded-md mt-sm ${!canSubmit ? 'bg-primary/50' : 'bg-primary'}`}
                style={({ pressed }) => ({ minHeight: 48, opacity: pressed ? 0.7 : 1 })}
              >
                <Text className="text-white text-body font-semibold" style={isColorful ? { color: colors.surface } : undefined}>
                  {isPending ? tCommon('label.saving') : tCommon('button.save')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
          </SheetScrollArea>
      </SwipeToDismiss>
      </KeyboardAvoidingView>
    </Modal>
  );
}

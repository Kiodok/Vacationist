import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useCollapsibleSections } from '../../../src/hooks/useCollapsibleSections';
import { CollapsibleSectionHeader } from '../../../src/components/CollapsibleSectionHeader';
import type { ExpenseWithSplits, User, CreateExpenseInput } from '@vacationist/types';
import { isExpenseFullySettled } from '@vacationist/utils';
import { useExpenses, useCreateExpense, useArchiveExpense, useUnarchiveExpense, useSettleExpenseSplit, useUnsettleExpenseSplit, useCoverSplit, useUncoverSplit, useTripBalances, useUpdateExpenseWithSplits, useSettleAllExpenses, useSettlementReceipts } from '../../../src/features/expenses/hooks/useExpenses';
import { useExpensesRealtime } from '../../../src/features/expenses/hooks/useExpensesRealtime';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ExpenseCard } from '../../../src/features/expenses/components/ExpenseCard';
import { ExpenseSplitBreakdown } from '../../../src/features/expenses/components/ExpenseSplitBreakdown';
import { CreateExpenseSheet } from '../../../src/features/expenses/components/CreateExpenseSheet';
import { EditExpenseSheet } from '../../../src/features/expenses/components/EditExpenseSheet';
import { EmptyExpenses } from '../../../src/features/expenses/components/EmptyExpenses';
import { ExpenseListSkeleton } from '../../../src/features/expenses/components/ExpenseListSkeleton';
import { SettlementsCard } from '../../../src/features/expenses/components/SettlementsCard';
import { SettlementsModal } from '../../../src/features/expenses/components/SettlementsModal';
import { colors, ThemedIcon, useResolvedTheme } from '@vacationist/ui';
import type { IoniconsName } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

const SECTION_CONFIG: Record<string, { icon: IoniconsName; iconColor: string; textClass: string }> = {
  active:    { icon: 'wallet-outline',         iconColor: colors.textPrimary, textClass: 'text-text-primary' },
  completed: { icon: 'checkmark-done-outline',  iconColor: colors.success,    textClass: 'text-success' },
  archived:  { icon: 'archive-outline',         iconColor: colors.textMuted,  textClass: 'text-text-muted' },
};

export default function ExpensesTab() {
  const theme = useResolvedTheme();
  const isColorful = theme === 'colorful';
  const { t } = useTranslation('expenses');
  const { t: tCommon } = useTranslation("common");
  const { id: tripId, highlightId } = useLocalSearchParams<{ id: string; highlightId?: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const expensesQuery = useExpenses(tripId!);
  const {
    data: expensesData,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = expensesQuery;
  const ux = getQueryDisplayState(expensesQuery);
  const expenses = useMemo(
    () => expensesData?.pages.flatMap((p) => p.items) ?? [],
    [expensesData],
  );
  const { data: members = [] } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: balances = [] } = useTripBalances(tripId!);
  const { data: settlementReceipts = [], isLoading: isLoadingReceipts } = useSettlementReceipts(tripId!);
  const createExpense = useCreateExpense();
  const archiveExpenseMutation = useArchiveExpense();
  const unarchiveExpenseMutation = useUnarchiveExpense();
  const settleAllExpensesMutation = useSettleAllExpenses();
  const settlingRef = useRef(false);
  const sectionListRef = useRef<SectionList<ExpenseWithSplits>>(null);
  useExpensesRealtime(tripId!);
  const { toggle, isCollapsed } = useCollapsibleSections();

  const [showCreate, setShowCreate] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);

  const memberMap = useMemo(() => {
    const map = new Map<string, User>();
    members.forEach((m) => map.set(m.user_id, m.user));
    return map;
  }, [members]);

  const { activeExpenses, completedExpenses, archivedExpenses } = useMemo(() => {
    const active: ExpenseWithSplits[] = [];
    const completed: ExpenseWithSplits[] = [];
    const archived: ExpenseWithSplits[] = [];
    for (const e of expenses) {
      if (e.archived_at) {
        archived.push(e);
      } else if (isExpenseFullySettled(e.expense_splits, e.paid_by)) {
        completed.push(e);
      } else {
        active.push(e);
      }
    }
    return { activeExpenses: active, completedExpenses: completed, archivedExpenses: archived };
  }, [expenses]);

  const sections = useMemo(() => {
    const raw: { key: string; title: string; originalCount: number; data: ExpenseWithSplits[] }[] = [];
    if (activeExpenses.length > 0) {
      raw.push({ key: 'active', title: t('section.active'), originalCount: activeExpenses.length, data: activeExpenses });
    }
    if (completedExpenses.length > 0) {
      raw.push({ key: 'completed', title: t('section.completed'), originalCount: completedExpenses.length, data: completedExpenses });
    }
    if (archivedExpenses.length > 0) {
      raw.push({ key: 'archived', title: t('section.archived'), originalCount: archivedExpenses.length, data: archivedExpenses });
    }
    return raw.map((s) => ({ ...s, data: isCollapsed(s.key) ? [] : s.data }));
  }, [activeExpenses, completedExpenses, archivedExpenses, isCollapsed]);

  const handleCreate = (input: CreateExpenseInput) => {
    setShowCreate(false);
    createExpense.mutate({ tripId: tripId!, input });
  };

  // Scroll to and highlight the expense when navigating from a notification.
  const resolvedHighlightId = highlightId;
  useEffect(() => {
    if (!resolvedHighlightId) return;
    // Search the raw (pre-collapse) arrays so we find the item even in a collapsed section.
    const searchOrder = [
      { key: 'active', data: activeExpenses },
      { key: 'completed', data: completedExpenses },
      { key: 'archived', data: archivedExpenses },
    ] as const;
    for (const { key, data } of searchOrder) {
      const ii = data.findIndex((e) => e.id === resolvedHighlightId);
      if (ii < 0) continue;
      // If the section is collapsed, expand it first; the effect re-fires when sections updates.
      if (isCollapsed(key)) { toggle(key); return; }
      const si = sections.findIndex((s) => s.key === key);
      if (si < 0) return;
      const timer = setTimeout(() => {
        sectionListRef.current?.scrollToLocation({ sectionIndex: si, itemIndex: ii + 1, animated: true, viewOffset: 80 });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [resolvedHighlightId, sections, activeExpenses, completedExpenses, archivedExpenses, isCollapsed, toggle]);

  if (ux.showSkeleton) {
    return <ExpenseListSkeleton />;
  }
  if (ux.showOfflineEmpty) {
    return <OfflineEmptyState onRetry={refetch} />;
  }

  const currency = trip?.base_currency ?? 'EUR';
  const isEmpty = expenses.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyExpenses />
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          windowSize={5}
          maxToRenderPerBatch={10}
          initialNumToRender={10}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          ListHeaderComponent={
            <View className="gap-sm mb-xs">
              <SettlementsCard
                balances={balances}
                onPress={() => setShowSettlements(true)}
              />
              <View className="py-sm px-sm">
                <Text className="text-body-small text-text-secondary">
                  {t('summary.stats', { active: activeExpenses.length, completed: completedExpenses.length })}
                </Text>
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const key = section.key ?? 'active';
            const cfg = SECTION_CONFIG[key] ?? SECTION_CONFIG.active;
            return (
              <CollapsibleSectionHeader
                icon={cfg.icon}
                iconColor={cfg.iconColor}
                textClass={cfg.textClass}
                title={section.title}
                count={section.originalCount}
                collapsed={isCollapsed(key)}
                onToggle={() => toggle(key)}
              />
            );
          }}
          renderItem={({ item }) => (
            <View className="mb-sm" style={item.archived_at ? { opacity: 0.5 } : undefined}>
              <ExpenseCardWithSplits
                expense={item}
                tripId={tripId!}
                memberMap={memberMap}
                members={members}
                currentUserId={user?.id}
                role={role}
                currency={currency}
                highlight={item.id === resolvedHighlightId}
                onArchive={() => archiveExpenseMutation.mutate({ expenseId: item.id, tripId: tripId! })}
                onUnarchive={() => unarchiveExpenseMutation.mutate({ expenseId: item.id, tripId: tripId! })}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListFooterComponent={
            hasNextPage ? (
              <Pressable
                onPress={() => fetchNextPage()}
                className="py-md items-center"
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage
                  ? <ActivityIndicator color={colors.primary} />
                  : <Text className="text-primary text-body font-semibold">{t('loadMore')}</Text>}
              </Pressable>
            ) : null
          }
        />
      )}

      {user && showCreate && (
        <CreateExpenseSheet
          visible
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={isMutationBusy(createExpense)}
          members={members}
          currentUserId={user.id}
          currency={currency}
        />
      )}

      {showSettlements && (
        <SettlementsModal
          visible
          onClose={() => setShowSettlements(false)}
          balances={balances}
          members={memberMap}
          currency={currency}
          tripId={tripId!}
          tripTitle={trip?.title ?? ''}
          onSettleAllExpenses={() => {
            if (settlingRef.current) return;
            settlingRef.current = true;
            settleAllExpensesMutation.mutate(
              { tripId: tripId! },
              { onSettled: () => { settlingRef.current = false; } },
            );
          }}
          isSettlingAll={settleAllExpensesMutation.isPending}
          receipts={settlementReceipts}
          isLoadingReceipts={isLoadingReceipts}
          onViewReceipt={(receiptId) => {
            setShowSettlements(false);
            router.push(`/trip/${tripId}/settlement-receipt?receiptId=${receiptId}`);
          }}
        />
      )}

      {/* FAB — rendered last to guarantee it sits above all siblings in the z-order */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <ThemedIcon name="add" size={28} color={isColorful ? colors.surfaceElevated : '#FFFFFF'} />
      </Pressable>
    </View>
  );
}

function ExpenseCardWithSplits({
  expense,
  tripId,
  memberMap,
  members,
  currentUserId,
  role,
  currency,
  highlight,
  onArchive,
  onUnarchive,
}: {
  expense: ExpenseWithSplits;
  tripId: string;
  memberMap: Map<string, User>;
  members: import('@vacationist/api').TripMemberWithUser[];
  currentUserId: string | undefined;
  role: string | null | undefined;
  currency: import('@vacationist/types').Currency;
  highlight?: boolean;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const { t } = useTranslation("expenses");
  const { t: tCommon } = useTranslation("common");
  const splits = expense.expense_splits;
  const updateExpense = useUpdateExpenseWithSplits();
  const settleSplit = useSettleExpenseSplit();
  const unsettleSplit = useUnsettleExpenseSplit();
  const coverSplitMutation = useCoverSplit();
  const uncoverSplitMutation = useUncoverSplit();
  const [showSplits, setShowSplits] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const canEdit =
    !expense.archived_at && (role === 'organizer' || expense.created_by === currentUserId);
  const isArchived = !!expense.archived_at;
  const canArchiveOrRestore =
    role === 'organizer' || expense.created_by === currentUserId;
  const canManage = role === 'organizer';

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      <Pressable
        onPress={() => setShowSplits(true)}
        className="flex-row items-center gap-xs"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <ThemedIcon name="people-outline" size={14} color={colors.primary} />
        <Text className="text-primary text-body-small font-medium">{t('action.viewSplits', { count: splits.length })}</Text>
      </Pressable>

      <View className="gap-sm mt-xs">
        {confirmingArchive ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">
              {isArchived ? t('confirm.restore') : t('confirm.archive')}
            </Text>
            <Pressable
              onPress={() => {
                if (isArchived) { onUnarchive(); } else { onArchive(); }
                setConfirmingArchive(false);
              }}
              className={`px-sm py-xs rounded-sm ${isArchived ? 'bg-success/20' : 'bg-danger/20'}`}
            >
              <Text className={`text-body-small font-semibold ${isArchived ? 'text-success' : 'text-danger'}`}>
                {isArchived ? t('confirm.restoreYes') : t('confirm.archiveYes')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmingArchive(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">{tCommon('button.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-sm">
            {canEdit && (
              <Pressable
                onPress={() => setShowEdit(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <ThemedIcon name="create-outline" size={14} color={colors.primary} />
                <Text className="text-primary text-body-small font-medium">{t('action.edit')}</Text>
              </Pressable>
            )}
            {canArchiveOrRestore && (
              <Pressable
                onPress={() => setConfirmingArchive(true)}
                className={`flex-row items-center gap-xs px-md py-sm rounded-sm ${isArchived ? 'bg-success/10' : 'bg-danger/10'}`}
              >
                <ThemedIcon
                  name={isArchived ? 'arrow-undo-outline' : 'archive-outline'}
                  size={14}
                  color={isArchived ? colors.success : colors.danger}
                />
                <Text className={`text-body-small font-medium ${isArchived ? 'text-success' : 'text-danger'}`}>
                  {isArchived ? t('action.restore') : t('action.archive')}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  ) : undefined;

  return (
    <>
      <ExpenseCard
        expense={expense}
        splits={splits}
        members={memberMap}
        currentUserId={currentUserId}
        currency={currency}
        highlight={highlight}
        onPress={() => setShowDetail(!showDetail)}
        detail={detailContent}
      />

      <ExpenseSplitBreakdown
        visible={showSplits}
        onClose={() => setShowSplits(false)}
        expense={expense}
        splits={splits}
        members={memberMap}
        currentUserId={currentUserId}
        currency={currency}
        onSettle={(splitId) => settleSplit.mutate({ splitId, expenseId: expense.id, tripId })}
        onUnsettle={(splitId) => unsettleSplit.mutate({ splitId, expenseId: expense.id, tripId })}
        onCover={(splitId) => coverSplitMutation.mutate({ splitId, expenseId: expense.id, tripId })}
        onUncover={(splitId) => uncoverSplitMutation.mutate({ splitId, expenseId: expense.id, tripId })}
        canManage={canManage}
      />

      {showEdit && (
        <EditExpenseSheet
          visible={showEdit}
          onClose={() => setShowEdit(false)}
          onSubmit={(input) => {
            setShowEdit(false);
            updateExpense.mutate({ expenseId: expense.id, tripId, input });
          }}
          isPending={isMutationBusy(updateExpense)}
          expense={expense}
          splits={splits}
          members={members}
          currency={currency}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}

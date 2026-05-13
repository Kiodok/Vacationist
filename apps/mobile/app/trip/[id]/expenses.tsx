import { useState, useMemo } from 'react';
import { View, Text, Pressable, SectionList, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExpenseWithSplits, User, CreateExpenseInput } from '@vacationist/types';
import { formatCurrency, isExpenseFullySettled } from '@vacationist/utils';
import { useExpenses, useCreateExpense, useArchiveExpense, useSettleExpenseSplit, useUnsettleExpenseSplit, useTripBalances, useUpdateExpenseWithSplits } from '../../../src/features/expenses/hooks/useExpenses';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ExpenseCard } from '../../../src/features/expenses/components/ExpenseCard';
import { ExpenseSplitBreakdown } from '../../../src/features/expenses/components/ExpenseSplitBreakdown';
import { CreateExpenseSheet } from '../../../src/features/expenses/components/CreateExpenseSheet';
import { EditExpenseSheet } from '../../../src/features/expenses/components/EditExpenseSheet';
import { EmptyExpenses } from '../../../src/features/expenses/components/EmptyExpenses';
import { SettlementsCard } from '../../../src/features/expenses/components/SettlementsCard';
import { SettlementsModal } from '../../../src/features/expenses/components/SettlementsModal';

export default function ExpensesTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const { data: trip } = useTrip(tripId!);
  const { data: expenses, isLoading } = useExpenses(tripId!);
  const { data: members = [] } = useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);
  const { data: balances = [] } = useTripBalances(tripId!);
  const createExpense = useCreateExpense(tripId!);
  const archiveExpense = useArchiveExpense(tripId!);

  const [showCreate, setShowCreate] = useState(false);
  const [showSettlements, setShowSettlements] = useState(false);

  const memberMap = useMemo(() => {
    const map = new Map<string, User>();
    members.forEach((m) => map.set(m.user_id, m.user));
    return map;
  }, [members]);

  const { activeExpenses, completedExpenses, archivedExpenses, activeTotal } = useMemo(() => {
    const active: ExpenseWithSplits[] = [];
    const completed: ExpenseWithSplits[] = [];
    const archived: ExpenseWithSplits[] = [];
    let total = 0;
    for (const e of expenses ?? []) {
      if (e.archived_at) {
        archived.push(e);
      } else if (isExpenseFullySettled(e.expense_splits, e.paid_by)) {
        completed.push(e);
      } else {
        active.push(e);
        total += Number(e.amount);
      }
    }
    return { activeExpenses: active, completedExpenses: completed, archivedExpenses: archived, activeTotal: total };
  }, [expenses]);

  const sections = useMemo(() => {
    const result: { key: string; title: string; data: ExpenseWithSplits[] }[] = [];
    if (activeExpenses.length > 0) {
      result.push({ key: 'active', title: 'Active', data: activeExpenses });
    }
    if (completedExpenses.length > 0) {
      result.push({ key: 'completed', title: 'Completed', data: completedExpenses });
    }
    if (archivedExpenses.length > 0) {
      result.push({ key: 'archived', title: 'Archived', data: archivedExpenses });
    }
    return result;
  }, [activeExpenses, completedExpenses, archivedExpenses]);

  const handleCreate = (input: CreateExpenseInput) => {
    createExpense.mutate(input, { onSuccess: () => setShowCreate(false) });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" />
      </View>
    );
  }

  const currency = trip?.base_currency ?? 'EUR';
  const isEmpty = !expenses || expenses.length === 0;

  return (
    <View className="flex-1">
      {isEmpty ? (
        <View className="flex-1 px-md py-md">
          <EmptyExpenses />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          contentContainerClassName="px-md py-md"
          ListHeaderComponent={
            <View className="gap-sm mb-xs">
              <SettlementsCard
                balances={balances}
                onPress={() => setShowSettlements(true)}
              />
              <View className="flex-row items-center justify-between py-sm px-sm">
                <Text className="text-body-small text-text-secondary">
                  {activeExpenses.length} active · {completedExpenses.length} completed
                </Text>
                <Text className="text-body text-text-primary font-semibold">
                  Open: {formatCurrency(activeTotal, currency)}
                </Text>
              </View>
            </View>
          }
          renderSectionHeader={({ section }) => {
            const icon = section.key === 'active'
              ? 'wallet-outline' as const
              : section.key === 'completed'
                ? 'checkmark-done-outline' as const
                : 'archive-outline' as const;
            const color = section.key === 'active' ? '#F2F2F2' : section.key === 'completed' ? '#3ECF8E' : '#A0A0A0';
            const textClass = section.key === 'active' ? 'text-text-primary' : section.key === 'completed' ? 'text-success' : 'text-text-muted';
            return (
              <View className="flex-row items-center gap-xs pt-md pb-sm px-xs">
                <Ionicons name={icon} size={16} color={color} />
                <Text className={`text-body font-semibold ${textClass}`}>
                  {section.title}
                </Text>
                <Text className="text-body-small text-text-muted">
                  ({section.data.length})
                </Text>
              </View>
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
                onArchive={() => archiveExpense.mutate(item.id)}
              />
            </View>
          )}
        />
      )}

      {user && showCreate && (
        <CreateExpenseSheet
          visible
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
          isPending={createExpense.isPending}
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
        />
      )}

      {/* FAB — rendered last to guarantee it sits above all siblings in the z-order */}
      <Pressable
        onPress={() => setShowCreate(true)}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
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
  onArchive,
}: {
  expense: ExpenseWithSplits;
  tripId: string;
  memberMap: Map<string, User>;
  members: import('@vacationist/api').TripMemberWithUser[];
  currentUserId: string | undefined;
  role: string | null | undefined;
  currency: import('@vacationist/types').Currency;
  onArchive: () => void;
}) {
  const splits = expense.expense_splits;
  const updateExpense = useUpdateExpenseWithSplits(tripId);
  const settleSplit = useSettleExpenseSplit(tripId, expense.id);
  const unsettleSplit = useUnsettleExpenseSplit(tripId, expense.id);
  const [showSplits, setShowSplits] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const canEdit =
    !expense.archived_at && (role === 'organizer' || expense.created_by === currentUserId);
  const canArchive =
    role === 'organizer' || expense.created_by === currentUserId;
  const canManage = role === 'organizer';

  const detailContent = showDetail ? (
    <View className="border-t border-border px-md py-sm gap-sm rounded-b-md">
      <Pressable
        onPress={() => setShowSplits(true)}
        className="flex-row items-center gap-xs"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Ionicons name="people-outline" size={14} color="#6C63FF" />
        <Text className="text-primary text-body-small font-medium">View splits ({splits.length})</Text>
      </Pressable>

      <View className="gap-sm mt-xs">
        {confirmingArchive ? (
          <View className="flex-row items-center gap-sm">
            <Text className="text-text-secondary text-body-small">Archive this expense?</Text>
            <Pressable
              onPress={() => { onArchive(); setConfirmingArchive(false); }}
              className="px-sm py-xs rounded-sm bg-danger/20"
            >
              <Text className="text-danger text-body-small font-semibold">Yes, archive</Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmingArchive(false)}
              className="px-sm py-xs rounded-sm"
            >
              <Text className="text-text-secondary text-body-small">Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-sm">
            {canEdit && (
              <Pressable
                onPress={() => setShowEdit(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-primary/10"
              >
                <Ionicons name="create-outline" size={14} color="#6C63FF" />
                <Text className="text-primary text-body-small font-medium">Edit</Text>
              </Pressable>
            )}
            {canArchive && (
              <Pressable
                onPress={() => setConfirmingArchive(true)}
                className="flex-row items-center gap-xs px-md py-sm rounded-sm bg-danger/10"
              >
                <Ionicons name="archive-outline" size={14} color="#FF5C5C" />
                <Text className="text-danger text-body-small font-medium">Archive</Text>
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
        onSettle={(splitId) => settleSplit.mutate(splitId)}
        onUnsettle={(splitId) => unsettleSplit.mutate(splitId)}
        canManage={canManage}
      />

      {showEdit && (
        <EditExpenseSheet
          visible={showEdit}
          onClose={() => setShowEdit(false)}
          onSubmit={(input) => {
            updateExpense.mutate({ expenseId: expense.id, input }, { onSuccess: () => setShowEdit(false) });
          }}
          isPending={updateExpense.isPending}
          expense={expense}
          splits={splits}
          members={members}
          currency={currency}
        />
      )}
    </>
  );
}

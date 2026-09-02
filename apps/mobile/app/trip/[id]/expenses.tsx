import { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, Pressable, SectionList, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useTranslation } from 'react-i18next';
import { useCollapsibleSections } from '../../../src/hooks/useCollapsibleSections';
import { CollapsibleSectionHeader } from '../../../src/components/CollapsibleSectionHeader';
import type { ExpenseWithSplits, User, CreateExpenseInput } from '@vacationist/types';
import { isExpenseFullySettled, formatBusinessExpenseSummary, buildBusinessExpenseReport } from '@vacationist/utils';
import { getAllExpenses, getExpenseDocuments, getExpenseDocumentUrl, renderBusinessExpensePdf } from '@vacationist/api';
import * as FileSystem from 'expo-file-system/legacy';
import { useExpenses, useCreateExpense, useArchiveExpense, useUnarchiveExpense, useSettleExpenseSplit, useUnsettleExpenseSplit, useCoverSplit, useUncoverSplit, useTripBalances, useUpdateExpenseWithSplits, useSettleAllExpenses, useSettlementReceipts, useHasBusinessExpenses } from '../../../src/features/expenses/hooks/useExpenses';
import { useExpensesRealtime } from '../../../src/features/expenses/hooks/useExpensesRealtime';
import { useTrip } from '../../../src/features/trips/hooks/useTrips';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ExpenseCard } from '../../../src/features/expenses/components/ExpenseCard';
import { ExpenseSplitBreakdown } from '../../../src/features/expenses/components/ExpenseSplitBreakdown';
import { ExpenseDocumentsSection } from '../../../src/features/expenses/components/ExpenseDocumentsSection';
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
import { CurrencyPickerSheet } from '../../../src/features/currencies/components/CurrencyPickerSheet';
import { useCurrencyConversion } from '../../../src/features/currencies/hooks/useCurrencies';
import { shareText, shareFile, downloadTextFile, deliverBase64File } from '../../../src/utils/share';
import { useToastStore } from '../../../src/stores/toastStore';

// Business summary document links are embedded in a file the user downloads and may open well
// after the fact (e.g. handing it to an employer) — a long TTL, not the 5-minute in-app default.
const BUSINESS_SUMMARY_DOCUMENT_URL_TTL_SECONDS = 60 * 60 * 24 * 30;

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
  const { id: tripId, highlightId, quickAction } = useLocalSearchParams<{ id: string; highlightId?: string; quickAction?: string }>();
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
  const scrollTargetRef = useRef<{ sectionIndex: number; itemIndex: number } | null>(null);
  const scrollRetriedRef = useRef(false);
  useExpensesRealtime(tripId!);
  const { toggle, isCollapsed } = useCollapsibleSections();

  // Lazy initializers, not a mount effect — read once so the sheet doesn't keep reopening on
  // every re-render while quickAction stays present in the URL (task 16: app-icon "Add
  // Expense" quick action auto-selects this trip and opens the sheet immediately).
  const [showCreate, setShowCreate] = useState(() => quickAction === 'addExpense');
  // Real state, not a one-time lazy value: must be reset to false whenever the sheet is opened
  // for a reason other than the quick action (the FAB below), or the "Adding to: {trip}" banner
  // would incorrectly persist for every subsequent open during the same screen visit.
  const [cameFromQuickAction, setCameFromQuickAction] = useState(() => quickAction === 'addExpense');
  const [showSettlements, setShowSettlements] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(user?.preferred_currency ?? null);
  const [showDisplayCurrencyPicker, setShowDisplayCurrencyPicker] = useState(false);
  const { convert, ratesAsOf } = useCurrencyConversion();
  const [isGeneratingBusinessSummary, setIsGeneratingBusinessSummary] = useState(false);
  const { data: hasBusinessExpenses } = useHasBusinessExpenses(tripId!);
  const addToast = useToastStore((s) => s.addToast);

  const memberMap = useMemo(() => {
    const map = new Map<string, User>();
    members.forEach((m) => map.set(m.user_id, m.user));
    for (const e of expenses) {
      if (e.payer && !map.has(e.payer.id)) {
        map.set(e.payer.id, { id: e.payer.id, name: e.payer.name, avatar_url: e.payer.avatar_url, email: null, locale: null, timezone: 'UTC', is_guest: false, preferred_currency: null, created_at: '', updated_at: '' });
      }
      for (const s of e.expense_splits) {
        if (s.split_user && !map.has(s.split_user.id)) {
          map.set(s.split_user.id, { id: s.split_user.id, name: s.split_user.name, avatar_url: s.split_user.avatar_url, email: null, locale: null, timezone: 'UTC', is_guest: false, preferred_currency: null, created_at: '', updated_at: '' });
        }
      }
    }
    return map;
  }, [members, expenses]);

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

  // Fetches the whole trip's expenses on demand (not via a reactive query — this is an
  // occasional export action, not something that should eagerly load every expense on every
  // visit to this screen the way the paginated feed above does). Each business expense's
  // attached documents are pulled in too (as long-lived signed links) so the downloaded files
  // are a complete standalone record. Produces BOTH a Markdown file (for the links / editing)
  // and a PDF (rendered by the render-business-expense-pdf Edge Function, so the layout is
  // identical on every platform with no native module). Web downloads both; native writes both
  // to the cache dir and opens the OS share sheet once per file. If the PDF can't be produced,
  // the Markdown is still delivered.
  const handleBusinessSummary = async () => {
    if (isGeneratingBusinessSummary) return;
    setIsGeneratingBusinessSummary(true);
    try {
      const allExpenses = await getAllExpenses(tripId!);
      const businessExpenses = allExpenses.filter((e) => e.is_business);
      if (businessExpenses.length === 0) {
        addToast('error', t('toast.businessSummaryEmpty'));
        return;
      }

      const currencyCode = trip?.base_currency ?? 'EUR';
      const tripTitle = trip?.title ?? '';

      const documentsByExpenseId = new Map<string, { fileName: string; url: string }[]>();
      await Promise.all(
        businessExpenses.map(async (e) => {
          const docs = await getExpenseDocuments(e.id);
          if (docs.length === 0) return;
          const refs = await Promise.all(
            docs.map(async (d) => ({
              fileName: d.file_name,
              url: await getExpenseDocumentUrl(d.storage_path, BUSINESS_SUMMARY_DOCUMENT_URL_TTL_SECONDS),
            })),
          );
          documentsByExpenseId.set(e.id, refs);
        }),
      );

      // One structured report drives both outputs, so the .md and .pdf can never disagree on
      // date/currency/payer formatting (buildBusinessExpenseReport owns all of it).
      const reportInput = {
        expenses: allExpenses,
        members: memberMap,
        currency: currencyCode,
        tripTitle,
        documentsByExpenseId,
      };
      const report = buildBusinessExpenseReport(reportInput);
      const markdown = formatBusinessExpenseSummary(reportInput);

      let pdfBase64: string | null = null;
      try {
        pdfBase64 = await renderBusinessExpensePdf({
          tripTitle: report.tripTitle,
          currency: currencyCode,
          rows: report.rows,
          total: report.total,
          count: report.count,
        });
      } catch {
        pdfBase64 = null;
      }

      const slug = (tripTitle || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const mdName = `${slug}-business-expenses.md`;
      const pdfName = `${slug}-business-expenses.pdf`;

      if (Platform.OS === 'web') {
        // Two back-to-back anchor downloads can trip Chrome's "download multiple files" gate.
        // PDF first (the primary deliverable for an employer), then the Markdown a tick later.
        if (pdfBase64) {
          await deliverBase64File(pdfName, pdfBase64, 'application/pdf');
          await new Promise((r) => setTimeout(r, 400));
        }
        downloadTextFile(mdName, markdown, 'text/markdown');
        addToast(pdfBase64 ? 'success' : 'warning', pdfBase64 ? t('toast.businessSummaryDownloaded') : t('toast.businessSummaryMdOnly'));
      } else if (pdfBase64) {
        // Native: one share sheet for the PDF — the complete report (table, total, and clickable
        // links to each attached receipt). iOS refuses to present a second share sheet while the
        // first is dismissing, so a separate Markdown sheet is not attempted here; the PDF alone
        // is what gets handed to an employer.
        const result = await deliverBase64File(pdfName, pdfBase64, 'application/pdf');
        addToast(result === 'shared' || result === 'downloaded' ? 'success' : 'warning', t('toast.businessSummaryShared'));
      } else {
        // PDF generation failed — fall back to the Markdown so the user still gets the data.
        const mdUri = FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}${mdName}` : null;
        if (mdUri) {
          await FileSystem.writeAsStringAsync(mdUri, markdown, { encoding: FileSystem.EncodingType.UTF8 });
          const r = await shareFile({ fileUri: mdUri, mimeType: 'text/markdown', dialogTitle: mdName });
          if (r === 'dismissed') await shareText({ text: markdown, title: mdName });
        } else {
          await shareText({ text: markdown, title: mdName });
        }
        addToast('warning', t('toast.businessSummaryMdOnly'));
      }
    } catch {
      addToast('error', t('toast.businessSummaryFailed'));
    } finally {
      setIsGeneratingBusinessSummary(false);
    }
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
        scrollTargetRef.current = { sectionIndex: si, itemIndex: ii + 1 };
        scrollRetriedRef.current = false;
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
          onScrollToIndexFailed={() => {
            const target = scrollTargetRef.current;
            if (!target || scrollRetriedRef.current) return;
            scrollRetriedRef.current = true;
            requestAnimationFrame(() => {
              sectionListRef.current?.scrollToLocation({ ...target, animated: false, viewOffset: 80 });
            });
          }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
          ListHeaderComponent={
            <View className="gap-sm mb-xs">
              <SettlementsCard
                balances={balances}
                onPress={() => setShowSettlements(true)}
              />
              <View className="py-sm px-sm flex-row items-center justify-between">
                <Text className="text-body-small text-text-secondary">
                  {t('summary.stats', { active: activeExpenses.length, completed: completedExpenses.length })}
                </Text>
                <Pressable
                  onPress={() => setShowDisplayCurrencyPicker(true)}
                  className="flex-row items-center gap-xs px-sm py-xs rounded-full bg-primary/10"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <ThemedIcon name="swap-horizontal-outline" size={13} color={colors.primary} />
                  <Text className="text-primary text-label font-medium">
                    {t('summary.showIn', { currency: displayCurrency ?? currency })}
                  </Text>
                </Pressable>
              </View>
              {hasBusinessExpenses && (
                <Pressable
                  onPress={handleBusinessSummary}
                  disabled={isGeneratingBusinessSummary}
                  className="flex-row items-center justify-center gap-xs py-sm px-sm rounded-md bg-primary/10 self-start"
                  style={({ pressed }) => ({ opacity: pressed || isGeneratingBusinessSummary ? 0.6 : 1 })}
                >
                  {isGeneratingBusinessSummary ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <ThemedIcon name="briefcase-outline" size={14} color={colors.primary} />
                  )}
                  <Text className="text-primary text-body-small font-medium">{t('action.businessSummary')}</Text>
                </Pressable>
              )}
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
            <View style={item.archived_at ? { opacity: 0.5, marginBottom: 12 } : { marginBottom: 12 }}>
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
          autoSelectedTripBanner={
            cameFromQuickAction && trip ? t('quickAction.addingTo', { trip: trip.title }) : undefined
          }
        />
      )}

      <CurrencyPickerSheet
        visible={showDisplayCurrencyPicker}
        selectedCode={displayCurrency ?? currency}
        onSelect={setDisplayCurrency}
        onClose={() => setShowDisplayCurrencyPicker(false)}
        onlyRateAvailable
      />

      {showSettlements && (
        <SettlementsModal
          visible
          onClose={() => setShowSettlements(false)}
          balances={balances}
          members={memberMap}
          currency={currency}
          displayCurrency={displayCurrency}
          convert={convert}
          ratesAsOf={ratesAsOf}
          tripId={tripId!}
          tripTitle={trip?.title ?? ''}
          currentUserId={user?.id}
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
        onPress={() => { setCameFromQuickAction(false); setShowCreate(true); }}
        className="absolute bottom-md right-md w-[56px] h-[56px] rounded-full bg-primary items-center justify-center"
        style={{ elevation: 6, zIndex: 10, ...Platform.select({ web: { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }, default: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } }) }}
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

      <ExpenseDocumentsSection
        tripId={tripId}
        expenseId={expense.id}
        currentUserId={currentUserId}
        canManage={canManage}
      />

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

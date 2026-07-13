import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router';

import { useTranslation } from 'react-i18next';
import type { TripMessageWithSender } from '@vacationist/types';
import { useTripMessages, useCreateMessage, useUpdateMessage, useDeleteMessage } from '../../../src/features/chat/hooks/useTripMessages';
import { useTripChatRealtime } from '../../../src/features/chat/hooks/useTripChatRealtime';
import { useTripMembers, useCurrentMemberRole } from '../../../src/features/trips/hooks/useMembers';
import { useAuthStore } from '../../../src/stores/authStore';
import { ChatMessageRow } from '../../../src/features/chat/components/ChatMessageRow';
import { ChatInputBar } from '../../../src/features/chat/components/ChatInputBar';
import { MessageActionsSheet } from '../../../src/features/chat/components/MessageActionsSheet';
import { colors, EmptyState } from '@vacationist/ui';
import { isMutationBusy } from '../../../src/utils/mutationStatus';
import { getQueryDisplayState } from '../../../src/hooks/useOfflineAwareQuery';
import { OfflineEmptyState } from '../../../src/components/OfflineEmptyState';

export default function ChatTab() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation('chat');
  const currentUser = useAuthStore((s) => s.user);

  const messagesQuery = useTripMessages(tripId!);
  const { data, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = messagesQuery;
  const ux = getQueryDisplayState(messagesQuery);
  useTripChatRealtime(tripId!);
  // Keeps the members cache warm for realtime sender enrichment.
  useTripMembers(tripId!);
  const { data: role } = useCurrentMemberRole(tripId!);

  const createMessage = useCreateMessage();
  const updateMessage = useUpdateMessage();
  const deleteMessage = useDeleteMessage();

  const [actionMessage, setActionMessage] = useState<TripMessageWithSender | null>(null);
  const [editingMessage, setEditingMessage] = useState<TripMessageWithSender | null>(null);

  const isOrganizer = role === 'organizer';

  // Pages are newest-first (keyset desc) — flatten and reverse for ascending
  // chronological rendering, newest at the bottom.
  const messages = useMemo(
    () => (data?.pages ?? []).flatMap((page) => page.items).reverse(),
    [data],
  );

  const canEditMessage = (message: TripMessageWithSender) =>
    message.created_by === currentUser?.id;
  const canDeleteMessage = (message: TripMessageWithSender) =>
    canEditMessage(message) || isOrganizer;

  const handleSend = (text: string) => {
    createMessage.mutate({ tripId: tripId!, input: { text } });
  };

  const handleSaveEdit = (messageId: string, text: string) => {
    updateMessage.mutate({ messageId, tripId: tripId!, input: { text } });
  };

  const handleDelete = () => {
    if (!actionMessage) return;
    deleteMessage.mutate({ messageId: actionMessage.id, tripId: tripId! });
    setActionMessage(null);
  };

  const handleEdit = () => {
    setEditingMessage(actionMessage);
    setActionMessage(null);
  };

  const handleLoadOlder = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  // Same KeyboardAvoidingView pattern as the shopping-list screen, but the
  // chat tab renders below the trip header + pill bar, so the offset is the
  // tab content's measured absolute Y. RN's KAV compares its own window
  // coordinates against the keyboard's screen coordinates, which differ by
  // the status bar on Android — add StatusBar.currentHeight to compensate
  // (a slight overshoot only leaves a small gap above the keyboard).
  const containerRef = useRef<View>(null);
  const [kavOffset, setKavOffset] = useState(0);
  const handleContainerLayout = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y) => {
      const statusBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
      setKavOffset(y + statusBar);
    });
  }, []);

  return (
    <View
      ref={containerRef}
      onLayout={handleContainerLayout}
      collapsable={false}
      className="flex-1"
      // Web: keep some breathing room between the input bar and the viewport edge.
      style={Platform.OS === 'web' ? { paddingBottom: 16 } : undefined}
    >
    <KeyboardAvoidingView
      className="flex-1"
      behavior="padding"
      keyboardVerticalOffset={kavOffset}
    >
    {/* Web: cap the chat width (~2/3 of a desktop viewport) for readability. */}
    <View
      className="flex-1 w-full self-center"
      style={Platform.OS === 'web' ? { maxWidth: 960 } : undefined}
    >
      {ux.showSkeleton ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : ux.showOfflineEmpty ? (
        <OfflineEmptyState onRetry={refetch} />
      ) : (
        <FlashList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            messages.length === 0 ? { flex: 1 } : { paddingVertical: 8 }
          }
          maintainVisibleContentPosition={{
            autoscrollToBottomThreshold: 0.2,
            startRenderingFromBottom: true,
          }}
          onStartReached={handleLoadOlder}
          onStartReachedThreshold={0.2}
          ListHeaderComponent={
            isFetchingNextPage ? (
              <View className="py-sm">
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center">
              <EmptyState
                icon="chatbubbles-outline"
                title={t('emptyTitle')}
                subtitle={t('emptySubtitle')}
              />
            </View>
          }
          renderItem={({ item }) => (
            <ChatMessageRow
              message={item}
              isOwn={canEditMessage(item)}
              canDelete={canDeleteMessage(item)}
              onLongPress={setActionMessage}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={ux.refreshing}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      <ChatInputBar
        onSend={handleSend}
        onSaveEdit={handleSaveEdit}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        isPending={
          editingMessage ? isMutationBusy(updateMessage) : isMutationBusy(createMessage)
        }
      />
    </View>

      <MessageActionsSheet
        message={actionMessage}
        canEdit={actionMessage ? canEditMessage(actionMessage) : false}
        canDelete={actionMessage ? canDeleteMessage(actionMessage) : false}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onClose={() => setActionMessage(null)}
        isDeletePending={isMutationBusy(deleteMessage)}
      />
    </KeyboardAvoidingView>
    </View>
  );
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useSignOut } from '../../src/features/auth/hooks/useSignOut';
import { useUpdateProfile } from '../../src/features/profile/hooks/useUpdateProfile';
import { useTravelDocuments } from '../../src/features/profile/hooks/useTravelDocuments';
import { useUpsertTravelDocument } from '../../src/features/profile/hooks/useUpsertTravelDocument';
import { useDeleteTravelDocument } from '../../src/features/profile/hooks/useDeleteTravelDocument';
import { usePendingAccessRequests, useRespondToAccessRequest, useActiveGrants, useRevokeDocumentAccess } from '../../src/features/profile/hooks/useDocumentAccessRequests';
import { EditProfileSheet } from '../../src/features/profile/components/EditProfileSheet';
import { TravelDocumentCard } from '../../src/features/profile/components/TravelDocumentCard';
import { AddTravelDocumentSheet } from '../../src/features/profile/components/AddTravelDocumentSheet';
import { EditTravelDocumentSheet } from '../../src/features/profile/components/EditTravelDocumentSheet';
import { BiometricGate } from '../../src/features/profile/components/BiometricGate';
import { DocumentAccessRequestBanner } from '../../src/features/profile/components/DocumentAccessRequestBanner';
import { ActiveGrantsBanner } from '../../src/features/profile/components/ActiveGrantsBanner';
import { MemberAvatar } from '../../src/features/trips/components/MemberAvatar';
import type { TravelDocument, UpsertTravelDocumentInput } from '@vacationist/types';
import { isGuest } from '@vacationist/types';
import { colors } from '@vacationist/ui';
import { GuestUpgradeBanner } from '../../src/features/profile/components/GuestUpgradeBanner';
import { GuestUpgradeSheet } from '../../src/features/profile/components/GuestUpgradeSheet';
import { useThemeStore } from '../../src/stores/themeStore';

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);

  const [docsUnlocked, setDocsUnlocked] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [addDocVisible, setAddDocVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState<TravelDocument | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);

  // Lock documents when the app moves to the background.
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current === 'active' &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        setDocsUnlocked(false);
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // Reset the inline sign-out confirmation when the tab loses focus so it
  // doesn't persist stale UI state when the user switches tabs and comes back.
  useFocusEffect(
    useCallback(() => {
      return () => setConfirmSignOut(false);
    }, [])
  );

  const { handleSignOut } = useSignOut();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const updateProfile = useUpdateProfile();
  const { data: documents = [], isLoading: docsLoading } = useTravelDocuments(docsUnlocked);
  const upsertDoc = useUpsertTravelDocument();
  const deleteDoc = useDeleteTravelDocument();
  const { data: pendingRequests = [] } = usePendingAccessRequests();
  const respondToRequest = useRespondToAccessRequest();
  const { data: activeGrants = [] } = useActiveGrants();
  const revokeAccess = useRevokeDocumentAccess();

  if (!user) return null;

  const existingTypes = documents.map((d) => d.document_type);
  const canAddMore = existingTypes.length < 2;

  function handleUpsert(input: UpsertTravelDocumentInput) {
    upsertDoc.mutate(input, {
      onSuccess: () => {
        setAddDocVisible(false);
        setEditingDoc(null);
      },
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center gap-sm pt-md">
          <MemberAvatar name={user.name} avatarUrl={user.avatar_url} size="lg" />
          <Text className="text-heading-l text-text-primary font-semibold">{user.name}</Text>
          {user.email && (
            <Text className="text-body text-text-secondary">{user.email}</Text>
          )}
          <View className="flex-row gap-xs">
            <View className="bg-surface border border-border rounded-full px-sm py-xs">
              <Text className="text-label text-text-muted">{user.locale}</Text>
            </View>
            <View className="bg-surface border border-border rounded-full px-sm py-xs">
              <Text className="text-label text-text-muted">
                {user.timezone.replace('Europe/', '')}
              </Text>
            </View>
          </View>
        </View>

        {/* Guest upgrade banner */}
        {isGuest(user) && (
          <GuestUpgradeBanner onPress={() => setUpgradeSheetVisible(true)} />
        )}

        {/* Edit profile */}
        <Pressable
          onPress={() => setEditProfileVisible(true)}
          className="flex-row items-center justify-between bg-surface border border-border rounded-md px-md min-h-[48px]"
        >
          <Text className="text-body text-text-primary">Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color="#5C5C5C" />
        </Pressable>

        {/* Pending access request banner */}
        {pendingRequests.length > 0 && (
          <DocumentAccessRequestBanner
            requests={pendingRequests}
            onGrant={(requestId) => respondToRequest.mutate({ requestId, granted: true })}
            onDeny={(requestId) => respondToRequest.mutate({ requestId, granted: false })}
            isPending={respondToRequest.isPending}
          />
        )}

        {/* Active grants banner — lets the user see and revoke what they have shared */}
        <ActiveGrantsBanner
          grants={activeGrants}
          onRevoke={(requestId) => revokeAccess.mutate(requestId)}
          isRevoking={revokeAccess.isPending}
        />

        {/* Travel documents */}
        <View className="gap-sm">
          <Text className="text-label text-text-muted uppercase">Travel Documents</Text>
          <Text className="text-body-small text-text-muted">
            Stored securely with end-to-end encryption. Only visible to you unless you grant access.
          </Text>

          <BiometricGate onUnlocked={() => setDocsUnlocked(true)} unlocked={docsUnlocked}>
            {docsLoading ? (
              <View className="py-lg items-center">
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View className="gap-sm">
                {documents.map((doc) => (
                  <TravelDocumentCard
                    key={doc.id}
                    document={doc}
                    onEdit={() => setEditingDoc(doc)}
                    onDelete={() => deleteDoc.mutate(doc.id)}
                    isDeleting={deleteDoc.isPending}
                  />
                ))}

                {canAddMore && (
                  <Pressable
                    onPress={() => setAddDocVisible(true)}
                    className="flex-row items-center justify-center gap-sm min-h-[48px] rounded-md border border-dashed border-border"
                  >
                    <Ionicons name="add" size={18} color={colors.primary} />
                    <Text className="text-body text-primary font-medium">
                      Add {existingTypes.includes('passport') ? 'ID Card' : 'Document'}
                    </Text>
                  </Pressable>
                )}

                {documents.length === 0 && (
                  <Text className="text-body-small text-text-muted text-center py-sm">
                    No documents added yet
                  </Text>
                )}
              </View>
            )}
          </BiometricGate>
        </View>
        {/* Theme */}
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">Appearance</Text>
          <View className="flex-row bg-surface border border-border rounded-md p-xs gap-xs">
            {(['light', 'system', 'dark'] as const).map((option) => {
              const labels = { light: 'Light', system: 'System', dark: 'Dark' };
              const icons = { light: 'sunny-outline', system: 'phone-portrait-outline', dark: 'moon-outline' } as const;
              const active = theme === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setTheme(option)}
                  style={({ pressed }) => ({
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: active ? colors.primary : 'transparent',
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Ionicons name={icons[option]} size={14} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={{ fontSize: 13, fontWeight: active ? '600' : '400', color: active ? '#fff' : colors.textSecondary }}>
                    {labels[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sign out */}
        {confirmSignOut ? (
          <View className="flex-row gap-sm">
            <TouchableOpacity
              onPress={() => setConfirmSignOut(false)}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#2E2E2E', alignItems: 'center', justifyContent: 'center' }}
            >
              <Text className="text-body text-text-secondary">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSignOut}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FF5C5C', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,92,92,0.1)' }}
            >
              <Text className="text-body text-danger font-semibold">Confirm</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setConfirmSignOut(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FF5C5C' }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text className="text-body text-danger font-semibold">Sign Out</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <EditProfileSheet
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
        onSubmit={(input) =>
          updateProfile.mutate(input, { onSuccess: () => setEditProfileVisible(false) })
        }
        isPending={updateProfile.isPending}
        user={user}
      />

      <GuestUpgradeSheet
        visible={upgradeSheetVisible}
        onClose={() => setUpgradeSheetVisible(false)}
      />

      <AddTravelDocumentSheet
        visible={addDocVisible}
        onClose={() => setAddDocVisible(false)}
        onSubmit={handleUpsert}
        isPending={upsertDoc.isPending}
        existingTypes={existingTypes}
      />

      {editingDoc && (
        <EditTravelDocumentSheet
          visible={!!editingDoc}
          onClose={() => setEditingDoc(null)}
          onSubmit={handleUpsert}
          isPending={upsertDoc.isPending}
          document={editingDoc}
        />
      )}
    </SafeAreaView>
  );
}

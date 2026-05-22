import { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator, AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useToastStore } from '../../src/stores/toastStore';
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

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const addToast = useToastStore((s) => s.addToast);

  const [docsUnlocked, setDocsUnlocked] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [addDocVisible, setAddDocVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState<TravelDocument | null>(null);

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

  const { handleSignOut, loading: signingOut } = useSignOut((msg) => addToast('error', msg));
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

  function handleSignOutPress() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: handleSignOut,
      },
    ]);
  }

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
                <ActivityIndicator color="#6C63FF" />
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
                    <Ionicons name="add" size={18} color="#6C63FF" />
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

        {/* Sign out */}
        <Pressable
          onPress={handleSignOutPress}
          disabled={signingOut}
          className="flex-row items-center justify-center gap-sm min-h-[48px] rounded-md border border-danger"
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#FF5C5C" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#FF5C5C" />
              <Text className="text-body text-danger font-semibold">Sign Out</Text>
            </>
          )}
        </Pressable>
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

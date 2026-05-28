import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, View, Text, ScrollView, Pressable, TouchableOpacity, ActivityIndicator, AppState, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AppStateStatus } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar, updateUserProfile } from '@vacationist/api';
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
import { colors, useThemeColors } from '@vacationist/ui';
import { GuestUpgradeBanner } from '../../src/features/profile/components/GuestUpgradeBanner';
import { GuestUpgradeSheet } from '../../src/features/profile/components/GuestUpgradeSheet';
import { useThemeStore } from '../../src/stores/themeStore';

function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    Linking.openURL(url);
  }
}

export default function ProfileScreen() {
  const { t } = useTranslation('profile');
  const { t: tCommon } = useTranslation("common");
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [docsUnlocked, setDocsUnlocked] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [addDocVisible, setAddDocVisible] = useState(false);
  const [editingDoc, setEditingDoc] = useState<TravelDocument | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [upgradeSheetVisible, setUpgradeSheetVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
  const tc = useThemeColors();
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

  async function handleAvatarChange() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('avatar.permissionTitle'), t('avatar.permissionBody'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      Alert.alert(t('avatar.tooLargeTitle'), t('avatar.tooLargeBody'));
      return;
    }

    setAvatarUploading(true);
    try {
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const publicUrl = await uploadAvatar(user!.id, arrayBuffer, mimeType);
      const updated = await updateUserProfile(user!.id, { avatar_url: publicUrl });
      setUser(updated);
    } catch {
      Alert.alert(t('avatar.uploadFailedTitle'), t('avatar.uploadFailedBody'));
    } finally {
      setAvatarUploading(false);
    }
  }

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
          <Pressable
            onPress={handleAvatarChange}
            disabled={avatarUploading}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <View style={{ position: 'relative' }}>
              <MemberAvatar name={user.name} avatarUrl={user.avatar_url} size="lg" />
              <View
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {avatarUploading ? (
                  <ActivityIndicator size={10} color="#fff" />
                ) : (
                  <Ionicons name="camera" size={12} color="#fff" />
                )}
              </View>
            </View>
          </Pressable>
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
          <Text className="text-body text-text-primary">{t('edit.title')}</Text>
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
          <Text className="text-label text-text-muted uppercase">{t('section.travelDocuments')}</Text>
          <Text className="text-body-small text-text-muted">
            {t('section.travelDocsSubtitle')}
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
                      {existingTypes.includes('passport') ? t('section.addIdCard') : t('section.addPassport')}
                    </Text>
                  </Pressable>
                )}

                {documents.length === 0 && (
                  <Text className="text-body-small text-text-muted text-center py-sm">
                    {t('section.noDocuments')}
                  </Text>
                )}
              </View>
            )}
          </BiometricGate>
        </View>
        {/* Theme */}
        <View>
          <Text className="text-label text-text-muted uppercase mb-sm">{t('section.appearance')}</Text>
          <View className="flex-row bg-surface border border-border rounded-md p-xs gap-xs">
            {(['light', 'system', 'dark'] as const).map((option) => {
              const labels = { light: t('appearance.light'), system: t('appearance.system'), dark: t('appearance.dark') };
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
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: tc.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text className="text-body text-text-secondary">{tCommon('button.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSignOut}
              style={{ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FF5C5C', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,92,92,0.1)' }}
            >
              <Text className="text-body text-danger font-semibold">{tCommon('button.confirm')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setConfirmSignOut(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#FF5C5C' }}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <Text className="text-body text-danger font-semibold">{t('signOut')}</Text>
          </TouchableOpacity>
        )}
        {/* Legal */}
        <View className="flex-row justify-center flex-wrap gap-xs pb-xs">
          <Pressable onPress={() => openUrl('https://vacationist.app/privacy-policy.html')}>
            <Text className="text-body-small text-text-muted">{t('footer.privacy')}</Text>
          </Pressable>
          <Text className="text-body-small text-text-muted">·</Text>
          <Pressable onPress={() => openUrl('https://vacationist.app/terms-of-service.html')}>
            <Text className="text-body-small text-text-muted">{t('footer.terms')}</Text>
          </Pressable>
          <Text className="text-body-small text-text-muted">·</Text>
          <Pressable onPress={() => openUrl('https://vacationist.app/impressum.html')}>
            <Text className="text-body-small text-text-muted">{t('footer.impressum')}</Text>
          </Pressable>
        </View>
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

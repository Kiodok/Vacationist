import { useMutation } from '@tanstack/react-query';
import { updateUserProfile } from '@vacationist/api';
import type { UpdateProfileInput, SupportedLocale } from '@vacationist/types';
import { i18n, persistLocale, SUPPORTED_LOCALES } from '@vacationist/i18n';
import { useAuthStore } from '../../../stores/authStore';
import { useToastStore } from '../../../stores/toastStore';

export function useUpdateProfile() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => {
      if (!user) throw new Error('Not authenticated');
      return updateUserProfile(user.id, input);
    },
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      // Persist locale only after the server confirms the save.
      // Runtime membership check guards against pre-constraint DB rows with
      // unsupported locale strings reaching persistLocale.
      // persistLocale propagates to dayjs + formatCurrency via the registered callback.
      if (updatedUser.locale && (SUPPORTED_LOCALES as readonly string[]).includes(updatedUser.locale)) {
        persistLocale(updatedUser.locale as SupportedLocale);
      }
      addToast('success', i18n.t('profile:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('profile:toast.updateFailed'));
    },
  });
}

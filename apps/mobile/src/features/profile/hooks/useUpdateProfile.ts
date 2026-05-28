import { useMutation } from '@tanstack/react-query';
import { updateUserProfile } from '@vacationist/api';
import type { UpdateProfileInput } from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
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
      addToast('success', i18n.t('profile:toast.updated'));
    },
    onError: () => {
      addToast('error', i18n.t('profile:toast.updateFailed'));
    },
  });
}

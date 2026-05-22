import { useMutation } from '@tanstack/react-query';
import { updateUserProfile } from '@vacationist/api';
import type { UpdateProfileInput } from '@vacationist/types';
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
      addToast('success', 'Profile updated');
    },
    onError: () => {
      addToast('error', 'Failed to update profile.');
    },
  });
}

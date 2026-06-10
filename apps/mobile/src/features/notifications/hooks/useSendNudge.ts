import { useMutation } from '@tanstack/react-query';
import { sendOrganizerNudge } from '@vacationist/api';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useSendNudge(tripId: string) {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) =>
      sendOrganizerNudge(tripId, title, body),
    onSuccess: () => {
      addToast('success', i18n.t('notifications:toast.nudgeSent'));
    },
    onError: (error: Error) => {
      console.error('[useSendNudge]', error.message, error);
      const isRateLimit = error.message?.includes('Rate limit');
      addToast('error', isRateLimit ? i18n.t('notifications:toast.nudgeRateLimited') : i18n.t('notifications:toast.nudgeFailed'));
    },
  });
}

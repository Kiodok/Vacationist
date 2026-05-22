import { useMutation } from '@tanstack/react-query';
import { sendOrganizerNudge } from '@vacationist/api';
import { useToastStore } from '../../../stores/toastStore';

export function useSendNudge(tripId: string) {
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationFn: ({ title, body }: { title: string; body: string }) =>
      sendOrganizerNudge(tripId, title, body),
    onSuccess: () => {
      addToast('success', 'Nudge sent!');
    },
    onError: (error: Error) => {
      const isRateLimit = error.message?.includes('Rate limit');
      addToast('error', isRateLimit ? 'Too many nudges — max 3 per hour.' : 'Failed to send nudge.');
    },
  });
}

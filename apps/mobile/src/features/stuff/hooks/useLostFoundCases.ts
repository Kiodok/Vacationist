import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLostFoundCases,
  createLostFoundCase,
  updateLostFoundCase,
  resolveLostFoundCase,
  unresolveLostFoundCase,
  deleteLostFoundCase,
} from '@vacationist/api';
import type {
  LostFoundCase,
  CreateLostFoundCaseVariables,
  UpdateLostFoundCaseVariables,
  ResolveLostFoundCaseVariables,
  UnresolveLostFoundCaseVariables,
  DeleteLostFoundCaseVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { useToastStore } from '../../../stores/toastStore';

export function useLostFoundCases(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'lost-found'],
    queryFn: () => getLostFoundCases(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}

export function useCreateLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['createLostFoundCase', tripId],
    mutationFn: ({ input }: CreateLostFoundCaseVariables) => createLostFoundCase(tripId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
      addToast('success', i18n.t('stuff:toast.caseCreated'));
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.caseFailed'));
    },
  });
}

export function useUpdateLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['updateLostFoundCase', tripId],
    mutationFn: ({ caseId, input }: UpdateLostFoundCaseVariables) => updateLostFoundCase(caseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'lost-found'] });
      addToast('success', i18n.t('stuff:toast.caseUpdated'));
    },
    onError: () => {
      addToast('error', i18n.t('stuff:toast.caseUpdateFailed'));
    },
  });
}

export function useResolveLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['resolveLostFoundCase', tripId],
    mutationFn: ({ caseId }: ResolveLostFoundCaseVariables) => resolveLostFoundCase(caseId),
    onMutate: async ({ caseId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'lost-found'] });
      const previous = queryClient.getQueryData<LostFoundCase[]>(['trips', tripId, 'lost-found']);
      queryClient.setQueryData<LostFoundCase[]>(
        ['trips', tripId, 'lost-found'],
        (old) => old?.map((c) => c.id === caseId ? { ...c, is_resolved: true, resolved_at: new Date().toISOString() } : c),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'lost-found'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.resolveFailed'));
    },
    onSuccess: () => {
      addToast('success', i18n.t('stuff:toast.caseResolved'));
    },
  });
}

export function useUnresolveLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['unresolveLostFoundCase', tripId],
    mutationFn: ({ caseId }: UnresolveLostFoundCaseVariables) => unresolveLostFoundCase(caseId),
    onMutate: async ({ caseId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'lost-found'] });
      const previous = queryClient.getQueryData<LostFoundCase[]>(['trips', tripId, 'lost-found']);
      queryClient.setQueryData<LostFoundCase[]>(
        ['trips', tripId, 'lost-found'],
        (old) => old?.map((c) => c.id === caseId ? { ...c, is_resolved: false, resolved_at: null } : c),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'lost-found'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.unresolveFailed'));
    },
    onSuccess: () => {
      addToast('success', i18n.t('stuff:toast.caseUnresolved'));
    },
  });
}

export function useDeleteLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation({
    mutationKey: ['deleteLostFoundCase', tripId],
    mutationFn: ({ caseId }: DeleteLostFoundCaseVariables) => deleteLostFoundCase(caseId),
    onMutate: async ({ caseId }) => {
      await queryClient.cancelQueries({ queryKey: ['trips', tripId, 'lost-found'] });
      const previous = queryClient.getQueryData<LostFoundCase[]>(['trips', tripId, 'lost-found']);
      queryClient.setQueryData<LostFoundCase[]>(
        ['trips', tripId, 'lost-found'],
        (old) => old?.filter((c) => c.id !== caseId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['trips', tripId, 'lost-found'], context.previous);
      }
      addToast('error', i18n.t('stuff:toast.deleteFailed'));
    },
  });
}

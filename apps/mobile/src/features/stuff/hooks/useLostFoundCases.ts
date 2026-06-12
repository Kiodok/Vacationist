import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLostFoundCases } from '@vacationist/api';
import type {
  LostFoundCase,
  CreateLostFoundCaseVariables,
  UpdateLostFoundCaseVariables,
  ResolveLostFoundCaseVariables,
  UnresolveLostFoundCaseVariables,
  DeleteLostFoundCaseVariables,
} from '@vacationist/types';
import { i18n } from '@vacationist/i18n';
import { createOptimisticId } from '../../../utils/optimisticId';
import { useToastStore } from '../../../stores/toastStore';
import { useAuthStore } from '../../../stores/authStore';

export function useLostFoundCases(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'lost-found'],
    queryFn: () => getLostFoundCases(tripId),
    retry: 2,
    enabled: !!tripId,
    refetchInterval: 30_000,
  });
}

// mutationFn + onSuccess (invalidation + toast) live in mutationDefaults so
// persisted mutations replay correctly after a cold start. Hooks keep
// onMutate (optimistic update) and onError (rollback + toast).

type CasesContext = { previous: LostFoundCase[] | undefined };

function casesKey(tripId: string) {
  return ['trips', tripId, 'lost-found'] as const;
}

export function useCreateLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<LostFoundCase, Error, CreateLostFoundCaseVariables, CasesContext>({
    mutationKey: ['createLostFoundCase', tripId],
    onMutate: async ({ tripId: tid, input }) => {
      await queryClient.cancelQueries({ queryKey: casesKey(tid) });
      const previous = queryClient.getQueryData<LostFoundCase[]>(casesKey(tid));

      const now = new Date().toISOString();
      const optimistic: LostFoundCase = {
        id: createOptimisticId(),
        trip_id: tid,
        case_type: input.case_type,
        title: input.title,
        description: input.description ?? null,
        created_by: useAuthStore.getState().user?.id ?? '',
        target_user: input.target_user ?? null,
        is_resolved: false,
        resolved_at: null,
        created_at: now,
        updated_at: now,
      };
      queryClient.setQueryData<LostFoundCase[]>(casesKey(tid), (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(casesKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.caseFailed'));
    },
  });
}

export function useUpdateLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<LostFoundCase, Error, UpdateLostFoundCaseVariables, CasesContext>({
    mutationKey: ['updateLostFoundCase', tripId],
    onMutate: async ({ caseId, tripId: tid, input }) => {
      await queryClient.cancelQueries({ queryKey: casesKey(tid) });
      const previous = queryClient.getQueryData<LostFoundCase[]>(casesKey(tid));
      queryClient.setQueryData<LostFoundCase[]>(
        casesKey(tid),
        (old) => old?.map((c) => (c.id === caseId ? { ...c, ...input } : c)),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(casesKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.caseUpdateFailed'));
    },
  });
}

export function useResolveLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, ResolveLostFoundCaseVariables, CasesContext>({
    mutationKey: ['resolveLostFoundCase', tripId],
    onMutate: async ({ caseId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: casesKey(tid) });
      const previous = queryClient.getQueryData<LostFoundCase[]>(casesKey(tid));
      queryClient.setQueryData<LostFoundCase[]>(
        casesKey(tid),
        (old) => old?.map((c) => c.id === caseId ? { ...c, is_resolved: true, resolved_at: new Date().toISOString() } : c),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(casesKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.resolveFailed'));
    },
  });
}

export function useUnresolveLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, UnresolveLostFoundCaseVariables, CasesContext>({
    mutationKey: ['unresolveLostFoundCase', tripId],
    onMutate: async ({ caseId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: casesKey(tid) });
      const previous = queryClient.getQueryData<LostFoundCase[]>(casesKey(tid));
      queryClient.setQueryData<LostFoundCase[]>(
        casesKey(tid),
        (old) => old?.map((c) => c.id === caseId ? { ...c, is_resolved: false, resolved_at: null } : c),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(casesKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.unresolveFailed'));
    },
  });
}

export function useDeleteLostFoundCase(tripId: string) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useMutation<void, Error, DeleteLostFoundCaseVariables, CasesContext>({
    mutationKey: ['deleteLostFoundCase', tripId],
    onMutate: async ({ caseId, tripId: tid }) => {
      await queryClient.cancelQueries({ queryKey: casesKey(tid) });
      const previous = queryClient.getQueryData<LostFoundCase[]>(casesKey(tid));
      queryClient.setQueryData<LostFoundCase[]>(
        casesKey(tid),
        (old) => old?.filter((c) => c.id !== caseId),
      );
      return { previous };
    },
    onError: (_err, { tripId: tid }, context) => {
      if (context !== undefined) {
        queryClient.setQueryData(casesKey(tid), context.previous);
      }
      addToast('error', i18n.t('stuff:toast.deleteFailed'));
    },
  });
}

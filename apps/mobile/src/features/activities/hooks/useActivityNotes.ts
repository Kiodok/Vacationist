import { getActivityNotes, createActivityNote, updateActivityNote, deleteActivityNote } from '@vacationist/api';
import type { ActivityNote } from '@vacationist/types';
import { createNoteHooks } from '../../../hooks/createNoteHooks';

const hooks = createNoteHooks<ActivityNote>({
  parentKey: 'activities',
  namespace: 'activityNotes',
  api: {
    get: getActivityNotes,
    create: createActivityNote,
    update: updateActivityNote,
    remove: deleteActivityNote,
  },
});

export const useActivityNotes = hooks.useNotes;
export const useCreateActivityNote = hooks.useCreateNote;
export const useUpdateActivityNote = hooks.useUpdateNote;
export const useDeleteActivityNote = hooks.useDeleteNote;

import { getAccommodationNotes, createAccommodationNote, updateAccommodationNote, deleteAccommodationNote } from '@vacationist/api';
import type { AccommodationNote } from '@vacationist/types';
import { createNoteHooks } from '../../../hooks/createNoteHooks';

const hooks = createNoteHooks<AccommodationNote>({
  parentKey: 'accommodations',
  namespace: 'accommodationNotes',
  api: {
    get: getAccommodationNotes,
    create: createAccommodationNote,
    update: updateAccommodationNote,
    remove: deleteAccommodationNote,
  },
});

export const useAccommodationNotes = hooks.useNotes;
export const useCreateAccommodationNote = hooks.useCreateNote;
export const useUpdateAccommodationNote = hooks.useUpdateNote;
export const useDeleteAccommodationNote = hooks.useDeleteNote;

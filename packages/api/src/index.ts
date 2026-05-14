export { supabase } from './client';
export type { Database } from './database.types';

export {
  getGoogleOAuthUrl,
  signInWithMagicLink,
  signInAnonymously,
  setSessionFromUrl,
  signInWithGoogleIdToken,
  signOut,
  getSession,
  onAuthStateChange,
} from './auth';

export { getUserProfile, ensureUserProfile, updateUserProfile } from './users';

export { getTrips, getTrip, createTrip, updateTrip, softDeleteTrip, TripNotFoundError } from './trips';

export { getTripMembers, removeTripMember, leaveTrip, updateMemberRole, getCurrentMemberRole } from './members';
export type { TripMemberWithUser } from './members';

export { createInviteToken, getActiveInvites, revokeInvite, redeemInviteToken } from './invites';

export {
  getActivities,
  getActivity,
  createActivity,
  updateActivity,
  softDeleteActivity,
  closeActivityVoting,
  reopenActivityVoting,
  getActivityVotes,
  castActivityVote,
  removeActivityVote,
} from './activities';

export {
  getAccommodations,
  getAccommodation,
  createAccommodation,
  updateAccommodation,
  softDeleteAccommodation,
  closeAccommodationVoting,
  reopenAccommodationVoting,
  getAccommodationVotes,
  castAccommodationVote,
  removeAccommodationVote,
} from './accommodations';

export {
  getExpenses,
  createExpense,
  updateExpenseWithSplits,
  archiveExpense,
  getExpenseSplits,
  getTripBalances,
  settleExpenseSplit,
  unsettleExpenseSplit,
} from './expenses';

export {
  getShoppingLists,
  createShoppingList,
  updateShoppingList,
  archiveShoppingList,
  unarchiveShoppingList,
  deleteShoppingList,
  getShoppingItems,
  createShoppingItem,
  updateShoppingItem,
  softDeleteShoppingItem,
  subscribeToShoppingItems,
  unsubscribeFromShoppingItems,
} from './shopping';
export type { ShoppingRealtimeCallbacks } from './shopping';

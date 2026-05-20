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
  subscribeToActivityVotingRealtime,
  unsubscribeFromActivityVoting,
  getActivitiesForTrips,
  subscribeToCalendarActivitiesRealtime,
  unsubscribeFromCalendarActivities,
} from './activities';
export type { ActivityVotingRealtimeCallbacks, CalendarActivityRealtimeCallbacks } from './activities';

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
  subscribeToAccommodationVotingRealtime,
  unsubscribeFromAccommodationVoting,
} from './accommodations';
export type { AccommodationVotingRealtimeCallbacks } from './accommodations';

export {
  getExpenses,
  createExpense,
  updateExpenseWithSplits,
  archiveExpense,
  unarchiveExpense,
  getExpenseSplits,
  getTripBalances,
  settleExpenseSplit,
  unsettleExpenseSplit,
  subscribeToExpensesRealtime,
  unsubscribeFromExpenses,
} from './expenses';
export type { ExpenseRealtimeCallbacks } from './expenses';

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
  subscribeToShoppingItemChanges,
  unsubscribeFromShoppingItems,
  subscribeToShoppingSync,
  broadcastShoppingItemsRemoved,
} from './shopping';
export type { ShoppingRealtimeCallbacks } from './shopping';

export {
  getRecipes,
  getRecipe,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  addIngredient,
  updateIngredient,
  deleteIngredient,
  getRecipeShoppingStatus,
  addRecipeToShoppingList,
  subscribeToRecipesRealtime,
  unsubscribeFromRecipes,
  subscribeToIngredientsRealtime,
  unsubscribeFromIngredients,
} from './recipes';
export type { RecipeRealtimeCallbacks, IngredientRealtimeCallbacks, RecipeShoppingListInfo } from './recipes';

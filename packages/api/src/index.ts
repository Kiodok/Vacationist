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

export { getTrips, getTrip, createTrip, updateTrip, softDeleteTrip, TripNotFoundError, subscribeToTripRealtime, unsubscribeFromTrip } from './trips';
export type { TripRealtimeCallbacks } from './trips';

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
  getActivityVotesBatch,
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
  getAllShoppingItemsForTrip,
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

export {
  getPreworkPreferences,
  getMyPreworkPreferences,
  upsertPreworkPreferences,
  deletePreworkPreferences,
  subscribeToPreworkRealtime,
  unsubscribeFromPrework,
} from './prework';
export type { PreworkRealtimeCallbacks } from './prework';

export {
  getTransferFlights,
  getTransferFlight,
  createTransferFlight,
  updateTransferFlight,
  softDeleteTransferFlight,
  closeTransferFlightVoting,
  reopenTransferFlightVoting,
  bookTransferFlight,
  getTransferFlightVotes,
  getTransferFlightVotesBatch,
  castTransferFlightVote,
  removeTransferFlightVote,
  getTransferFlightPassengers,
  setTransferFlightPassengers,
  subscribeToFlightVotingRealtime,
  unsubscribeFromFlightVoting,
} from './transferFlights';
export type { FlightVotingRealtimeCallbacks } from './transferFlights';

export {
  getTransferVehicles,
  createTransferVehicle,
  updateTransferVehicle,
  softDeleteTransferVehicle,
  getTransferVehiclePassengers,
  addTransferVehiclePassenger,
  removeTransferVehiclePassenger,
  updateTransferVehiclePassenger,
  subscribeToVehicleRealtime,
  unsubscribeFromVehicleRealtime,
} from './transferVehicles';
export type { VehicleRealtimeCallbacks } from './transferVehicles';

export {
  getTransferRentals,
  createTransferRental,
  updateTransferRental,
  softDeleteTransferRental,
  subscribeToRentalRealtime,
  unsubscribeFromRentalRealtime,
} from './transferRentals';
export type { RentalRealtimeCallbacks } from './transferRentals';

export { getNotes, createNote, updateNote, deleteNote } from './notes';

export {
  getMyTravelDocuments,
  upsertTravelDocument,
  deleteTravelDocument,
  createDocumentAccessRequest,
  respondToDocumentAccessRequest,
  getMyPendingAccessRequests,
  getAccessibleMemberDocuments,
  revokeDocumentAccess,
  getMyActiveGrants,
} from './travelDocuments';

export { supabase } from './client';
export type { Database } from './database.types';

export {
  getGoogleOAuthUrl,
  signInWithMagicLink,
  signInAnonymously,
  setSessionFromUrl,
  signOut,
  getSession,
  onAuthStateChange,
} from './auth';

export { getUserProfile, updateUserProfile } from './users';

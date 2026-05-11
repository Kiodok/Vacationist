import type { User } from './database';

export interface AuthenticatedUser extends User {
  is_guest: false;
  email: string;
}

export interface GuestUser extends User {
  is_guest: true;
}

export type AppUser = AuthenticatedUser | GuestUser;

export function isGuest(user: User): user is GuestUser {
  return user.is_guest;
}

export function isAuthenticated(user: User): user is AuthenticatedUser {
  return !user.is_guest && user.email !== null;
}

import { createContext } from 'react';

/* ------------------------------------------------------------------ */
/*  User object returned by GET /users/me                              */
/* ------------------------------------------------------------------ */
export interface GoogleAccountLite {
  email: string;
}

export interface User {
  id: string;
  name: string;
  email: string;                   // registration email
  activeGoogleAccount?: GoogleAccountLite | null; // new
}

/* ------------------------------------------------------------------ */
/*  AuthContext shape                                                 */
/* ------------------------------------------------------------------ */
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  signup(name: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  The actual context                                                */
/* ------------------------------------------------------------------ */
export const AuthContext =
  createContext<AuthContextType | undefined>(undefined);

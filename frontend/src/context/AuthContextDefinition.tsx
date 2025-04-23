import { createContext } from 'react';

// Define the shape of the user object
export interface User {
  id: string;
  name: string; 
  email: string; // This is the registration email
  isGmailConnected?: boolean | null; 
  googleEmail?: string | null; 
}

// Define the shape of the context value
export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create and export the context object itself
// Default value is undefined, components must check context availability
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
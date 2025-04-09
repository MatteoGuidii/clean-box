import React, { createContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

// Define the shape of the user object (adjust if your /me returns more/less)
interface User {
  id: string;
  email: string;
}

// Define the shape of the context value (Exported for the hook)
export interface AuthContextType {
  user: User | null;
  isLoading: boolean; // For initial auth check
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Create the context (Exported for the hook)
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// --- AuthProvider Component --- (This is the main export of this file)
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Loading until initial check done
  const navigate = useNavigate();

  // Check auth status on initial load and after login
  const checkAuthStatus = useCallback(async () => {
    console.log('[AuthContext] Checking auth status...');
    // Keep loading true if it wasn't already false from a previous check
    if (!isLoading) setIsLoading(true);
    try {
      const response = await fetch('/api/v1/users/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Crucial
      });
      if (response.ok) {
        const userData: User = await response.json();
        console.log('[AuthContext] Auth check successful:', userData);
        setUser(userData);
      } else {
        console.log('[AuthContext] Auth check failed:', response.status);
        setUser(null);
      }
    } catch (error) {
      console.error('[AuthContext] Error during auth check:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext] Auth check finished. Loading:', false);
    }
  }, [isLoading]); // Dependency ensures it can re-trigger loading state if needed

  // Run initial auth check on mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally run only once on mount

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] Attempting login...');
    try {
      const response = await fetch('/api/v1/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include', // Crucial
      });
      if (!response.ok) {
        let message = `Login failed (status: ${response.status})`;
        try { const data = await response.json(); message = data?.message || message; } catch (error) { console.error('[AuthContext] Error parsing response JSON:', error); }
        throw new Error(message);
      }
      // Successful login - cookie set by browser. Fetch user data to update state.
      console.log('[AuthContext] Login API call successful. Fetching user data...');
      await checkAuthStatus(); // Update user state
      console.log('[AuthContext] Navigating to dashboard...');
      navigate('/dashboard'); // Navigate after state update is initiated
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      setUser(null); // Clear user state on error
      throw error; // Re-throw for component to handle UI feedback
    }
  }, [navigate, checkAuthStatus]);

  // Signup function
  const signup = useCallback(async (email: string, password: string) => {
    console.log('[AuthContext] Attempting signup...');
    try {
      const response = await fetch('/api/v1/users/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        let message = `Signup failed (status: ${response.status})`;
        try { const data = await response.json(); message = data?.message || message; } catch (error) { console.error('[AuthContext] Error parsing response JSON:', error); }
        throw new Error(message);
      }
      // Signup successful
      console.log('[AuthContext] Signup successful. Navigating to login.');
      alert('Sign up successful! Please log in.'); // Consider replacing alert later
      navigate('/login');
    } catch (error) {
      console.error('[AuthContext] Signup error:', error);
      throw error; // Re-throw for component
    }
  }, [navigate]);

  // Logout function
  const logout = useCallback(async () => {
    console.log('[AuthContext] Attempting logout...');
    try {
      await fetch('/api/v1/users/logout', {
        method: 'POST',
        credentials: 'include', // Crucial
      });
      console.log('[AuthContext] Logout API call finished.');
    } catch (error) {
      console.error('[AuthContext] Logout API error:', error);
      // Proceed with client-side logout anyway
    } finally {
      console.log('[AuthContext] Clearing user state and navigating to login.');
      setUser(null);
      navigate('/login');
    }
  }, [navigate]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    logout,
  }), [user, isLoading, login, signup, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
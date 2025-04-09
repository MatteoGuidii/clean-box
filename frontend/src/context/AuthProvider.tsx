// src/context/AuthProvider.tsx
import React, { useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
// Import the context OBJECT and TYPE from the definition file
import { AuthContext, User } from './AuthContextDefinition';

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// --- AuthProvider Component ---
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true until initial check done
  const navigate = useNavigate();

  // --- checkAuthStatus function ---
  // Checks session via /me endpoint, updates user state
  const checkAuthStatus = useCallback(async () => {
    console.log('[AuthProvider] Checking auth status...');
    // Ensure loading is true during check, unless it's already running
    // This check might need refinement depending on desired re-check behavior
    if (!isLoading) setIsLoading(true);
    try {
      const response = await fetch('/api/v1/users/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Crucial for sending cookie
      });
      if (response.ok) {
        const userData: User = await response.json();
        console.log('[AuthProvider] Auth check successful:', userData);
        setUser(userData);
      } else {
        console.log('[AuthProvider] Auth check failed:', response.status);
        setUser(null); // Ensure user is null if not authorized
      }
    } catch (error) {
      console.error('[AuthProvider] Error during auth check:', error);
      setUser(null); // Ensure user is null on error
    } finally {
      setIsLoading(false); // Mark loading as complete
      console.log('[AuthProvider] Auth check finished. Loading:', false);
    }
  }, [isLoading]); // Dependency on isLoading to potentially re-trigger loading state if called manually

  // Run initial auth check on component mount
  useEffect(() => {
    checkAuthStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount


  // --- Login function ---
  // Calls login API, then updates user state via checkAuthStatus, navigates
  const login = useCallback(async (email: string, password: string) => {
     console.log('[AuthProvider] Attempting login...');
     try {
       const response = await fetch('/api/v1/users/login', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email, password }),
         credentials: 'include', // Crucial
       });
       if (!response.ok) {
         let message = `Login failed (status: ${response.status})`;
         try { const data = await response.json(); message = data?.message || message; } catch { /* Ignore JSON parse error on failure */ }
         throw new Error(message); // Throw error for component to catch
       }
       // Success: Cookie is set by browser via Set-Cookie header
       console.log('[AuthProvider] Login API call successful. Fetching user data...');
       await checkAuthStatus(); // Refresh user state
       console.log('[AuthProvider] Navigating to /'); // Adjusted navigation target
       navigate('/'); // Navigate to HOME after successful login (since no dashboard)
     } catch (error) {
       console.error('[AuthProvider] Login error:', error);
       setUser(null); // Ensure user is null on login failure
       throw error; // Re-throw for component UI
     }
   }, [navigate, checkAuthStatus]); // Dependencies


  // --- Signup function ---
  // Calls signup API, navigates to login on success
   const signup = useCallback(async (email: string, password: string) => {
     console.log('[AuthProvider] Attempting signup...');
     try {
       const response = await fetch('/api/v1/users/signup', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ email, password }),
         // No credentials needed for signup request
       });
       if (!response.ok) {
         let message = `Signup failed (status: ${response.status})`;
         try { const data = await response.json(); message = data?.message || message; } catch { /* Ignore JSON parse error on failure */ }
         throw new Error(message); // Throw error for component
       }
       // Success
       console.log('[AuthProvider] Signup successful. Navigating to login.');
       alert('Sign up successful! Please log in.'); // Consider using a toast notification later
       navigate('/login');
     } catch (error) {
       console.error('[AuthProvider] Signup error:', error);
       throw error; // Re-throw for component
     }
   }, [navigate]); // Dependency


  // --- Logout function ---
  // Calls logout API, always clears user state and navigates
   const logout = useCallback(async () => {
     console.log('[AuthProvider] Attempting logout...');
     try {
       // Call API to invalidate session/cookie on backend
       await fetch('/api/v1/users/logout', {
         method: 'POST',
         credentials: 'include', // Crucial to send cookie for backend invalidation
       });
       console.log('[AuthProvider] Logout API call finished.');
     } catch (error) {
       console.error('[AuthProvider] Logout API error:', error);
       // Continue with client-side logout regardless
     } finally {
       // Always clear client state and redirect
       console.log('[AuthProvider] Clearing user state and navigating to login.');
       setUser(null);
       navigate('/login');
     }
   }, [navigate]); // Dependency


  // Memoize the context value to prevent unnecessary re-renders of consumers
  // when the provider itself re-renders but the value hasn't changed.
   const value = useMemo(() => ({
    user,
    isLoading,
    login,
    signup,
    logout,
  }), [user, isLoading, login, signup, logout]); // Dependencies for memoization


  // Provide the value using the imported AuthContext object
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
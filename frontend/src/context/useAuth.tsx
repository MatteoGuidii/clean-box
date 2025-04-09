import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthContext'; // Import context object and type

// --- Custom hook to use the AuthContext ---
export const useAuth = (): AuthContextType => {
  // Get the context value
  const context = useContext(AuthContext);
  // Ensure the hook is used within a provider
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
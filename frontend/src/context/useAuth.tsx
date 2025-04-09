import { useContext } from 'react';
import { AuthContext, AuthContextType } from './AuthContextDefinition';

// --- Custom hook to use the AuthContext --- (Implementation remains the same)
export const useAuth = (): AuthContextType => {
  // Get the context value using the imported context object
  const context = useContext(AuthContext);
  // Ensure the hook is used within a provider
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
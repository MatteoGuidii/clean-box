import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import SignUp from './pages/Signup'; // Or SignUp if filename casing matches
import Login from './pages/Login';
import { useAuth } from './context/useAuth';

function App() {
  // Get authentication state and loading status from the context
  const { user, isLoading } = useAuth();

  // Show loading indicator (or null) while checking initial auth status
  if (isLoading) {
    // Simple DaisyUI spinner - replace with preferred loading UI if needed
    return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  return (
    <>
      <Routes>
        {/* Public Route: Home */}
        <Route path="/" element={<Home />} />

        {/* Public Route: Login - Redirect to Home ('/') if already logged in */}
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />} // Redirect logged-in users to Home
        />

        {/* Public Route: Signup - Redirect to Home ('/') if already logged in */}
        <Route
          path="/signup"
          element={user ? <Navigate to="/" replace /> : <SignUp />} // Redirect logged-in users to Home
        />

        {/* NO protected routes defined yet */}

        {/* Catch-all Route: Redirects any unknown paths to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </>
  );
}

export default App;
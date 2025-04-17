// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import SignUp from './pages/Signup';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard'; // --- IMPORT DASHBOARD ---
import { useAuth } from './context/useAuth';
import Navbar from './components/layout/Navbar';

function App() {
  const { user, isLoading } = useAuth();

  // Loading check remains the same
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main> {/* Optional wrapper */}
        <Routes>
          {/* Public Route: Home */}
          <Route path="/" element={<Home />} />

          {/* Public Route: Login - Redirect to Dashboard if logged in */}
          <Route
            path="/login"
            element={user ? <Navigate to="/dashboard" replace /> : <Login />} // <-- UPDATED Redirect Target
          />

          {/* Public Route: Signup - Redirect to Dashboard if logged in */}
          <Route
            path="/signup"
            element={user ? <Navigate to="/dashboard" replace /> : <SignUp />} // <-- UPDATED Redirect Target
          />

          {/* Protected Route: Dashboard */}
          <Route
            path="/dashboard" // <-- ADDED Route
            // Render Dashboard if logged in, otherwise redirect to Login
            element={user ? <Dashboard /> : <Navigate to="/login" replace />}
          />

          {/* Catch-all Route */}
          {/* Redirect unknown paths to Dashboard if logged in, otherwise to Home */}
          <Route
             path="*" // <-- UPDATED Catch-all Logic
             element={<Navigate to={user ? "/dashboard" : "/"} replace />}
          />

        </Routes>
      </main>
    </>
  );
}

export default App;
// src/App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import SignUp from './pages/Signup';
import Login from './pages/Login';
import { useAuth } from './context/useAuth';
import Navbar from './components/layout/Navbar'; // --- IMPORT THE NAVBAR ---
// Optional: LoadingSpinner, Toaster etc.

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
    // Use a fragment or main div to wrap Navbar and Routes
    <>
      {/* --- RENDER THE NAVBAR HERE --- */}
      <Navbar />

      {/* To prevent content from going under the sticky navbar, you might need
          a main content container with padding-top, or adjust layout globally */}
      <main /* className="pt-16" */> {/* Example: Add top padding if navbar is sticky */}
        <Routes>
          {/* Routes remain the same */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp />} />
          {/* No protected routes yet */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* Toaster or Footer could go here */}
    </>
  );
}

export default App;
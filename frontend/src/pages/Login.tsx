import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth'; // Correct import path for the hook

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Local state for button loading
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth(); // Get login function from context

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); // Clear previous form errors

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true); // Indicate submission start

    try {
      await login(email, password); // Call context login function
      // Navigation happens inside context on success
    } catch (err: unknown) {
      // Handle errors thrown by the context login function
      let errorMessage = 'Failed to log in. Please check credentials or try again.'; // Default
      if (err instanceof Error) {
        errorMessage = err.message; // Use message from thrown error
      }
      setError(errorMessage);
      setIsSubmitting(false); // Re-enable form on error
    }
    // No need to set isSubmitting false on success due to navigation
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4 py-12">
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl justify-center mb-6">Log In</h2>
          <form onSubmit={handleSubmit} noValidate>
            {/* Email Input */}
            <div className="form-control mb-4">
              <label className="label" htmlFor="login-email">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email" id="login-email" placeholder="you@example.com"
                className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" disabled={isSubmitting}
              />
            </div>
            {/* Password Input */}
            <div className="form-control mb-6">
              <label className="label" htmlFor="login-password">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password" id="login-password" placeholder="••••••••"
                className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" disabled={isSubmitting}
              />
            </div>
            {/* Error Message Display */}
            {error && (
              <div role="alert" className="alert alert-error shadow-lg mb-6">
                 <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                 <span>{error}</span>
              </div>
            )}
            {/* Submit Button */}
            <div className="form-control mt-6">
              <button type="submit" className={`btn btn-primary w-full ${isSubmitting ? 'loading' : ''}`} disabled={isSubmitting}>
                {isSubmitting ? 'Logging In...' : 'Log In'}
              </button>
            </div>
          </form>
          {/* Link to Sign Up */}
          <div className="text-center mt-4">
            <span className="text-sm text-base-content/70">Don't have an account? </span>
            <Link to="/signup" className="link link-primary link-hover text-sm">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
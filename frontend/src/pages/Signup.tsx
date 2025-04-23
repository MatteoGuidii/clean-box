import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false); // Local state for button loading
  const [error, setError] = useState<string | null>(null);
  const { signup } = useAuth(); // Get signup function from context

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); // Clear previous form errors

    // Local form validation
    if (!name || !email || !password || !passwordConfirm) {
      setError('Please fill in all fields.'); return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match.'); return;
    }
    // if (password.length < 8) {
    //   setError('Password must be at least 8 characters long.'); return;
    // }
    // if (!/[A-Z]/.test(password)) {
    //   setError('Password must contain at least one uppercase letter.'); return;
    // }
    // if (!/[0-9]/.test(password)) {
    //   setError('Password must contain at least one number.'); return;
    // }
    // if (!/[!@#$%^&*_]/.test(password)) {
    //   setError('Password must contain at least one special character.'); return;
    // }
    if (name.length < 2) {
      setError('Name must be at least 2 characters long.'); return;
    }

    setIsSubmitting(true); // Indicate submission start

    try {
      await signup(name, email, password); // Call context signup function
      // Navigation happens inside context on success
    } catch (err: unknown) {
       // Handle errors thrown by the context signup function
      let errorMessage = 'Failed to sign up. Please try again.'; // Default
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
          <h2 className="card-title text-2xl justify-center mb-6">Create Your Account</h2>
          <form onSubmit={handleSubmit} noValidate>

            {/* --- Name Input --- */}
            <div className="form-control mb-4">
              <label className="label" htmlFor="signup-name"><span className="label-text">Full Name</span></label>
              <input type="text" id="signup-name" placeholder="Your Name"
                className={`input input-bordered w-full ${error && error.toLowerCase().includes('name') ? 'input-error' : ''}`} // Basic error check
                value={name} onChange={(e) => setName(e.target.value)}
                required autoComplete="name" disabled={isSubmitting}
              />
            </div>

            {/* Email Input */}
            <div className="form-control mb-4">
              <label className="label" htmlFor="signup-email"><span className="label-text">Email</span></label>
              <input type="email" id="signup-email" placeholder="you@example.com"
                className={`input input-bordered w-full ${error && error.toLowerCase().includes('email') ? 'input-error' : ''}`}
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" disabled={isSubmitting}
              />
            </div>

            {/* Password Input */}
            <div className="form-control mb-4">
              <label className="label" htmlFor="signup-password"><span className="label-text">Password</span></label>
              <input type="password" id="signup-password" placeholder="•••••••• (min. 8 characters)"
                className={`input input-bordered w-full ${error && (error.toLowerCase().includes('password') || error.toLowerCase().includes('match')) ? 'input-error' : ''}`}
                value={password} onChange={(e) => setPassword(e.target.value)}
                required minLength={8} autoComplete="new-password" disabled={isSubmitting}
              />
            </div>

            {/* Confirm Password Input */}
            <div className="form-control mb-6">
              <label className="label" htmlFor="signup-passwordConfirm"><span className="label-text">Confirm Password</span></label>
              <input type="password" id="signup-passwordConfirm" placeholder="••••••••"
                className={`input input-bordered w-full ${error && error.toLowerCase().includes('match') ? 'input-error' : ''}`}
                value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                required autoComplete="new-password" disabled={isSubmitting}
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
                {isSubmitting ? 'Creating Account...' : 'Sign Up'}
              </button>
            </div>
          </form>
          
          {/* Link to Login */}
          <div className="text-center mt-4">
            <span className="text-sm text-base-content/70">Already have an account? </span>
            <Link to="/login" className="link link-primary link-hover text-sm">
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
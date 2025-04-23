import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth'; // Adjust path if needed

export default function Navbar() {
  // Get user state, logout function, and loading status from context
  const { user, logout, isLoading } = useAuth();

  // Handle logout click
  const handleLogout = async () => {
    try {
      await logout();
      // Navigation to /login happens inside the context's logout function
    } catch (error) {
      console.error("Logout failed:", error);
      // Optionally show an error message to the user if logout fails critically
      // (though client-side state is cleared anyway in our context function)
    }
  };

  // Optional: Don't render the interactive parts until the initial auth check is done
  // to prevent flashing Login/Logout links incorrectly.
  // You might want a more sophisticated loading state for the navbar itself.
  if (isLoading) {
    return (
      <div className="navbar bg-base-100 shadow-sm px-4">
         <div className="flex-1">
           <Link to="/" className="btn btn-ghost normal-case text-xl opacity-50">Inbox Detox</Link>
         </div>
         <div className="flex-none"><span className="loading loading-spinner loading-xs"></span></div>
      </div>
    );
  }


  return (
    <div className="navbar bg-base-100 shadow-sm px-4 sticky top-0 z-50"> {/* Added sticky top */}
      <div className="flex-1">
        {/* Link the app title back to Home */}
        <Link to="/" className="btn btn-ghost normal-case text-xl">
          Clean Box
        </Link>
      </div>
      <div className="flex-none">
        <ul className="menu menu-horizontal p-0 space-x-2 items-center"> {/* Use items-center */}
          {user ? (
            // --- User is Logged In ---
            <>
              <li>
                {/* Display user name (or other identifier) */}
                <span className="text-sm font-medium mr-2 hidden sm:inline"> {/* Hide on small screens */}
                  {user.email}
                </span>
              </li>
              <li>
                {/* Logout Button */}
                <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                  Logout
                </button>
              </li>
            </>
          ) : (
            // --- User is Logged Out ---
            // Avoid showing auth links during initial load if you uncomment the isLoading check above
            !isLoading && (
              <>
                <li>
                  <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
                </li>
                <li>
                  <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
                </li>
              </>
            )
          )}
           {/* Render loading indicator if still loading and not showing links */}
           {isLoading && <span className="loading loading-spinner loading-xs"></span>}
        </ul>
      </div>
    </div>
  );
}
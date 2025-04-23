import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth'; // Adjust path as needed

export default function HeroSection() {
  const { user } = useAuth(); // Get user state from context

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center px-4 py-16 bg-gradient-to-b from-base-100 to-base-200">
      <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
        Reclaim Your Inbox, Effortlessly.
      </h1>
      <p className="text-lg md:text-xl mb-8 max-w-2xl text-base-content/80">
        Clean Box automatically unsubscribes you from unwanted mailing lists using AI,
        while keeping your privacy secure. Say goodbye to email clutter.
      </p>
      <div className="space-x-4">
        {/* Conditionally render buttons based on user login state */}
        {user ? (
          <Link to="/dashboard" className="btn btn-primary btn-lg">
            Go to Dashboard
          </Link>
        ) : (
          <>
            <Link to="/signup" className="btn btn-primary btn-lg">
              Start Detoxing Now
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Log In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
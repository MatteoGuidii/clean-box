import { Link } from 'react-router-dom';

export default function AppFooter() {
  return (
    <footer className="p-10 footer bg-neutral text-neutral-content footer-center">
      <div>
         <h2 className="text-2xl font-bold">Ready to clean up your inbox?</h2>
         <p className="mb-4">Sign up today and experience automated email unsubscribing.</p>
         <Link to="/signup" className="btn btn-accent">
            Sign Up Now
         </Link>
         {/* You might add copyright or other links here later */}
         {/* <p className="text-sm mt-4">© {new Date().getFullYear()} Inbox Detox. All rights reserved.</p> */}
      </div>
    </footer>
  );
}
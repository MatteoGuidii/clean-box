import { Link } from 'react-router-dom';
// Optional: Import icons if you use them
// import { ShieldCheckIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function FeaturesSection() {
  return (
    <div className="py-16 bg-base-200 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12">
          How Inbox Detox Works for You
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {/* Feature 1 */}
          <div className="p-6 rounded-lg ">
             <div className="prose lg:prose-xl mx-auto mb-4">🔄</div>
             <h3 className="text-xl font-semibold mb-2">1. Create a Task</h3>
             <p className="text-base-content/70">
                Simply connect your inbox or provide unsubscribe links. We handle the rest securely.
             </p>
          </div>
          {/* Feature 2 */}
          <div className="p-6 rounded-lg ">
             <div className="prose lg:prose-xl mx-auto mb-4">✨</div>
             <h3 className="text-xl font-semibold mb-2">2. AI-Powered Action</h3>
             <p className="text-base-content/70">
                Our smart system (using Claude 3 Haiku) navigates unsubscribe pages and takes action automatically.
             </p>
          </div>
          {/* Feature 3 */}
          <div className="p-6 rounded-lg ">
             <div className="prose lg:prose-xl mx-auto mb-4">🛡️</div>
             <h3 className="text-xl font-semibold mb-2">3. Privacy Guaranteed</h3>
             <p className="text-base-content/70">
                We only access necessary metadata or links, never your raw email content. Your data stays private.
             </p>
          </div>
        </div>
         <div className="text-center mt-12">
           <Link to="/signup" className="btn btn-secondary">
              Get Started for Free
           </Link>
         </div>
      </div>
    </div>
  );
}
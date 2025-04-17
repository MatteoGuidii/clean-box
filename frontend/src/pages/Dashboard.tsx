// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
// Example: Import icons (you'll need to install @heroicons/react)
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, LinkIcon, ChartBarIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline';

// Assume Task type exists (as defined previously)
interface Task { id: string; url?: string; status: 'pending' | 'success' | 'failed' | 'processing'; createdAt: string; updatedAt: string; }
// Assume Stats type exists
interface AppStats { totalAttempted: number; successful: number; failed: number; emailsAvoidedEstimate: number; }

export default function Dashboard() {
  const { user } = useAuth(); // Logout can be accessed from Navbar

  // --- Placeholder State ---
  // These would be populated by API calls later
  const [isAccountConnected, setIsAccountConnected] = useState(false); // TODO: Fetch real status
  const [stats, setStats] = useState<AppStats | null>(null); // TODO: Fetch stats
  const [recentTasks, setRecentTasks] = useState<Task[]>([]); // TODO: Fetch recent tasks
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]); // TODO: Fetch processing tasks
  const [isLoading, setIsLoading] = useState(true); // Combined loading state for initial data

  // --- TODO: Fetch Initial Data ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      console.log("TODO: Fetch connection status, stats, recent tasks");
      try {
        
        // --- MOCK DATA FOR UI DEVELOPMENT ---
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate loading
        setIsAccountConnected(false); // Simulate not connected initially
        setStats({ totalAttempted: 0, successful: 0, failed: 0, emailsAvoidedEstimate: 0 });
        setRecentTasks([]);
        setProcessingTasks([]);
        // --- END MOCK DATA ---


      } catch (error) {
        console.error("Failed to load dashboard data:", error);
        // Set error states if needed
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []); // Fetch on mount


  // --- Handlers (Placeholders) ---
  const handleConnectGmail = () => {
    console.log("TODO: Initiate Google OAuth flow");
    alert("Gmail connection feature coming soon!");
  };
  const handleDisconnectGmail = () => {
    console.log("TODO: Call backend API to disconnect Gmail");
    alert("Gmail disconnect feature coming soon!");
  };

  // --- Render Logic ---
  if (!user) return null; // Should be handled by routing, but safe check

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-base-200 min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold mb-6 text-neutral">
        Dashboard
      </h1>
      <p className="mb-8 text-lg text-neutral/80">Welcome back, {user.email}! Manage your inbox detox journey.</p>

      {/* --- Main Grid --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- Column 1: Connection & Actions --- */}
        <div className="lg:col-span-1 space-y-6">
          {/* Connection Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title text-lg font-semibold mb-3 flex items-center">
                <LinkIcon className="w-5 h-5 mr-2" /> Gmail Connection
              </h2>
              {isLoading ? (
                <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
              ) : isAccountConnected ? (
                <div>
                  <p className="mb-4 text-success flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2"/> Connected as {user.email}
                  </p>
                  <button onClick={handleDisconnectGmail} className="btn btn-sm btn-outline btn-warning w-full">
                    Disconnect Account
                  </button>
                </div>
              ) : (
                <div>
                  <p className="mb-4 text-warning flex items-center">
                     <ExclamationCircleIcon className="w-5 h-5 mr-2"/> Account not connected.
                  </p>
                  <button onClick={handleConnectGmail} className="btn btn-primary w-full mb-2">
                    <InboxArrowDownIcon className="w-5 h-5 mr-2" /> Connect Gmail
                  </button>
                   <p className="text-xs text-base-content/70 mt-1">Connect to automatically find and manage unsubscribe links.</p>
                </div>
              )}
            </div>
          </div>

          {/* (Optional: Add other action cards here, e.g., Manual Unsubscribe) */}

        </div>

        {/* --- Column 2: Stats & Overview --- */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title text-lg font-semibold mb-4 flex items-center">
                <ChartBarIcon className="w-5 h-5 mr-2" /> Your Detox Stats
              </h2>
              {isLoading ? (
                 <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
              ) : stats ? (
                <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                  <div className="stat">
                    <div className="stat-title">Attempted</div>
                    <div className="stat-value text-primary">{stats.totalAttempted}</div>
                    <div className="stat-desc">Total unsub links found</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Successful</div>
                    <div className="stat-value text-success">{stats.successful}</div>
                    <div className="stat-desc text-success">{stats.totalAttempted > 0 ? `${Math.round((stats.successful / stats.totalAttempted) * 100)}%` : '0%'} success rate</div>
                  </div>
                   <div className="stat">
                    <div className="stat-title">Est. Emails Avoided</div>
                    <div className="stat-value">{stats.emailsAvoidedEstimate}+</div>
                    <div className="stat-desc">Since using Inbox Detox</div>
                  </div>
                   {/* Add Failed stat if desired */}
                   {/* <div className="stat">
                     <div className="stat-title">Failed</div>
                     <div className="stat-value text-error">{stats.failed}</div>
                   </div> */}
                </div>
              ) : (
                <p>Connect your account to see your stats.</p>
              )}
            </div>
          </div>

          {/* Task Overview Card */}
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
               <h2 className="card-title text-lg font-semibold mb-4">Recent Activity</h2>
                {isLoading ? (
                  <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
                ) : !isAccountConnected ? (
                  <p>Connect your account to view task activity.</p>
                ) : (
                  <div className="space-y-4">
                    {/* Currently Processing */}
                    {processingTasks.length > 0 && (
                      <div>
                        <h3 className="font-medium mb-2 flex items-center"><ClockIcon className="w-5 h-5 mr-2 text-info"/> Currently Processing</h3>
                        <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                           {processingTasks.map(task => <li key={task.id}>Processing unsubscribe for: {task.url || 'Unknown Target'}...</li>)}
                        </ul>
                      </div>
                    )}

                    {/* Recent Tasks */}
                     <div>
                        <h3 className="font-medium mb-2">Last Few Updates</h3>
                        {recentTasks.length > 0 ? (
                          <ul className="text-sm space-y-2">
                            {recentTasks.map(task => (
                              <li key={task.id} className="flex items-center justify-between border-b border-base-300 pb-1">
                                <span>{task.url || 'Unknown Target'}</span>
                                <span className={`badge badge-sm ${task.status === 'success' ? 'badge-success' : task.status === 'failed' ? 'badge-error' : 'badge-ghost'}`}>
                                  {task.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                           processingTasks.length === 0 && <p className="text-sm text-base-content/70">No recent task activity.</p>
                        )}
                     </div>

                     {/* Link to full history (Future) */}
                     {/* <div className="text-right mt-4">
                        <Link to="/tasks" className="link link-primary text-sm">View Full Task History</Link>
                     </div> */}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
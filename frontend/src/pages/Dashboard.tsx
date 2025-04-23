// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, LinkIcon, ChartBarIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline'; // Assuming you installed @heroicons/react

// Define interfaces based on your expected data structure
interface Task {
  id: string;
  url?: string; // Or sender/list info
  status: 'pending' | 'success' | 'failed' | 'processing';
  createdAt: string; // ISO date string or Date object
  updatedAt: string; // ISO date string or Date object
}

interface AppStats {
  totalAttempted: number;
  successful: number;
  failed: number;
  emailsAvoidedEstimate: number;
}

// Define the structure of the user data returned by /me
// Align this with your AuthContextDefinition User type
interface FetchedUser {
    id: string;
    name: string;
    email: string; // Registration email
    isGmailConnected?: boolean | null;
    googleEmail?: string | null;
}


export default function Dashboard() {
  const { user } = useAuth(); // Get user context (includes name, potentially googleEmail after /me fetch)
  const location = useLocation();
  const navigate = useNavigate();

  // State specific to the Dashboard
  const [isAccountConnected, setIsAccountConnected] = useState<boolean | null>(null); // null = loading status, false = not connected, true = connected
  const [stats, setStats] = useState<AppStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true); // For loading dashboard specific data (stats, tasks)
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

   // Effect to handle messages from OAuth callback redirects
   useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const errorParam = queryParams.get('error');
    const connectedParam = queryParams.get('connected');

    let messageTimer: NodeJS.Timeout | null = null;

    if (errorParam) {
      setErrorMessage(`Failed to connect Google Account: ${errorParam.replace(/_/g, ' ')}`);
      // Clear query params from URL to prevent message showing on refresh
      navigate(location.pathname, { replace: true });
      messageTimer = setTimeout(() => setErrorMessage(null), 7000); // Clear error after 7s
    } else if (connectedParam === 'true') {
       setActionMessage("Google Account connected successfully!");
       setIsAccountConnected(true); // Optimistically update UI immediately after redirect
       // Clear query params
       navigate(location.pathname, { replace: true });
       messageTimer = setTimeout(() => setActionMessage(null), 5000); // Clear success after 5s
    }

    // Cleanup timer if component unmounts or effect re-runs
    return () => {
        if (messageTimer) clearTimeout(messageTimer);
    }
   }, [location, navigate]); // Run when location changes


  // Effect to fetch initial data (user status, stats, tasks)
  useEffect(() => {
    // Only run if user context is loaded (avoids race conditions)
    if (!user) {
      setIsLoadingData(false); // Not loading if no user
      return;
    }

    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchData = async () => {
      if (!isMounted) return; // Exit if component unmounted during async operation

      setIsLoadingData(true);
      setErrorMessage(null); // Clear previous errors for this fetch

      console.log("[Dashboard] Fetching initial data...");
      try {
        // Fetch user data again from /me to get latest connection status and googleEmail
        const meResponse = await fetch('/api/v1/users/me', { credentials: 'include' });
        if (!isMounted) return; // Check again after await

        if (!meResponse.ok) {
            const errorData = await meResponse.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Failed to fetch user status');
        }
        const userData: FetchedUser = await meResponse.json();
        const connectedStatus = userData?.isGmailConnected || false;

        // Update connection status based on fresh data
        setIsAccountConnected(connectedStatus);
        console.log("[Dashboard] Connection status from /me:", connectedStatus);
        console.log("[Dashboard] Google Email from /me:", userData?.googleEmail);


        // If connected, fetch stats and tasks (replace mock data later)
        if (connectedStatus) {
            console.log("TODO: Fetch stats and tasks");
            // --- MOCK DATA FOR STATS/TASKS (REMOVE LATER) ---
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay for mock data
            if (!isMounted) return; // Check again after delay simulation

            setStats({ totalAttempted: 5, successful: 3, failed: 1, emailsAvoidedEstimate: 150 });
            setRecentTasks([
                {id: '1', url: 'newsletter@example.com', status: 'success', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
                {id: '2', url: 'spam@example.net', status: 'failed', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
            ]);
            setProcessingTasks([
                {id: '3', url: 'marketing@example.org', status: 'processing', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()},
            ]);
            // --- END MOCK DATA ---
        } else {
            // Clear stats/tasks if not connected
            setStats(null);
            setRecentTasks([]);
            setProcessingTasks([]);
        }

      } catch (error: unknown) {
         console.error("Failed to load dashboard data:", error);
         if (isMounted) { // Only update state if mounted
             if (error instanceof Error) {
                setErrorMessage(error.message || 'Could not load dashboard data.');
             } else {
                setErrorMessage('An unexpected error occurred while loading data.');
             }
             // Decide if we should reset connection status on error
             // setIsAccountConnected(false);
         }
      } finally {
        if (isMounted) { // Only update state if mounted
          setIsLoadingData(false);
        }
      }
    };

    fetchData();

    // Cleanup function to set isMounted flag to false when component unmounts
    return () => {
        isMounted = false;
    };

  }, [user]); // Dependency array includes user from AuthContext


  // --- Handlers ---
  const handleConnectGmail = () => {
    setErrorMessage(null);
    setActionMessage(null);
    // Redirect browser to backend route that starts the Google OAuth flow
    window.location.href = '/api/v1/connect/google';
  };

  const handleDisconnectGmail = async () => {
     setErrorMessage(null);
     setActionMessage(null);
     if (!window.confirm("Are you sure you want to disconnect your Google Account? This will stop automatic unsubscribing.")) {
         return;
     }

     console.log("Calling backend API to disconnect Gmail...");
     try {
        const response = await fetch('/api/v1/disconnect/google', {
             method: 'POST',
             credentials: 'include'
        });
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData?.error || 'Failed to disconnect account.');
        }
        // Success
        setIsAccountConnected(false); // Update UI immediately
        setStats(null);
        setRecentTasks([]);
        setProcessingTasks([]);
        setActionMessage("Google Account disconnected successfully.");
        setTimeout(() => setActionMessage(null), 5000); // Clear message

     } catch (error: unknown) {
          console.error("Disconnect error:", error);
          if (error instanceof Error) {
            setErrorMessage(error.message || 'An error occurred while disconnecting.');
          } else {
            setErrorMessage('An unexpected error occurred while disconnecting.');
          }
          setTimeout(() => setErrorMessage(null), 7000); // Clear error message
     }
  };

  // Render null or a minimal loader if the user object from context isn't loaded yet
  if (!user) {
    // This should ideally be covered by App.tsx's main isLoading check,
    // but can be a fallback.
    return <div className="min-h-screen flex items-center justify-center"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  // --- Main Render ---
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-base-200 min-h-screen">
      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neutral">Dashboard</h1>
      {/* Use user.name for welcome message */}
      <p className="mb-6 text-lg text-neutral/80">Welcome back, {user.name}!</p>

      {/* Display Action/Error Messages */}
      {errorMessage && <div role="alert" className="alert alert-error mb-4 shadow-md"> <ExclamationCircleIcon className="w-6 h-6 stroke-current shrink-0"/> <span>{errorMessage}</span></div>}
      {actionMessage && <div role="alert" className="alert alert-success mb-4 shadow-md"> <CheckCircleIcon className="w-6 h-6 stroke-current shrink-0"/> <span>{actionMessage}</span></div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Connection Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg font-semibold mb-3 flex items-center"><LinkIcon className="w-5 h-5 mr-2" /> Gmail Connection</h2>
              {isAccountConnected === null ? ( // Loading connection status state
                <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
              ) : isAccountConnected ? ( // Connected state
                <div>
                  {/* Display connected Google Email if available */}
                  <p className="mb-4 text-success flex items-center">
                    <CheckCircleIcon className="w-5 h-5 mr-2"/> Connected as {user.googleEmail || '(Google Email not available)'}
                  </p>
                  <button onClick={handleDisconnectGmail} className="btn btn-sm btn-outline btn-warning w-full">Disconnect Account</button>
                </div>
              ) : ( // Not connected state
                <div>
                  <p className="mb-4 text-warning flex items-center"><ExclamationCircleIcon className="w-5 h-5 mr-2"/> Account not connected.</p>
                  <button onClick={handleConnectGmail} className="btn btn-primary w-full mb-2"><InboxArrowDownIcon className="w-5 h-5 mr-2" /> Connect Gmail</button>
                  <p className="text-xs text-base-content/70 mt-1">Connect to automatically find and manage unsubscribe links.</p>
                </div>
              )}
            </div>
          </div>
          {/* Add other cards/actions here if needed */}
        </div>

        <div className="lg:col-span-2 space-y-6">
           {/* Stats Card */}
           <div className="card bg-base-100 shadow-xl">
             <div className="card-body">
               <h2 className="card-title text-lg font-semibold mb-4 flex items-center"><ChartBarIcon className="w-5 h-5 mr-2" /> Your Detox Stats</h2>
               {isLoadingData && isAccountConnected === null ? ( // Loading stats state (tied to initial data load)
                 <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
               ) : isAccountConnected && stats ? ( // Connected and stats available
                 <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                     <div className="stat"><div className="stat-title">Attempted</div><div className="stat-value text-primary">{stats.totalAttempted}</div></div>
                     <div className="stat"><div className="stat-title">Successful</div><div className="stat-value text-success">{stats.successful}</div></div>
                     <div className="stat"><div className="stat-title">Est. Emails Avoided</div><div className="stat-value">{stats.emailsAvoidedEstimate}+</div></div>
                 </div>
               ) : ( // Not connected or stats not loaded
                 <p className="text-sm text-base-content/70">{isAccountConnected === false ? 'Connect your account to see your stats.' : 'Loading stats...'}</p>
               )}
             </div>
           </div>

           {/* Task Overview Card */}
           <div className="card bg-base-100 shadow-xl">
             <div className="card-body">
               <h2 className="card-title text-lg font-semibold mb-4">Recent Activity</h2>
               {isLoadingData && isAccountConnected === null ? ( // Loading tasks state
                 <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
               ) : !isAccountConnected ? ( // Not connected
                 <p className="text-sm text-base-content/70">Connect your account to view task activity.</p>
               ) : ( // Connected, show task lists
                 <div className="space-y-4">
                   {/* Currently Processing */}
                   {processingTasks.length > 0 && (
                     <div>
                       <h3 className="font-medium mb-2 flex items-center"><ClockIcon className="w-5 h-5 mr-2 text-info"/> Currently Processing</h3>
                       <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                         {processingTasks.map(task => <li key={task.id}>Processing: {task.url || 'Unknown'}...</li>)}
                       </ul>
                     </div>
                   )}
                   {/* Recent Tasks */}
                   <div>
                     <h3 className="font-medium mb-2">Last Few Updates</h3>
                     {recentTasks.length > 0 ? (
                       <ul className="text-sm space-y-2">
                         {recentTasks.map(task => (
                           <li key={task.id} className="flex items-center justify-between border-b border-base-300/50 pb-1 last:border-b-0">
                             <span className="truncate mr-2" title={task.url}>{task.url || 'Unknown Target'}</span>
                             <span className={`badge badge-sm ${task.status === 'success' ? 'badge-success' : task.status === 'failed' ? 'badge-error' : 'badge-ghost'}`}>{task.status}</span>
                           </li>
                         ))}
                       </ul>
                     ) : ( // No recent tasks to show
                       processingTasks.length === 0 && <p className="text-sm text-base-content/70">No recent task activity to display.</p>
                     )}
                   </div>
                   {/* Optional Link to full history */}
                 </div>
               )}
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import { useLocation, useNavigate } from 'react-router-dom'; // Import useNavigate
import { CheckCircleIcon, ClockIcon, ExclamationCircleIcon, LinkIcon, ChartBarIcon, InboxArrowDownIcon } from '@heroicons/react/24/outline';

// Interfaces for Task, AppStats (assuming they exist or will be created)
interface Task { id: string; url?: string; status: 'pending' | 'success' | 'failed' | 'processing'; createdAt: string; updatedAt: string; }
interface AppStats { totalAttempted: number; successful: number; failed: number; emailsAvoidedEstimate: number; }

export default function Dashboard() {
  const { user } = useAuth(); // User from AuthContext should have updated isGmailConnected
  const location = useLocation();
  const navigate = useNavigate(); // For potential future use

  // State for dashboard specific data and connection status
  const [isAccountConnected, setIsAccountConnected] = useState<boolean | null>(null); // null initially
  const [stats, setStats] = useState<AppStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null); // For connect/disconnect messages

   // Check for messages from OAuth callback in query params
   useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const errorParam = queryParams.get('error');
    const connectedParam = queryParams.get('connected');

    if (errorParam) {
      setErrorMessage(`Failed to connect Google Account: ${errorParam.replace(/_/g, ' ')}`);
      // Clear query params from URL using navigate without reload
      navigate(location.pathname, { replace: true });
    } else if (connectedParam === 'true') {
       setActionMessage("Google Account connected successfully!");
       setIsAccountConnected(true); // Optimistically update UI
       // Clear query params
       navigate(location.pathname, { replace: true });
       // Optionally trigger data refetch here if needed sooner than full useEffect
    }
   }, [location, navigate]);


  // --- Fetch Initial Data (including updated connection status) ---
  useEffect(() => {
    // Don't fetch if user is not available (shouldn't happen in protected route)
    if (!user) {
        setIsLoadingData(false);
        return;
    };

    const fetchData = async () => {
      setIsLoadingData(true);
      setErrorMessage(null); // Clear previous errors on refetch
      // Clear action message after short delay
      if(actionMessage) setTimeout(() => setActionMessage(null), 5000);

      console.log("[Dashboard] Fetching initial data...");
      try {
        // Fetch user data again to get latest isGmailConnected status
        const meResponse = await fetch('/api/v1/users/me', { credentials: 'include' });
        if (!meResponse.ok) throw new Error('Failed to fetch user status');
        const userData = await meResponse.json();
        const connectedStatus = userData?.isGmailConnected || false;
        setIsAccountConnected(connectedStatus);
        console.log("[Dashboard] Connection status from /me:", connectedStatus);

        // If connected, fetch other data (TODO: Implement these endpoints)
        if (connectedStatus) {
            console.log("TODO: Fetch stats and tasks");
            // const statsPromise = fetch('/api/v1/stats', { credentials: 'include' });
            // const tasksPromise = fetch('/api/v1/tasks?limit=5...', { credentials: 'include' });
            // const [statsRes, tasksRes] = await Promise.all([statsPromise, tasksPromise]);
            // if (!statsRes.ok) throw new Error('Failed to fetch stats');
            // if (!tasksRes.ok) throw new Error('Failed to fetch tasks');
            // setStats(await statsRes.json());
            // setTasks(...)

            // --- MOCK DATA FOR STATS/TASKS (REMOVE LATER) ---
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
        if (error instanceof Error) {
            setErrorMessage(error.message || 'Could not load dashboard data.');
        } else {
            setErrorMessage('An unexpected error occurred.');
        }
        if (error instanceof Error) {
            setErrorMessage(error.message || 'Could not load dashboard data.');
        } else {
            setErrorMessage('Could not load dashboard data.');
        }
         // Reset connection status potentially? Depends on error type
         // setIsAccountConnected(false);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchData();
  // Re-fetch if the user object identity changes (e.g., after re-login - though full reload likely happens)
  // Or refetch based on query params changing if needed, but reload might be simpler.
  }, [user]);


  // --- Handlers ---
  const handleConnectGmail = () => {
    setErrorMessage(null); // Clear previous errors
    setActionMessage(null);
    // Redirect browser to backend route that starts the Google OAuth flow
    window.location.href = '/api/v1/connect/google';
  };

  const handleDisconnectGmail = async () => {
     setErrorMessage(null);
     setActionMessage(null);
     // Optional: Add a confirmation dialog here
     if (!window.confirm("Are you sure you want to disconnect your Google Account? This will stop automatic unsubscribing.")) {
         return;
     }

     console.log("TODO: Call backend API to disconnect Gmail");
     try {
        const response = await fetch('/api/v1/disconnect/google', {
             method: 'POST',
             credentials: 'include'
        });
        if (!response.ok) {
             const errorData = await response.json().catch(() => ({})); // Try to get error details
             throw new Error(errorData?.error || 'Failed to disconnect account.');
        }
        // Success
        setIsAccountConnected(false); // Update UI immediately
        setStats(null);
        setRecentTasks([]);
        setProcessingTasks([]);
        setActionMessage("Google Account disconnected successfully.");

     } catch (error: unknown) {
          console.error("Disconnect error:", error);
          if (error instanceof Error) {
            setErrorMessage(error.message || 'An error occurred while disconnecting.');
          } else {
            setErrorMessage('An unexpected error occurred while disconnecting.');
          }
     }
  };

   if (!user) return null; // Redundant safety check

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-base-200 min-h-screen">
        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neutral">Dashboard</h1>
        <p className="mb-6 text-lg text-neutral/80">Welcome back, {user.email}!</p>

        {/* Display Action/Error Messages */}
        {errorMessage && <div role="alert" className="alert alert-error mb-4"> <ExclamationCircleIcon className="w-6 h-6"/> <span>{errorMessage}</span></div>}
        {actionMessage && <div role="alert" className="alert alert-success mb-4"> <CheckCircleIcon className="w-6 h-6"/> <span>{actionMessage}</span></div>}


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
            {/* Connection Card */}
            <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                <h2 className="card-title text-lg font-semibold mb-3 flex items-center"><LinkIcon className="w-5 h-5 mr-2" /> Gmail Connection</h2>
                {isAccountConnected === null ? ( // Show loading specifically for connection status
                    <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
                ) : isAccountConnected ? (
                    <div>
                    <p className="mb-4 text-success flex items-center"><CheckCircleIcon className="w-5 h-5 mr-2"/> Connected as {user.email}</p>
                    <button onClick={handleDisconnectGmail} className="btn btn-sm btn-outline btn-warning w-full">Disconnect Account</button>
                    </div>
                ) : (
                    <div>
                    <p className="mb-4 text-warning flex items-center"><ExclamationCircleIcon className="w-5 h-5 mr-2"/> Account not connected.</p>
                    <button onClick={handleConnectGmail} className="btn btn-primary w-full mb-2"><InboxArrowDownIcon className="w-5 h-5 mr-2" /> Connect Gmail</button>
                    <p className="text-xs text-base-content/70 mt-1">Connect to automatically find and manage unsubscribe links.</p>
                    </div>
                )}
                </div>
            </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
             {/* Stats Card */}
             <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                <h2 className="card-title text-lg font-semibold mb-4 flex items-center"><ChartBarIcon className="w-5 h-5 mr-2" /> Your Detox Stats</h2>
                {isLoadingData && isAccountConnected === null ? ( // Show loading only if initial data is loading
                    <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
                ) : isAccountConnected && stats ? (
                    <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                        {/* Render stats using 'stats' object */}
                        <div className="stat"><div className="stat-title">Attempted</div><div className="stat-value text-primary">{stats.totalAttempted}</div></div>
                        <div className="stat"><div className="stat-title">Successful</div><div className="stat-value text-success">{stats.successful}</div></div>
                        <div className="stat"><div className="stat-title">Est. Emails Avoided</div><div className="stat-value">{stats.emailsAvoidedEstimate}+</div></div>
                    </div>
                ) : (
                    <p className="text-sm text-base-content/70">{isAccountConnected ? 'Stats not available yet.' : 'Connect your account to see your stats.'}</p>
                )}
                </div>
             </div>

             {/* Task Overview Card */}
             <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                <h2 className="card-title text-lg font-semibold mb-4">Recent Activity</h2>
                {isLoadingData && isAccountConnected === null ? (
                    <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
                ) : !isAccountConnected ? (
                    <p className="text-sm text-base-content/70">Connect your account to view task activity.</p>
                ) : (
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
                                <li key={task.id} className="flex items-center justify-between border-b border-base-300 pb-1">
                                    <span>{task.url || 'Unknown Target'}</span>
                                    <span className={`badge badge-sm ${task.status === 'success' ? 'badge-success' : task.status === 'failed' ? 'badge-error' : 'badge-ghost'}`}>{task.status}</span>
                                </li>
                                ))}
                            </ul>
                            ) : (
                            processingTasks.length === 0 && <p className="text-sm text-base-content/70">No recent task activity.</p>
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
// src/pages/Dashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/useAuth'; // Hook to access user context
import { useLocation, useNavigate } from 'react-router-dom'; // Hooks for handling redirects/query params
import {
    CheckCircleIcon,       // For success messages/status
    ClockIcon,             // For processing status (in future)
    ExclamationCircleIcon, // For error messages/status
    LinkIcon,              // For connection card title
    ChartBarIcon,          // For stats card title
    InboxArrowDownIcon,    // For connect button
    PaperAirplaneIcon,     // For approve button
    MagnifyingGlassIcon    // For scan button
} from '@heroicons/react/24/outline'; // Outline icons from Heroicons v2

// --- Interfaces ---
// Define the structure of Task data expected from the backend
interface Task {
  id: string;
  url?: string; // The unsubscribe URL
  senderEmail?: string | null; // Sender email associated with the task
  // Define possible statuses, including the new 'pending_approval'
  status: 'pending_approval' | 'queued' | 'pending' | 'success' | 'failed' | 'processing';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// Define the structure for Stats data (currently mocked)
interface AppStats {
  totalAttempted: number;
  successful: number;
  failed: number;
  emailsAvoidedEstimate: number;
}

// Define the structure of the User data fetched from /me endpoint
// Should align with AuthContextDefinition User type + backend response
interface FetchedUser {
    id: string;
    name: string; // User's registered name
    email: string; // User's registered email
    isGmailConnected?: boolean | null; // Connection status
    googleEmail?: string | null; // Connected Google account email
}

// --- Component ---
export default function Dashboard() {
  // --- Hooks ---
  const { user } = useAuth(); // Get logged-in user data from context
  const location = useLocation(); // Access query parameters from URL
  const navigate = useNavigate(); // Programmatically navigate

  // --- State ---
  // Connection Status
  const [isAccountConnected, setIsAccountConnected] = useState<boolean | null>(null); // null = unknown, true = connected, false = not connected
  const [connectedGoogleEmail, setConnectedGoogleEmail] = useState<string | null>(null); // Email of the connected Google account
  const [isLoadingConnectionStatus, setIsLoadingConnectionStatus] = useState(true); // Loading state for the initial /me fetch

  // Pending Approval Tasks
  const [pendingApprovalTasks, setPendingApprovalTasks] = useState<Task[]>([]); // Tasks waiting for user review
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set()); // IDs of tasks selected for approval
  const [isLoadingPendingTasks, setIsLoadingPendingTasks] = useState(false); // Loading state for fetching pending tasks
  const [isApprovingTasks, setIsApprovingTasks] = useState(false); // Loading state for the 'Approve' button action

  // Scan Initiation
  const [isScanning, setIsScanning] = useState(false); // Loading state for the 'Scan Inbox' button action

  // Placeholder Data (Stats & Other Tasks) - Replace with API calls later
  const [stats, setStats] = useState<AppStats | null>(null);
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]); // Tasks currently being processed by worker
  const [recentTasks, setRecentTasks] = useState<Task[]>([]); // Recently completed/failed tasks

  // UI Feedback Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For displaying errors
  const [actionMessage, setActionMessage] = useState<string | null>(null); // For displaying success/info messages

  // --- Callbacks ---
  // Fetch tasks needing user approval
  const fetchPendingApprovalTasks = useCallback(async () => {
    if (isAccountConnected !== true) {
      setPendingApprovalTasks([]); return; // Don't fetch if not connected
    }
    setIsLoadingPendingTasks(true);
    setErrorMessage(null);
    console.log("[Dashboard] Fetching pending approval tasks...");
    try {
      const response = await fetch('/api/v1/tasks?status=pending_approval', { credentials: 'include' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || 'Failed to fetch pending tasks');
      }
      const tasks: Task[] = await response.json();
      setPendingApprovalTasks(tasks);
      console.log(`[Dashboard] Found ${tasks.length} pending approval tasks.`);
    } catch (error: unknown) {
      console.error("Failed to load pending tasks:", error);
      const message = error instanceof Error ? error.message : 'Could not load tasks for approval.';
      setErrorMessage(message);
      setPendingApprovalTasks([]);
    } finally {
      setIsLoadingPendingTasks(false);
    }
  }, [isAccountConnected]); // Re-run if connection status changes

  // Initiate the backend inbox scan
  const handleInitiateScan = useCallback(async () => {
    if (!isAccountConnected) return; // Guard clause

    setIsScanning(true);
    setErrorMessage(null);
    setActionMessage(null);
    console.log("[Dashboard] Initiating inbox scan via API...");

    try {
        const response = await fetch('/api/v1/scan/initiate', {
            method: 'POST',
            credentials: 'include'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.message || `Scan initiation failed with status ${response.status}`);
        }
        setActionMessage(result?.message || "Inbox scan started. Check back later for tasks needing approval.");
        // Clear message after a delay
        setTimeout(() => setActionMessage(null), 7000);
    } catch (error: unknown) {
         console.error("Failed to initiate scan:", error);
         const message = error instanceof Error ? error.message : 'An unexpected error occurred while starting the scan.';
         setErrorMessage(message);
         setTimeout(() => setErrorMessage(null), 7000); // Clear error message
    } finally {
         setIsScanning(false);
    }
  }, [isAccountConnected]); // Depends on connection status

  // Approve selected tasks
  const handleApproveSelected = useCallback(async () => {
    if (selectedTaskIds.size === 0) return;

    setIsApprovingTasks(true);
    setErrorMessage(null);
    setActionMessage(null);
    const idsToApprove = Array.from(selectedTaskIds);
    console.log(`[Dashboard] Approving ${idsToApprove.length} tasks...`);

    try {
        const response = await fetch('/api/v1/tasks/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ taskIds: idsToApprove })
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result?.message || `Approval request failed with status ${response.status}`);
        }
        setActionMessage(result?.message || `${idsToApprove.length} task(s) sent for processing.`);
        setSelectedTaskIds(new Set()); // Clear selection
        fetchPendingApprovalTasks(); // Refresh the list of pending tasks
        // TODO: Optionally trigger fetch for other task lists (processing/recent)
        setTimeout(() => setActionMessage(null), 5000);
    } catch (error: unknown) {
         console.error("Failed to approve tasks:", error);
         const message = error instanceof Error ? error.message : 'An error occurred while approving tasks.';
         setErrorMessage(message);
         setTimeout(() => setErrorMessage(null), 7000);
    } finally {
         setIsApprovingTasks(false);
    }
  }, [selectedTaskIds, fetchPendingApprovalTasks]); // Depends on selection and fetch function

  // Toggle selection for a task
  const handleCheckboxChange = useCallback((taskId: string) => {
    setSelectedTaskIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(taskId)) {
        newSelected.delete(taskId);
      } else {
        newSelected.add(taskId);
      }
      return newSelected;
    });
  }, []); // No dependencies needed

  // Connect/Disconnect Handlers
  const handleConnectGmail = useCallback(() => {
      setErrorMessage(null);
      setActionMessage(null);
      window.location.href = '/api/v1/connect/google';
  }, []);

  const handleDisconnectGmail = useCallback(async () => {
     if (!window.confirm("Are you sure you want to disconnect your Google Account? This will stop automatic unsubscribing.")) return;
     setErrorMessage(null);
     setActionMessage(null);
     try {
         const response = await fetch('/api/v1/disconnect/google', { method: 'POST', credentials: 'include' });
         if (!response.ok) {
             const errorData = await response.json().catch(() => ({}));
             throw new Error(errorData?.error || 'Failed to disconnect account.');
         }
         setIsAccountConnected(false); // Update state immediately
         setConnectedGoogleEmail(null);
         setActionMessage("Google Account disconnected successfully.");
         setTimeout(() => setActionMessage(null), 5000);
     } catch (error: unknown) {
         const message = error instanceof Error ? error.message : 'An error occurred while disconnecting.';
         setErrorMessage(message);
         setTimeout(() => setErrorMessage(null), 7000);
     }
  }, []);


  // --- Effects ---
  // Effect for Initial Data Load (Connection Status) & Query Param Handling
  useEffect(() => {
    let isMounted = true;
    const queryParams = new URLSearchParams(location.search);
    const errorParam = queryParams.get('error');
    const connectedParam = queryParams.get('connected');
    let messageTimer: NodeJS.Timeout | null = null;

    // Handle messages from redirects first
    if (errorParam) {
      setErrorMessage(`Failed to connect Google Account: ${errorParam.replace(/_/g, ' ')}`);
      navigate(location.pathname, { replace: true });
      messageTimer = setTimeout(() => setErrorMessage(null), 7000);
    } else if (connectedParam === 'true') {
      setActionMessage("Google Account connected successfully!");
      navigate(location.pathname, { replace: true });
      messageTimer = setTimeout(() => setActionMessage(null), 5000);
    }

    // Fetch initial connection status from /me
    const fetchInitialStatus = async () => {
      if (!user || !isMounted) {
         if (isMounted) setIsLoadingConnectionStatus(false);
         return;
      }
      console.log("[Dashboard] Fetching initial connection status...");
      setIsLoadingConnectionStatus(true);
      try {
        const meResponse = await fetch('/api/v1/users/me', { credentials: 'include' });
        if (!isMounted) return;
        if (!meResponse.ok) {
            const errorData = await meResponse.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Failed to fetch user status');
        }
        const userData: FetchedUser = await meResponse.json();
        const connectedStatus = userData?.isGmailConnected || false;
        if (isMounted) { // Check mount status before setting state
            setIsAccountConnected(connectedStatus);
            setConnectedGoogleEmail(userData?.googleEmail || null);
            console.log("[Dashboard] Initial Connection status:", connectedStatus, "Google Email:", userData?.googleEmail);
        }
      } catch (error: unknown) {
        console.error("Failed to load initial user status:", error);
        if (isMounted) {
            const message = error instanceof Error ? error.message : 'Could not load user status.';
            setErrorMessage(message);
            setIsAccountConnected(false); // Assume not connected on error
        }
      } finally {
        if (isMounted) setIsLoadingConnectionStatus(false);
      }
    };

    fetchInitialStatus();

    // Cleanup
    return () => {
      isMounted = false;
      if (messageTimer) clearTimeout(messageTimer);
    };
  }, [user, location, navigate]); // Dependencies


  // Effect to Fetch Pending Tasks AFTER Connection Status is Known
  useEffect(() => {
    if (isAccountConnected === true) {
      fetchPendingApprovalTasks(); // Fetch when connection is confirmed
    } else if (isAccountConnected === false) {
        setPendingApprovalTasks([]); // Clear if disconnected
    }
    // If isAccountConnected is null (loading), do nothing here
  }, [isAccountConnected, fetchPendingApprovalTasks]);


  // --- TODO: Effect to Fetch Stats/Other Tasks ---
  useEffect(() => {
    if (isAccountConnected === true) {
      console.log("TODO: Fetch stats and other task types (recent/processing)");
      // --- MOCK DATA ---
      // Simulating a fetch delay for mock data
      const timer = setTimeout(() => {
          setStats({ totalAttempted: 5, successful: 3, failed: 1, emailsAvoidedEstimate: 150 });
          // setRecentTasks([...]); // Populate with mock recent tasks if needed
          // setProcessingTasks([...]); // Populate with mock processing tasks if needed
      }, 500);
      return () => clearTimeout(timer); // Cleanup timeout
      // --- END MOCK ---
    } else {
      // Clear data if not connected
      setStats(null);
      setRecentTasks([]);
      setProcessingTasks([]);
    }
  }, [isAccountConnected]);


  // --- Render Logic ---
  // Main loading state check (from App.tsx context) should prevent rendering if !user
  if (!user) return null;

  const noTasksSelected = selectedTaskIds.size === 0;

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-base-200 min-h-screen">
      {/* Welcome Header */}
      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neutral">Dashboard</h1>
      <p className="mb-6 text-lg text-neutral/80">Welcome back, {user.name}!</p>

      {/* Action/Error Messages */}
      {errorMessage && <div role="alert" className="alert alert-error mb-4 shadow-md"><ExclamationCircleIcon className="w-6 h-6 stroke-current shrink-0"/><span>{errorMessage}</span></div>}
      {actionMessage && <div role="alert" className="alert alert-success mb-4 shadow-md"><CheckCircleIcon className="w-6 h-6 stroke-current shrink-0"/><span>{actionMessage}</span></div>}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* --- Column 1: Connection, Scan, Pending Approvals --- */}
        <div className="lg:col-span-1 space-y-6">
          {/* Connection Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-lg font-semibold mb-3 flex items-center"><LinkIcon className="w-5 h-5 mr-2" /> Gmail Connection</h2>
              {isLoadingConnectionStatus ? (
                 <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
              ) : isAccountConnected ? (
                <div>
                  <p className="mb-4 text-success flex items-center break-all"><CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0"/> Connected as {connectedGoogleEmail || '(Google Email unavailable)'}</p>
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

          {/* Scan Initiation Card */}
          {isAccountConnected && ( // Only show if connected
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-lg font-semibold mb-3 flex items-center">
                        <MagnifyingGlassIcon className="w-5 h-5 mr-2"/> Find Subscriptions
                    </h2>
                    <p className="text-sm mb-4 text-base-content/80">
                        Scan your inbox to find potential subscriptions. Found items will appear below for your review.
                    </p>
                    <button
                        onClick={handleInitiateScan}
                        className={`btn btn-secondary w-full ${isScanning ? 'loading' : ''}`}
                        disabled={isScanning || isLoadingConnectionStatus || isAccountConnected === null}
                    >
                        {isScanning ? 'Scanning...' : 'Scan Inbox Now'}
                    </button>
                    <p className="text-xs text-base-content/70 mt-2">
                        Scanning may take a few minutes.
                    </p>
                </div>
            </div>
          )}

          {/* Pending Approval Card */}
          {isAccountConnected && ( // Only show if connected
             <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title text-lg font-semibold mb-3">Review Subscriptions ({pendingApprovalTasks.length})</h2>
                    {isLoadingPendingTasks ? (
                         <div className="flex justify-center items-center h-24"><span className="loading loading-dots loading-md"></span></div>
                    ) : pendingApprovalTasks.length === 0 ? (
                        <p className="text-sm text-base-content/70 py-4 text-center">No subscriptions found requiring approval. Try scanning your inbox.</p>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-base-content/80 mb-2">Select the subscriptions you want to automatically unsubscribe from:</p>
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-2 border rounded-md p-2 bg-base-200/30"> {/* Scrollable list */}
                                {pendingApprovalTasks.map(task => (
                                    <div key={task.id} className="flex items-center justify-between p-2 rounded bg-base-100 hover:bg-base-200/50">
                                        <label htmlFor={`task-${task.id}`} className="flex items-center cursor-pointer flex-grow mr-2 overflow-hidden">
                                            <input
                                                type="checkbox"
                                                id={`task-${task.id}`}
                                                checked={selectedTaskIds.has(task.id)}
                                                onChange={() => handleCheckboxChange(task.id)}
                                                className="checkbox checkbox-sm checkbox-primary mr-3 flex-shrink-0"
                                                disabled={isApprovingTasks}
                                            />
                                            <span className="text-sm truncate" title={task.senderEmail || 'Unknown Sender'}>
                                                {task.senderEmail || 'Unknown Sender'}
                                            </span>
                                        </label>
                                        {/* Optional: Link to the unsubscribe URL */}
                                        {task.url && (
                                            <a href={task.url} target="_blank" rel="noopener noreferrer" className="link link-hover text-xs flex-shrink-0 ml-2">View Link</a>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={handleApproveSelected}
                                className={`btn btn-success w-full mt-4 ${isApprovingTasks ? 'loading' : ''}`}
                                disabled={noTasksSelected || isApprovingTasks}
                            >
                                <PaperAirplaneIcon className="w-5 h-5 mr-2"/> Approve Selected ({selectedTaskIds.size})
                            </button>
                        </div>
                    )}
                </div>
             </div>
          )}
        </div> {/* End Column 1 */}

        {/* --- Column 2: Stats & Other Activity --- */}
        <div className="lg:col-span-2 space-y-6">
           {/* Stats Card (using mock data still) */}
           <div className="card bg-base-100 shadow-xl">
             <div className="card-body">
               <h2 className="card-title text-lg font-semibold mb-4 flex items-center"><ChartBarIcon className="w-5 h-5 mr-2" /> Your Detox Stats</h2>
               {isLoadingConnectionStatus ? ( /* ... Loading ... */ <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
               ) : isAccountConnected && stats ? ( /* ... Render Stats ... */
                 <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
                     <div className="stat"><div className="stat-title">Attempted</div><div className="stat-value text-primary">{stats.totalAttempted}</div></div>
                     <div className="stat"><div className="stat-title">Successful</div><div className="stat-value text-success">{stats.successful}</div></div>
                     <div className="stat"><div className="stat-title">Est. Emails Avoided</div><div className="stat-value">{stats.emailsAvoidedEstimate}+</div></div>
                 </div>
               ) : ( <p className="text-sm text-base-content/70">{!isAccountConnected ? 'Connect your account to see your stats.' : 'Loading stats...'}</p> )}
             </div>
           </div>

           {/* Task Overview Card (using mock data still for processing/recent) */}
           <div className="card bg-base-100 shadow-xl">
             <div className="card-body">
               <h2 className="card-title text-lg font-semibold mb-4">Other Task Activity</h2>
               {isLoadingConnectionStatus ? ( /* ... Loading ... */ <div className="flex justify-center items-center h-20"><span className="loading loading-dots loading-md"></span></div>
               ) : !isAccountConnected ? ( <p className="text-sm text-base-content/70">Connect your account to view task activity.</p>
               ) : (
                 <div className="space-y-4">
                   {/* TODO: Replace mock data with fetched processingTasks and recentTasks */}
                   {processingTasks.length > 0 && (
                     <div>
                       <h3 className="font-medium mb-2 flex items-center"><ClockIcon className="w-5 h-5 mr-2 text-info"/> Currently Processing</h3>
                       <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                         {processingTasks.map(task => <li key={task.id}>Processing: {task.senderEmail || task.url || 'Unknown'}...</li>)}
                       </ul>
                     </div>
                   )}
                    {recentTasks.length > 0 && (
                     <div>
                        <h3 className="font-medium mb-2">Last Few Updates</h3>
                            <ul className="text-sm space-y-2">
                                {recentTasks.map(task => (
                                <li key={task.id} className="flex items-center justify-between border-b border-base-300/50 pb-1 last:border-b-0">
                                    <span className="truncate mr-2" title={task.senderEmail || task.url}>{task.senderEmail || task.url || 'Unknown Target'}</span>
                                    <span className={`badge badge-sm ${task.status === 'success' ? 'badge-success' : task.status === 'failed' ? 'badge-error' : 'badge-ghost'}`}>{task.status}</span>
                                </li>
                                ))}
                            </ul>
                     </div>
                    )}
                   {(processingTasks.length === 0 && recentTasks.length === 0) && (
                     <p className="text-sm text-base-content/70">No other task activity to display currently.</p>
                   )}
                 </div>
               )}
             </div>
           </div>
        </div> {/* End Column 2 */}
      </div> {/* End Grid */}
    </div> // End Container
  );
}

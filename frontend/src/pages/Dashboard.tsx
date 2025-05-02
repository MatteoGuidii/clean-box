import { useAuth } from '@/context/useAuth';
import { useDashboard } from '@/features/dashboard/useDashboard';
import GmailConnectionCard from '@/features/dashboard/components/GmailConnectionCard';
import StatsCard from '@/features/dashboard/components/StatsCard';
import ActivityCard from '@/features/dashboard/components/ActivityCard';
import {
  ExclamationCircleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export default function Dashboard() {
  /* ------------------------------------------------------------------ */
  /* 1. Auth context                                                    */
  /* ------------------------------------------------------------------ */
  const { user } = useAuth();               //  user: User | null

  /* ------------------------------------------------------------------ */
  /* 2. Dashboard state (hook now accepts null)                         */
  /* ------------------------------------------------------------------ */
  const {
    isAccountConnected,
    stats,
    recentTasks,
    processingTasks,
    loading,
    error,
    action,
    connectGmail,
    disconnectGmail,
  } = useDashboard(user ?? undefined);

  /* ------------------------------------------------------------------ */
  /* 3. While Auth context still resolving                              */
  /* ------------------------------------------------------------------ */
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* 4. Main render                                                     */
  /* ------------------------------------------------------------------ */
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 bg-base-200 min-h-screen">
      {/* ------------------- Header ----------------------------------- */}
      <h1 className="text-3xl md:text-4xl font-bold mb-2 text-neutral">
        Dashboard
      </h1>
      <p className="mb-6 text-lg text-neutral/80">
        Welcome back, {user.name}!
      </p>

      {/* ---------------- Messages ------------------------------------ */}
      {error && (
        <div role="alert" className="alert alert-error mb-4 shadow-md">
          <ExclamationCircleIcon className="w-6 h-6 stroke-current shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {action && (
        <div role="alert" className="alert alert-success mb-4 shadow-md">
          <CheckCircleIcon className="w-6 h-6 stroke-current shrink-0" />
          <span>{action}</span>
        </div>
      )}

      {/* ---------------- Grid layout --------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ------------- Left column (connection card) ---------------- */}
        <div className="lg:col-span-1 space-y-6">
          <GmailConnectionCard
            isAccountConnected={isAccountConnected}
            googleEmail={user.googleEmail ?? undefined}
            loading={loading}
            connect={connectGmail}
            disconnect={disconnectGmail}
          />
        </div>

        {/* ------------- Right column (stats + activity) -------------- */}
        <div className="lg:col-span-2 space-y-6">
          <StatsCard
            stats={stats}
            isAccountConnected={isAccountConnected}
            loading={loading}
          />
          <ActivityCard
            recent={recentTasks}
            processing={processingTasks}
            isAccountConnected={isAccountConnected}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}

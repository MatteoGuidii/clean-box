// src/features/dashboard/components/ActivityCard.tsx
import { ClockIcon } from '@heroicons/react/24/outline';
import type { Task } from '@/types/cleanbox';

interface Props {
  recent: Task[];
  processing: Task[];
  isAccountConnected: boolean | null;
  loading: boolean;
}

export default function ActivityCard({
  recent,
  processing,
  isAccountConnected,
  loading,
}: Props) {
  /* ------------------------------------------------------------------ */
  /*  Render helpers                                                    */
  /* ------------------------------------------------------------------ */
  const nothingYet =
    !loading &&
    isAccountConnected &&
    processing.length === 0 &&
    recent.length === 0;

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-lg font-semibold mb-4">
          Recent Activity
        </h2>

        {/* ---------- global loading ---------- */}
        {loading && (
          <div className="flex justify-center items-center h-20">
            <span className="loading loading-dots loading-md" />
          </div>
        )}

        {/* ---------- not connected ---------- */}
        {!loading && !isAccountConnected && (
          <p className="text-sm text-base-content/70">
            Connect your account to view task activity.
          </p>
        )}

        {/* ---------- no tasks yet ---------- */}
        {nothingYet && (
          <p className="text-sm text-base-content/70">
            No task activity yet. Hit&nbsp;
            <span className="font-medium">“Scan now”</span> to begin!
          </p>
        )}

        {/* ---------- processing list ---------- */}
        {processing.length > 0 && (
          <div className="mb-4">
            <h3 className="font-medium mb-2 flex items-center">
              <ClockIcon className="w-5 h-5 mr-2 text-info" />
              Currently processing
            </h3>
            <ul className="list-disc list-inside pl-2 text-sm space-y-1">
              {processing.map(t => (
                <li key={t.id} className="truncate">
                  {t.url ?? 'Unknown'}…
                </li>
              ))}
            </ul>

            {/* simple indeterminate bar */}
            <progress className="progress progress-info w-full mt-3" />
          </div>
        )}

        {/* ---------- recent finished ---------- */}
        {recent.length > 0 && (
          <>
            <h3 className="font-medium mb-2">Last&nbsp;{recent.length}</h3>
            <ul className="text-sm space-y-2">
              {recent.map(t => (
                <li
                  key={t.id}
                  className="flex items-center justify-between border-b border-base-300/50 pb-1 last:border-b-0"
                >
                  <span className="truncate mr-2" title={t.url ?? ''}>
                    {t.sender ?? t.url ?? 'Unknown'}
                  </span>
                  <span
                    className={`badge badge-sm ${
                      t.status === 'success'
                        ? 'badge-success'
                        : t.status === 'failed'
                        ? 'badge-error'
                        : 'badge-ghost'
                    }`}
                  >
                    {t.status}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

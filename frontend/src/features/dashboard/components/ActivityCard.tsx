import { ClockIcon } from '@heroicons/react/24/outline';
import type { Task } from '@/types/cleanbox';

interface Props {
  recent: Task[];
  processing: Task[];
  isAccountConnected: boolean | null;
  loading: boolean;
}

export default function ActivityCard({ recent, processing, isAccountConnected, loading }: Props) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-lg font-semibold mb-4">Recent Activity</h2>

        {loading && isAccountConnected === null ? (
          <div className="flex justify-center items-center h-20">
            <span className="loading loading-dots loading-md"></span>
          </div>
        ) : !isAccountConnected ? (
          <p className="text-sm text-base-content/70">Connect your account to view task activity.</p>
        ) : (
          <div className="space-y-4">
            {processing.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 flex items-center">
                  <ClockIcon className="w-5 h-5 mr-2 text-info" /> Currently Processing
                </h3>
                <ul className="list-disc list-inside pl-2 text-sm space-y-1">
                  {processing.map(t => (
                    <li key={t.id}>Processing: {t.url ?? 'Unknown'}…</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-medium mb-2">Last Few Updates</h3>
              {recent.length > 0 ? (
                <ul className="text-sm space-y-2">
                  {recent.map(t => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between border-b border-base-300/50 pb-1 last:border-b-0"
                    >
                      <span className="truncate mr-2" title={t.url}>
                        {t.url ?? 'Unknown Target'}
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
              ) : (
                processing.length === 0 && (
                  <p className="text-sm text-base-content/70">No recent task activity to display.</p>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

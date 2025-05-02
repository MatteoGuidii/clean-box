import { ChartBarIcon } from '@heroicons/react/24/outline';
import type { AppStats } from '@/types/cleanbox';

interface Props {
  stats: AppStats | null;
  isAccountConnected: boolean | null;
  loading: boolean;
}

export default function StatsCard({ stats, isAccountConnected, loading }: Props) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-lg font-semibold mb-4 flex items-center">
          <ChartBarIcon className="w-5 h-5 mr-2" /> Your Detox Stats
        </h2>

        {loading && isAccountConnected === null ? (
          <div className="flex justify-center items-center h-20">
            <span className="loading loading-dots loading-md"></span>
          </div>
        ) : isAccountConnected && stats ? (
          <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
            <div className="stat">
              <div className="stat-title">Attempted</div>
              <div className="stat-value text-primary">{stats.totalAttempted}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Successful</div>
              <div className="stat-value text-success">{stats.successful}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Est. Emails Avoided</div>
              <div className="stat-value">{stats.emailsAvoidedEstimate}+</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-base-content/70">
            {isAccountConnected === false ? 'Connect your account to see your stats.' : 'Loading stats…'}
          </p>
        )}
      </div>
    </div>
  );
}

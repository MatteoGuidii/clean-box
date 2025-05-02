import { CheckCircleIcon, ExclamationCircleIcon, InboxArrowDownIcon, LinkIcon } from '@heroicons/react/24/outline';

interface Props {
  isAccountConnected: boolean | null;
  googleEmail?: string | null;
  loading: boolean;
  connect(): void;
  disconnect(): Promise<void>;
}

export default function GmailConnectionCard({
  isAccountConnected,
  googleEmail,
  loading,
  connect,
  disconnect,
}: Props) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-lg font-semibold mb-3 flex items-center">
          <LinkIcon className="w-5 h-5 mr-2" /> Gmail Connection
        </h2>

        {loading || isAccountConnected === null ? (
          <div className="flex justify-center items-center h-20">
            <span className="loading loading-dots loading-md"></span>
          </div>
        ) : isAccountConnected ? (
          <>
            <p className="mb-4 text-success flex items-center">
              <CheckCircleIcon className="w-5 h-5 mr-2" /> Connected as {googleEmail ?? '(unknown)'}
            </p>
            <button onClick={disconnect} className="btn btn-sm btn-outline btn-warning w-full">
              Disconnect Account
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-warning flex items-center">
              <ExclamationCircleIcon className="w-5 h-5 mr-2" /> Account not connected.
            </p>
            <button onClick={connect} className="btn btn-primary w-full mb-2">
              <InboxArrowDownIcon className="w-5 h-5 mr-2" /> Connect Gmail
            </button>
            <p className="text-xs text-base-content/70 mt-1">
              Connect to automatically find and manage unsubscribe links.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

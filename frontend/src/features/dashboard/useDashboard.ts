import { useState, useEffect } from 'react';
import type { Task, AppStats, FetchedUser } from '@/types/cleanbox';

interface UseDashboardResult {
  isAccountConnected: boolean | null;
  stats: AppStats | null;
  recentTasks: Task[];
  processingTasks: Task[];
  loading: boolean;
  error: string | null;
  action: string | null;
  connectGmail(): void;
  disconnectGmail(): Promise<void>;
}

/** Safely turn an unknown error into a readable string */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unexpected error';
}

/**
 * Encapsulates all async + state logic for the Dashboard page.
 */
export function useDashboard(
  user: FetchedUser | undefined,
): UseDashboardResult {
  const [isAccountConnected, setIsAccountConnected] = useState<boolean | null>(
    null,
  );
  const [stats, setStats] = useState<AppStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  /* ---------- data fetch ---------- */
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);

        /* ----- /me ----- */
        const res = await fetch('/api/v1/users/me', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch user status');
        const me: FetchedUser = await res.json();
        if (!alive) return;

        const connected = me.isGmailConnected ?? false;
        setIsAccountConnected(connected);

        if (connected) {
          /* ----- stats / tasks (mock) ----- */
          await new Promise<void>(r => setTimeout(r, 400)); // TODO real endpoint
          if (!alive) return;

          setStats({
            totalAttempted: 5,
            successful: 3,
            failed: 1,
            emailsAvoidedEstimate: 150,
          });
          setRecentTasks([
            {
              id: '1',
              url: 'newsletter@example.com',
              status: 'success',
              createdAt: '',
              updatedAt: '',
            },
            {
              id: '2',
              url: 'spam@example.net',
              status: 'failed',
              createdAt: '',
              updatedAt: '',
            },
          ]);
          setProcessingTasks([
            {
              id: '3',
              url: 'marketing@example.org',
              status: 'processing',
              createdAt: '',
              updatedAt: '',
            },
          ]);
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  /* ---------- actions ---------- */

  const connectGmail = () => {
    setError(null);
    window.location.href = '/api/v1/connect/google';
  };

  const disconnectGmail = async () => {
    if (!window.confirm('Disconnect Google Account?')) return;
    setError(null);

    try {
      const res = await fetch('/api/v1/disconnect/google', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to disconnect account');

      setIsAccountConnected(false);
      setStats(null);
      setRecentTasks([]);
      setProcessingTasks([]);
      setAction('Google Account disconnected successfully.');
      setTimeout(() => setAction(null), 5_000);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      setTimeout(() => setError(null), 7_000);
    }
  };

  return {
    isAccountConnected,
    stats,
    recentTasks,
    processingTasks,
    loading,
    error,
    action,
    connectGmail,
    disconnectGmail,
  };
}

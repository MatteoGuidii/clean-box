import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, AppStats, FetchedUser } from '@/types/cleanbox';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
export interface UseDashboardResult {
  isAccountConnected: boolean | null;
  stats: AppStats | null;
  recentTasks: Task[];
  processingTasks: Task[];
  loading: boolean;
  scanning: boolean;
  error: string | null;
  action: string | null;
  scanNow(): Promise<void>;
  connectGmail(): void;
  disconnectGmail(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unexpected error';
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */
export function useDashboard(user: FetchedUser | null): UseDashboardResult {
  const [isAccountConnected, setIsAccountConnected] =
    useState<boolean | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [processingTasks, setProcessingTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  /* ---------- fetch stats + tasks helper ---------- */
  const refreshData = useCallback(async () => {
    try {
      /* stats (ignore missing endpoint while BE not ready) */
      try {
        const s = await fetchJSON<AppStats>('/api/v1/stats');
        setStats(s);
      } catch (err) {
        if ((err as Error).message !== 'Not Found') throw err;
      }

      /* tasks (ignore missing endpoint) */
      try {
        const t = await fetchJSON<{ processing: Task[]; recent: Task[] }>(
          '/api/v1/tasks?limit=50',
        );
        setProcessingTasks(t.processing);
        setRecentTasks(t.recent);
      } catch (err) {
        if ((err as Error).message !== 'Not Found') throw err;
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  /* ---------- initial load + polling ---------- */
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const me = await fetchJSON<FetchedUser>('/api/v1/users/me');
        if (!alive) return;

        // connected if activeGoogleAccount exists
        const connected = !!me.activeGoogleAccount;
        setIsAccountConnected(connected);

        if (connected) {
          await refreshData();
          // start polling every 10 s
          pollRef.current = setInterval(refreshData, 10_000);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user, refreshData]);

  /* ---------- scanNow ---------- */
  const scanNow = useCallback(async () => {
    setError(null);
    setAction(null);
    setScanning(true);
    try {
      const { created } = await fetchJSON<{ created: number }>(
        '/api/v1/scan',
        { method: 'POST' },
      );
      setAction(
        created
          ? `Created ${created} unsubscribe task${created > 1 ? 's' : ''}.`
          : 'No new subscriptions found.',
      );
      await refreshData(); // immediate refresh after scan
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setScanning(false);
      // clear action msg after 5 s
      setTimeout(() => setAction(null), 5_000);
    }
  }, [refreshData]);

  /* ---------- connect / disconnect ---------- */
  const connectGmail = () => {
    setError(null);
    window.location.href = '/api/v1/connect/google';
  };

  const disconnectGmail = useCallback(async () => {
    if (!window.confirm('Disconnect Google Account?')) return;
    setError(null);
    try {
      await fetchJSON('/api/v1/disconnect/google', { method: 'POST' });
      setIsAccountConnected(false);
      setStats(null);
      setRecentTasks([]);
      setProcessingTasks([]);
      setAction('Google Account disconnected.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, []);

  /* ---------- return ---------- */
  return {
    isAccountConnected,
    stats,
    recentTasks,
    processingTasks,
    loading,
    scanning,
    error,
    action,
    scanNow,
    connectGmail,
    disconnectGmail,
  };
}

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, errorMessage } from '../services/jobsApi';
import { useAppForeground } from './useAppForeground';

export interface RemoteData<T> {
  data: T | null;
  /** First load in progress (nothing to show yet). */
  loading: boolean;
  /** Pull-to-refresh in progress. */
  refreshing: boolean;
  error: string | null;
  offline: boolean;
  refresh(): Promise<void>;
  /** Replace the data after an action returned the updated value. */
  setData(value: T): void;
}

/**
 * Loads server data and reloads it whenever the screen comes into view, the
 * app returns to the foreground, or `deps` change. Only the newest load
 * updates the screen, so fast filter changes never show stale results.
 */
export function useRemoteData<T>(load: () => Promise<T>, deps: unknown[]): RemoteData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const latest = useRef(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async (pull: boolean) => {
    const id = ++latest.current;
    if (pull) setRefreshing(true);
    try {
      const value = await loadRef.current();
      if (id === latest.current) {
        setData(value);
        setError(null);
        setOffline(false);
      }
    } catch (cause) {
      if (id === latest.current) {
        setError(errorMessage(cause));
        setOffline(cause instanceof ApiError && cause.offline);
      }
    } finally {
      if (id === latest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  // Reload when the screen is focused, and again whenever a dependency changes.
  const depsKey = JSON.stringify(deps);
  useFocusEffect(
    useCallback(() => {
      void run(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [run, depsKey]),
  );
  useAppForeground(() => void run(false));

  const refresh = useCallback(() => run(true), [run]);
  return { data, loading, refreshing, error, offline, refresh, setData };
}

import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Calls `onForeground` when the app comes back from the background, e.g. to
 * reload a list that may be stale (or whose request was cut off) while the
 * phone was doing something else. Not called on the first render.
 */
export function useAppForeground(onForeground: () => void): void {
  const callback = useRef(onForeground);
  useEffect(() => {
    callback.current = onForeground;
  }, [onForeground]);

  useEffect(() => {
    let previous: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', (next) => {
      if (previous !== 'active' && next === 'active') {
        callback.current();
      }
      previous = next;
    });
    return () => subscription.remove();
  }, []);
}

import type { Session as AuthSession } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Profile } from '../core/jobs';
import { jobsApi, errorMessage } from '../services/jobsApi';
import { unregisterRequestNotifications } from '../services/pushNotifications';
import { getSupabaseClient } from '../supabase/client';

export type AuthStatus = 'loading' | 'signed-out' | 'authenticated';

interface SessionContextValue {
  status: AuthStatus;
  /** The team member's name and role, known once signed in. */
  profile: Profile | null;
  /** Shown on the sign-in screen, e.g. "no access yet". */
  error: string | null;
  signIn(email: string, password: string): Promise<void>;
  /** Creates the login. Works only for emails the admin has added to the team. */
  signUp(email: string, password: string): Promise<'signed-in' | 'confirm-email'>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Signed in with Supabase: check they are on the team. */
  const loadProfile = useCallback(async (session: AuthSession | null) => {
    if (!session) {
      setProfile(null);
      setStatus('signed-out');
      return;
    }
    try {
      setProfile(await jobsApi.profile());
      setError(null);
      setStatus('authenticated');
    } catch (cause) {
      const client = await getSupabaseClient();
      const offline = cause instanceof Error && 'offline' in cause && cause.offline;
      if (!offline) {
        // Not on the team (or removed): sign out so they are not stuck.
        await client.auth.signOut().catch(() => undefined);
      }
      setProfile(null);
      setError(errorMessage(cause));
      setStatus('signed-out');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const client = await getSupabaseClient();
        const { data } = await client.auth.getSession();
        if (active) await loadProfile(data.session);
      } catch (cause) {
        if (active) {
          setError(errorMessage(cause));
          setStatus('signed-out');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const client = await getSupabaseClient();
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        throw new Error(
          /invalid login/i.test(authError.message)
            ? 'Wrong email or password.'
            : authError.message,
        );
      }
      await loadProfile(data.session);
    },
    [loadProfile],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const client = await getSupabaseClient();
      const { data, error: authError } = await client.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) {
        throw new Error(authError.message);
      }
      if (!data.session) {
        return 'confirm-email';
      }
      await loadProfile(data.session);
      return 'signed-in';
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    const client = await getSupabaseClient();
    await unregisterRequestNotifications(client).catch(() => undefined);
    await client.auth.signOut().catch(() => undefined);
    setProfile(null);
    setError(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ status, profile, error, signIn, signUp, signOut }),
    [status, profile, error, signIn, signUp, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider.');
  }
  return context;
}

/** The signed-in profile; only for screens behind the sign-in guard. */
export function useProfile(): Profile {
  const { profile } = useSession();
  if (!profile) {
    throw new Error('Not signed in.');
  }
  return profile;
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { getSupabaseConfig } from '../config/supabase';
import { createDeviceSessionStorage } from '../services/deviceSessionStorage';
import { createFetchWithTimeout } from './fetchWithTimeout';

let clientPromise: Promise<SupabaseClient> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { url, anonKey } = getSupabaseConfig();
      const client = createClient(url, anonKey, {
        auth: {
          storage: createDeviceSessionStorage(),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
        // A request cut off while the app was in the background must not hang.
        global: { fetch: createFetchWithTimeout() },
      });

      // Only refresh tokens while the app is in the foreground; timers do not
      // run reliably in the background on mobile.
      if (Platform.OS !== 'web') {
        AppState.addEventListener('change', (state) => {
          if (state === 'active') {
            void client.auth.startAutoRefresh();
          } else {
            void client.auth.stopAutoRefresh();
          }
        });
      }

      return client;
    })().catch((cause: unknown) => {
      clientPromise = null;
      throw cause;
    });
  }
  return clientPromise;
}

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  createChunkedStorage,
  createMemorySessionStorage,
  type SessionStorage,
} from './sessionStorage';

function createSecureStoreStorage(): SessionStorage {
  // Supabase sessions regularly exceed the ~2KB keystore entry limit, so every
  // value is transparently chunked.
  return createChunkedStorage({
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  });
}

function createWebStorage(): SessionStorage {
  const fallback = createMemorySessionStorage();
  const storage = (globalThis as { localStorage?: Storage }).localStorage;
  if (!storage) {
    return fallback;
  }

  return {
    async getItem(key: string): Promise<string | null> {
      try {
        return storage.getItem(key);
      } catch {
        return fallback.getItem(key);
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        storage.setItem(key, value);
      } catch {
        await fallback.setItem(key, value);
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        storage.removeItem(key);
      } catch {
        await fallback.removeItem(key);
      }
    },
  };
}

export function createDeviceSessionStorage(): SessionStorage {
  if (Platform.OS === 'web') {
    return createWebStorage();
  }
  return createSecureStoreStorage();
}
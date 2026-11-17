import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * "New job request" notifications. The database sends them (Expo's free
 * push service) when a customer submits a request on the website; the app
 * only registers this phone and opens the request when it is tapped.
 */

/** Must match the channelId the database puts in each message. */
export const REQUEST_CHANNEL_ID = 'jobs';

let registeredToken: string | null = null;

/** Show notifications as a banner even while the app is open. */
export function configureNotificationDisplay(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks for permission (Android 13+ shows the prompt once a channel exists) and
 * saves this phone's push token for the signed-in team member. Never throws:
 * without permission or Firebase set up, the app simply gets no notifications.
 */
export async function registerForRequestNotifications(client: SupabaseClient): Promise<string | null> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(REQUEST_CHANNEL_ID, {
        name: 'New Job Requests',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    const { error } = await client.rpc('register_push_token', { p_token: token });
    if (error) {
      console.warn('[PUSH:REGISTER_FAILED]', error.message);
      return null;
    }
    registeredToken = token;
    return token;
  } catch (cause) {
    console.warn('[PUSH:UNAVAILABLE]', cause instanceof Error ? cause.message : String(cause));
    return null;
  }
}

/** On sign-out: this phone stops receiving request notifications. */
export async function unregisterRequestNotifications(client: SupabaseClient): Promise<void> {
  if (!registeredToken) {
    return;
  }
  const token = registeredToken;
  registeredToken = null;
  try {
    await client.rpc('unregister_push_token', { p_token: token });
  } catch {
    // Best effort: the token is also dropped when another account registers it.
  }
}

/** Job id carried in a tapped notification, if any. */
export function jobIdFromNotification(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const value = response?.notification.request.content.data?.jobId;
  return typeof value === 'string' && value !== '' ? value : null;
}

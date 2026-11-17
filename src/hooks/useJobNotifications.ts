import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSession } from '../context/SessionContext';
import { jobIdFromNotification, registerForRequestNotifications } from '../services/pushNotifications';
import { getSupabaseClient } from '../supabase/client';

/**
 * Once a team member is in the app: register this phone for job
 * notifications (new website requests for admins, assigned jobs for
 * technicians), and open the job when one is tapped.
 */
export function useJobNotifications(): void {
  const { profile } = useSession();
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }
    void getSupabaseClient()
      .then((client) => registerForRequestNotifications(client))
      .catch(() => undefined);
  }, [profile]);

  useEffect(() => {
    const jobId = jobIdFromNotification(lastResponse);
    const key = lastResponse?.notification.request.identifier ?? null;
    if (!profile || !jobId || key === handled.current) {
      return;
    }
    handled.current = key;
    router.push({ pathname: '/job/[id]', params: { id: jobId } });
  }, [lastResponse, profile]);
}

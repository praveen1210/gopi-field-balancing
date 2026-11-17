import { router } from 'expo-router';

/**
 * After saving a job form: back to the job. Falls back to opening the job when
 * the form was the first screen (opened from a link or notification).
 */
export function backToJob(id: string): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace({ pathname: '/job/[id]', params: { id } });
  }
}

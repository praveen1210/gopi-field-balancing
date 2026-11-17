import { Stack } from 'expo-router';
import React from 'react';

import { useJobNotifications } from '@/hooks/useJobNotifications';

export default function AppLayout() {
  useJobNotifications();
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="job/new" options={{ title: 'New job' }} />
      <Stack.Screen name="job/[id]/index" options={{ title: 'Job' }} />
      <Stack.Screen name="job/[id]/schedule" options={{ title: 'Schedule visit' }} />
      <Stack.Screen name="job/[id]/complete" options={{ title: 'Complete job' }} />
      <Stack.Screen name="job/[id]/pay" options={{ title: 'Payment received' }} />
      <Stack.Screen name="job/[id]/edit" options={{ title: 'Edit details' }} />
    </Stack>
  );
}

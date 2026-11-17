import { router } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native';

import { JobDetailsForm } from '@/components/JobDetailsForm';
import { useToast } from '@/components/ui/Toast';
import { emptyDetails } from '@/core/jobs';
import { jobsApi } from '@/services/jobsApi';
import { makeStyles, spacing } from '@/theme';

/** A job taken over the phone; it starts as a new request, ready to schedule. */
export default function NewJobScreen() {
  const styles = useStyles();
  const toast = useToast();
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <JobDetailsForm
        initial={emptyDetails()}
        submitLabel="Save job"
        onSubmit={async (input) => {
          const job = await jobsApi.create(input);
          toast.show(`${job.reference} saved`, 'success');
          router.replace({ pathname: '/job/[id]', params: { id: job.id } });
        }}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: { padding: 16, paddingBottom: spacing.xxl },
}));

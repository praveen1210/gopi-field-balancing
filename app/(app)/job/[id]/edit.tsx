import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView } from 'react-native';

import { JobDetailsForm } from '@/components/JobDetailsForm';
import { StateView } from '@/components/ui/StateView';
import { useToast } from '@/components/ui/Toast';
import { detailsFromJob } from '@/core/jobs';
import { useRemoteData } from '@/hooks/useRemoteData';
import { jobsApi } from '@/services/jobsApi';
import { makeStyles, spacing } from '@/theme';
import { backToJob } from '@/utils/navigation';

/** Fix the customer or machine details of a job. Admin only. */
export default function EditJobScreen() {
  const styles = useStyles();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: job, loading, error, offline, refresh } = useRemoteData(() => jobsApi.get(id), [id]);

  if (loading && !job) return <StateView kind="loading" />;
  if (!job) return <StateView kind={offline ? 'offline' : 'error'} message={error ?? undefined} onRetry={refresh} />;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <JobDetailsForm
        key={job.updated_at}
        initial={detailsFromJob(job)}
        submitLabel="Save changes"
        onSubmit={async (input) => {
          await jobsApi.updateDetails(job.id, input);
          toast.show('Details saved', 'success');
          backToJob(job.id);
        }}
      />
    </ScrollView>
  );
}

const useStyles = makeStyles(() => ({
  content: { padding: 16, paddingBottom: spacing.xxl },
}));

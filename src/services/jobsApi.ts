import type { SupabaseClient } from '@supabase/supabase-js';

import type { Job, JobCounts, JobDetailsInput, Profile, StaffMember, StaffRole } from '../core/jobs';
import { getSupabaseClient } from '../supabase/client';

/**
 * Every read and change goes through a database function (the tables are not
 * reachable directly). Errors come back with messages written for people,
 * e.g. "Only the admin can do this.", so screens show them as they are.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly offline = false,
  ) {
    super(message);
  }
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let client: SupabaseClient;
  try {
    client = await getSupabaseClient();
  } catch (cause) {
    throw new ApiError(cause instanceof Error ? cause.message : 'The app is not set up.');
  }
  try {
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      throw new ApiError(error.message);
    }
    return data as T;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    // fetch failures (no signal, timeout) surface as TypeError.
    throw new ApiError('No internet connection. Check your signal and try again.', true);
  }
}

export interface JobFilter {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
}

function detailsPayload(input: JobDetailsInput) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value.trim()]));
}

export const jobsApi = {
  profile: () => call<Profile>('get_my_profile'),
  list: (filter: JobFilter = {}) =>
    call<Job[]>('list_jobs', {
      p_status: filter.status ?? null,
      p_from: filter.from ?? null,
      p_to: filter.to ?? null,
      p_search: filter.search?.trim() || null,
    }),
  get: (id: string) => call<Job>('get_job', { p_id: id }),
  counts: () => call<JobCounts>('job_counts'),
  create: (input: JobDetailsInput) => call<Job>('create_job', { p_job: detailsPayload(input) }),
  updateDetails: (id: string, input: JobDetailsInput) =>
    call<Job>('update_job_details', { p_id: id, p_job: detailsPayload(input) }),
  schedule: (id: string, scheduledAt: Date, assignedTo: string, note: string) =>
    call<Job>('schedule_job', {
      p_id: id,
      p_scheduled_at: scheduledAt.toISOString(),
      p_assigned_to: assignedTo,
      p_note: note.trim() || null,
    }),
  start: (id: string) => call<Job>('start_job', { p_id: id }),
  complete: (
    id: string,
    result: {
      vibration_before: string;
      vibration_after: string;
      balance_grade: string;
      correction_details: string;
      work_summary: string;
      amount: string;
    },
  ) => call<Job>('complete_job', { p_id: id, p_result: result }),
  markPaid: (id: string, amount: number, mode: string) =>
    call<Job>('mark_job_paid', { p_id: id, p_amount: amount, p_payment_mode: mode }),
  cancel: (id: string, reason: string) => call<Job>('cancel_job', { p_id: id, p_reason: reason }),
  reopen: (id: string) => call<Job>('reopen_job', { p_id: id }),
  addNote: (id: string, note: string) => call<Job>('add_job_note', { p_id: id, p_note: note }),
  staff: () => call<StaffMember[]>('list_staff'),
  addStaff: (email: string, name: string, phone: string, role: StaffRole) =>
    call<StaffMember[]>('add_staff', {
      p_email: email,
      p_name: name,
      p_phone: phone.trim() || null,
      p_role: role,
    }),
  setStaffActive: (id: string, active: boolean) =>
    call<StaffMember[]>('set_staff_active', { p_id: id, p_active: active }),
};

export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong.';
}

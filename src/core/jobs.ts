/**
 * Jobs as the database returns them (see supabase/migrations), plus the
 * status flow and display helpers shared by every screen.
 */

export type JobStatus = 'new' | 'scheduled' | 'in_progress' | 'completed' | 'paid' | 'cancelled';
export type StaffRole = 'admin' | 'technician';

export interface JobEvent {
  event: 'created' | 'updated' | 'scheduled' | 'rescheduled' | 'started' | 'completed' | 'paid' | 'cancelled' | 'reopened' | 'note';
  note: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  reference: string;
  status: JobStatus;
  source: 'website' | 'manual';
  customer_name: string;
  company: string | null;
  phone: string;
  email: string | null;
  location: string;
  machine_type: string;
  quantity: number;
  rpm: number | null;
  power: string | null;
  rotor_weight: string | null;
  rotor_diameter: string | null;
  mounting: string | null;
  brand_model: string | null;
  symptoms: string[];
  vibration_reading: string | null;
  service: string | null;
  notes: string | null;
  preferred_date: string | null;
  urgency: string | null;
  scheduled_at: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  started_at: string | null;
  completed_at: string | null;
  vibration_before: string | null;
  vibration_after: string | null;
  balance_grade: string | null;
  correction_details: string | null;
  work_summary: string | null;
  /** Admins only; technicians never receive money fields. */
  amount?: number | null;
  payment_mode?: string | null;
  paid_at: string | null;
  cancelled_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Scheduled day, else preferred day, else the day it came in (YYYY-MM-DD, India time). */
  job_date: string;
  events?: JobEvent[];
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  active: boolean;
  signed_up: boolean;
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  phone: string | null;
}

export interface JobCounts {
  new: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  today: number;
  unpaid_amount: number | null;
}

/** Editable customer and machine fields (new job / edit details). */
export interface JobDetailsInput {
  customer_name: string;
  company: string;
  phone: string;
  email: string;
  location: string;
  machine_type: string;
  quantity: string;
  rpm: string;
  power: string;
  rotor_weight: string;
  rotor_diameter: string;
  mounting: string;
  brand_model: string;
  vibration_reading: string;
  service: string;
  notes: string;
  urgency: string;
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  new: 'New request',
  scheduled: 'Scheduled',
  in_progress: 'On site',
  completed: 'Completed',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

/** Order of the normal flow, for the progress strip. */
export const STATUS_FLOW: JobStatus[] = ['new', 'scheduled', 'in_progress', 'completed', 'paid'];

export const EVENT_LABEL: Record<JobEvent['event'], string> = {
  created: 'Request received',
  updated: 'Details edited',
  scheduled: 'Scheduled',
  rescheduled: 'Rescheduled',
  started: 'Work started',
  completed: 'Completed',
  paid: 'Payment received',
  cancelled: 'Cancelled',
  reopened: 'Reopened',
  note: 'Note',
};

export const MACHINE_TYPES = [
  'Industrial fan / blower',
  'ID / FD fan',
  'Cooling tower fan',
  'Electric motor',
  'Pump',
  'Compressor',
  'Pulley / flywheel',
  'Roll / roller',
  'Crusher / pulverizer / hammer mill',
  'Centrifuge / decanter',
  'Turbine',
  'Other',
];

export const URGENCY_OPTIONS = [
  'Normal (within a week)',
  'Soon (2–3 days)',
  'Emergency (machine down)',
  'Planned shutdown',
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank transfer', 'Cheque'];

export const BALANCE_GRADES = ['G 16', 'G 6.3', 'G 2.5', 'G 1'];

export type JobAction = 'schedule' | 'reschedule' | 'start' | 'complete' | 'pay' | 'cancel' | 'reopen' | 'edit';

/** What the signed-in person may do next with this job. */
export function availableActions(job: Pick<Job, 'status'>, role: StaffRole): JobAction[] {
  const admin = role === 'admin';
  switch (job.status) {
    case 'new':
      return admin ? ['schedule', 'edit', 'cancel'] : [];
    case 'scheduled':
      return admin ? ['start', 'complete', 'reschedule', 'edit', 'cancel'] : ['start', 'complete'];
    case 'in_progress':
      return admin ? ['complete', 'edit', 'cancel'] : ['complete'];
    case 'completed':
      return admin ? ['pay', 'edit'] : [];
    case 'cancelled':
      return admin ? ['reopen'] : [];
    default:
      return [];
  }
}

export function isUrgent(job: Pick<Job, 'urgency' | 'status'>): boolean {
  return job.status === 'new' && /emergency/i.test(job.urgency ?? '');
}

export function emptyDetails(): JobDetailsInput {
  return {
    customer_name: '',
    company: '',
    phone: '',
    email: '',
    location: '',
    machine_type: '',
    quantity: '1',
    rpm: '',
    power: '',
    rotor_weight: '',
    rotor_diameter: '',
    mounting: '',
    brand_model: '',
    vibration_reading: '',
    service: 'Field balancing',
    notes: '',
    urgency: URGENCY_OPTIONS[0],
  };
}

export function detailsFromJob(job: Job): JobDetailsInput {
  const text = (value: string | number | null | undefined) => (value == null ? '' : String(value));
  return {
    customer_name: job.customer_name,
    company: text(job.company),
    phone: job.phone,
    email: text(job.email),
    location: job.location,
    machine_type: job.machine_type,
    quantity: String(job.quantity),
    rpm: text(job.rpm),
    power: text(job.power),
    rotor_weight: text(job.rotor_weight),
    rotor_diameter: text(job.rotor_diameter),
    mounting: text(job.mounting),
    brand_model: text(job.brand_model),
    vibration_reading: text(job.vibration_reading),
    service: text(job.service),
    notes: text(job.notes),
    urgency: text(job.urgency),
  };
}

/** First problem with the form, or null when it can be saved. */
export function validateDetails(input: JobDetailsInput): string | null {
  if (!input.customer_name.trim()) return 'Enter the customer name.';
  if (!/^\+?[0-9 -]{8,16}$/.test(input.phone.trim())) return 'Enter a valid phone number.';
  if (!input.location.trim()) return 'Enter the site address or city.';
  if (!input.machine_type.trim()) return 'Choose the machine type.';
  if (input.quantity.trim() && !/^\d{1,3}$/.test(input.quantity.trim())) return 'Quantity must be a number.';
  if (input.rpm.trim() && !/^\d{1,6}$/.test(input.rpm.trim())) return 'RPM must be a number.';
  return null;
}

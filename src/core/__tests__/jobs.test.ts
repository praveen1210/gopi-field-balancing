import { describe, expect, it } from '@jest/globals';

import { availableActions, emptyDetails, isUrgent, validateDetails } from '../jobs';

describe('availableActions', () => {
  it('lets the admin schedule, edit or cancel a new request', () => {
    expect(availableActions({ status: 'new' }, 'admin')).toEqual(['schedule', 'edit', 'cancel']);
  });

  it('lets a technician only start and complete their scheduled job', () => {
    expect(availableActions({ status: 'scheduled' }, 'technician')).toEqual(['start', 'complete']);
    expect(availableActions({ status: 'new' }, 'technician')).toEqual([]);
    expect(availableActions({ status: 'completed' }, 'technician')).toEqual([]);
  });

  it('only allows payment after completion, and nothing after payment', () => {
    expect(availableActions({ status: 'completed' }, 'admin')).toContain('pay');
    expect(availableActions({ status: 'scheduled' }, 'admin')).not.toContain('pay');
    expect(availableActions({ status: 'paid' }, 'admin')).toEqual([]);
  });

  it('reopens cancelled jobs', () => {
    expect(availableActions({ status: 'cancelled' }, 'admin')).toEqual(['reopen']);
  });
});

describe('validateDetails', () => {
  const valid = { ...emptyDetails(), customer_name: 'Kumar', phone: '98765 43210', location: 'Erode', machine_type: 'Pump' };

  it('accepts a complete form', () => {
    expect(validateDetails(valid)).toBeNull();
  });

  it.each([
    [{ customer_name: ' ' }, 'Enter the customer name.'],
    [{ phone: '123' }, 'Enter a valid phone number.'],
    [{ location: '' }, 'Enter the site address or city.'],
    [{ machine_type: '' }, 'Choose the machine type.'],
    [{ rpm: '14x0' }, 'RPM must be a number.'],
  ])('rejects %o', (change, message) => {
    expect(validateDetails({ ...valid, ...change })).toBe(message);
  });
});

it('flags emergencies only while the request is new', () => {
  expect(isUrgent({ status: 'new', urgency: 'Emergency (machine down)' })).toBe(true);
  expect(isUrgent({ status: 'scheduled', urgency: 'Emergency (machine down)' })).toBe(false);
  expect(isUrgent({ status: 'new', urgency: 'Normal (within a week)' })).toBe(false);
});

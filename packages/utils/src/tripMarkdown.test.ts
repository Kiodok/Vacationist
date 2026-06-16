import { describe, it, expect, beforeAll } from 'vitest';
import { generateTripMarkdown } from './tripMarkdown';
import { initDayjs } from './dayjs';
import type { Trip, Activity, Accommodation } from '@vacationist/types';

beforeAll(() => initDayjs());

const baseTrip: Trip & { member_count?: number } = {
  id: 'trip1',
  title: 'Croatia 2026',
  description: 'Sun and sea.',
  start_date: '2026-07-01',
  end_date: '2026-07-10',
  budget_per_person: 500,
  base_currency: 'EUR',
  timezone: 'Europe/Zagreb',
  status: 'planning',
  created_by: 'u1',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  deleted_at: null,
  member_count: 3,
};

const members = [
  { user_id: 'u1', role: 'organizer', user: { name: 'Alice' } },
  { user_id: 'u2', role: 'participant', user: { name: 'Bob' } },
];

const activity: Activity = {
  id: 'a1',
  trip_id: 'trip1',
  title: 'Kayaking',
  description: 'Sea kayaking tour',
  category: 'Sport',
  cost_estimate: 30,
  activity_date: '2026-07-03',
  start_time: '09:00:00',
  end_time: '12:00:00',
  external_url: null,
  maps_url: null,
  status: 'planned',
  voting_open: false,
  auto_close: false,
  reservation_required: false,
  created_by: 'u1',
  created_at: '2026-01-01',
  deleted_at: null,
};

const accommodation: Accommodation = {
  id: 'ac1',
  trip_id: 'trip1',
  title: 'Hotel Split',
  description: null,
  price_total: 900,
  external_url: 'https://example.com',
  notes: null,
  status: 'booked',
  voting_open: false,
  auto_close: false,
  check_in_date: '2026-07-01',
  check_out_date: '2026-07-10',
  created_by: 'u1',
  created_at: '2026-01-01',
  deleted_at: null,
};

const empty = {
  flights: [],
  vehicles: [],
  rentals: [],
  shoppingLists: [],
  shoppingItems: [],
  notes: [],
};

describe('generateTripMarkdown', () => {
  it('includes trip header with title, dates, and members', () => {
    const md = generateTripMarkdown(
      { trip: baseTrip, members, activities: [], accommodations: [], ...empty },
      { includeExpenses: false },
    );

    expect(md).toContain('# Croatia 2026');
    expect(md).toContain('Jul 1, 2026 – Jul 10, 2026');
    expect(md).toContain('10 days');
    expect(md).toContain('**Members:** 3');
    expect(md).toContain('**Currency:** EUR');
  });

  it('includes members section', () => {
    const md = generateTripMarkdown(
      { trip: baseTrip, members, activities: [], accommodations: [], ...empty },
      { includeExpenses: false },
    );

    expect(md).toContain('## Members');
    expect(md).toContain('Alice (Organizer)');
    expect(md).toContain('Bob (Participant)');
  });

  it('includes accommodation', () => {
    const md = generateTripMarkdown(
      { trip: baseTrip, members, activities: [], accommodations: [accommodation], ...empty },
      { includeExpenses: false },
    );

    expect(md).toContain('## Accommodations');
    expect(md).toContain('### Hotel Split');
    expect(md).toContain('Status: Booked');
    expect(md).toContain('Check-in: Jul 1, 2026');
    expect(md).toContain('https://example.com');
  });

  it('groups activities by date', () => {
    const md = generateTripMarkdown(
      { trip: baseTrip, members, activities: [activity], accommodations: [], ...empty },
      { includeExpenses: false },
    );

    expect(md).toContain('## Activities');
    expect(md).toContain('Friday, July 3, 2026');
    expect(md).toContain('**Kayaking** 09:00–12:00');
    expect(md).toContain('Category: Sport');
  });

  it('omits expenses section when includeExpenses is false', () => {
    const md = generateTripMarkdown(
      {
        trip: baseTrip,
        members,
        activities: [],
        accommodations: [],
        ...empty,
        expenses: {
          balances: [{ user_id: 'u1', total_paid: 100, total_owed: 50, net_balance: 50 }],
          settlements: [],
          currency: 'EUR',
          memberNames: new Map([['u1', 'Alice']]),
        },
      },
      { includeExpenses: false },
    );

    expect(md).not.toContain('## Expenses');
  });

  it('includes expenses table when includeExpenses is true', () => {
    const md = generateTripMarkdown(
      {
        trip: baseTrip,
        members,
        activities: [],
        accommodations: [],
        ...empty,
        expenses: {
          balances: [
            { user_id: 'u1', total_paid: 100, total_owed: 50, net_balance: 50 },
            { user_id: 'u2', total_paid: 0, total_owed: 50, net_balance: -50 },
          ],
          settlements: [{ from: 'u2', to: 'u1', amount: 50 }],
          currency: 'EUR',
          memberNames: new Map([['u1', 'Alice'], ['u2', 'Bob']]),
        },
      },
      { includeExpenses: true },
    );

    expect(md).toContain('## Expenses');
    expect(md).toContain('| Member | Paid | Owes | Net |');
    expect(md).toContain('Alice');
    expect(md).toContain('### Settlements');
    expect(md).toContain('Bob → Alice');
  });

  it('includes Vacationist footer', () => {
    const md = generateTripMarkdown(
      { trip: baseTrip, members: [], activities: [], accommodations: [], ...empty },
      { includeExpenses: false },
    );

    expect(md).toContain('Exported from [Vacationist](https://vacationist.app)');
  });

  it('skips deleted activities', () => {
    const deleted: Activity = { ...activity, id: 'del', deleted_at: '2026-02-01' };
    const md = generateTripMarkdown(
      { trip: baseTrip, members, activities: [activity, deleted], accommodations: [], ...empty },
      { includeExpenses: false },
    );

    expect(md.match(/Kayaking/g)?.length).toBe(1);
  });
});

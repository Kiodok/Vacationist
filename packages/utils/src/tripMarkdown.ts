import type {
  Trip,
  Activity,
  Accommodation,
  TransferFlight,
  TransferVehicle,
  TransferRental,
  ShoppingListWithCounts,
  ShoppingItem,
  TripNote,
  MemberBalance,
  Currency,
} from '@vacationist/types';
import type { Settlement } from './settlements';
import { formatCurrency, isNegligible } from './format';
import { dayjs } from './dayjs';

export interface TripMarkdownMember {
  user_id: string;
  role: string;
  user: { name: string };
}

export interface TripMarkdownExpenses {
  balances: MemberBalance[];
  settlements: Settlement[];
  currency: Currency;
  memberNames: Map<string, string>;
}

export interface TripMarkdownInput {
  trip: Trip & { member_count?: number };
  members: TripMarkdownMember[];
  activities: Activity[];
  accommodations: Accommodation[];
  flights: TransferFlight[];
  vehicles: TransferVehicle[];
  rentals: TransferRental[];
  shoppingLists: ShoppingListWithCounts[];
  shoppingItems: ShoppingItem[];
  notes: TripNote[];
  expenses?: TripMarkdownExpenses;
}

export interface TripMarkdownOptions {
  includeExpenses: boolean;
}

export function generateTripMarkdown(input: TripMarkdownInput, options: TripMarkdownOptions): string {
  const { trip, members, activities, accommodations, flights, vehicles, rentals, shoppingLists, shoppingItems, notes, expenses } = input;
  const { includeExpenses } = options;
  const lines: string[] = [];

  const startDate = dayjs(trip.start_date).format('MMM D, YYYY');
  const endDate = dayjs(trip.end_date).format('MMM D, YYYY');
  const duration = dayjs(trip.end_date).diff(dayjs(trip.start_date), 'day') + 1;

  lines.push(`# ${trip.title}`);
  if (trip.description) {
    lines.push('');
    lines.push(trip.description);
  }
  lines.push('');
  lines.push(`**Dates:** ${startDate} – ${endDate} (${duration} day${duration !== 1 ? 's' : ''})`);
  lines.push(`**Members:** ${trip.member_count ?? members.length}`);
  if (trip.budget_per_person != null) {
    lines.push(`**Budget/person:** ${formatCurrency(trip.budget_per_person, trip.base_currency)}`);
  }
  lines.push(`**Currency:** ${trip.base_currency}`);
  lines.push(`**Timezone:** ${trip.timezone}`);
  lines.push('');

  if (members.length > 0) {
    lines.push('## Members');
    lines.push('');
    for (const m of members) {
      const roleLabel = m.role === 'organizer' ? 'Organizer' : m.role === 'participant' ? 'Participant' : 'Guest';
      lines.push(`- ${m.user.name} (${roleLabel})`);
    }
    lines.push('');
  }

  const activeAccommodations = accommodations.filter((a) => !a.deleted_at);
  if (activeAccommodations.length > 0) {
    lines.push('## Accommodations');
    lines.push('');
    for (const a of activeAccommodations) {
      lines.push(`### ${a.title}`);
      if (a.status !== 'suggested') lines.push(`- Status: ${capitalize(a.status)}`);
      if (a.check_in_date) lines.push(`- Check-in: ${dayjs(a.check_in_date).format('MMM D, YYYY')}`);
      if (a.check_out_date) lines.push(`- Check-out: ${dayjs(a.check_out_date).format('MMM D, YYYY')}`);
      if (a.price_total != null) lines.push(`- Price total: ${formatCurrency(a.price_total, trip.base_currency)}`);
      if (a.description) lines.push(`- Notes: ${a.description}`);
      if (a.external_url) lines.push(`- Link: ${a.external_url}`);
      lines.push('');
    }
  }

  const activeActivities = activities.filter((a) => !a.deleted_at);
  if (activeActivities.length > 0) {
    lines.push('## Activities');
    lines.push('');

    const withDate = [...activeActivities]
      .filter((a) => a.activity_date)
      .sort((a, b) => {
        if (a.activity_date! < b.activity_date!) return -1;
        if (a.activity_date! > b.activity_date!) return 1;
        if (a.start_time && b.start_time) return a.start_time < b.start_time ? -1 : 1;
        return 0;
      });
    const noDate = activeActivities.filter((a) => !a.activity_date);

    let currentDate = '';
    for (const a of withDate) {
      const dateKey = a.activity_date!;
      if (dateKey !== currentDate) {
        currentDate = dateKey;
        lines.push(`### ${dayjs(dateKey).format('dddd, MMMM D, YYYY')}`);
        lines.push('');
      }
      const time = a.start_time
        ? ` ${a.start_time.slice(0, 5)}${a.end_time ? '–' + a.end_time.slice(0, 5) : ''}`
        : '';
      lines.push(`**${a.title}**${time}`);
      if (a.status !== 'planned') lines.push(`- Status: ${capitalize(a.status)}`);
      if (a.category) lines.push(`- Category: ${a.category}`);
      if (a.cost_estimate != null) lines.push(`- Cost estimate: ${formatCurrency(a.cost_estimate, trip.base_currency)}`);
      if (a.description) lines.push(`- Notes: ${a.description}`);
      if (a.external_url) lines.push(`- Link: ${a.external_url}`);
      if (a.maps_url) lines.push(`- Maps: ${a.maps_url}`);
      lines.push('');
    }

    if (noDate.length > 0) {
      lines.push('### Unscheduled Activities');
      lines.push('');
      for (const a of noDate) {
        lines.push(`**${a.title}**`);
        if (a.status !== 'planned') lines.push(`- Status: ${capitalize(a.status)}`);
        if (a.category) lines.push(`- Category: ${a.category}`);
        if (a.cost_estimate != null) lines.push(`- Cost estimate: ${formatCurrency(a.cost_estimate, trip.base_currency)}`);
        if (a.description) lines.push(`- Notes: ${a.description}`);
        lines.push('');
      }
    }
  }

  const activeFlights = flights.filter((f) => !f.deleted_at);
  const activeVehicles = vehicles.filter((v) => !v.deleted_at);
  const activeRentals = rentals.filter((r) => !r.deleted_at);

  if (activeFlights.length > 0 || activeVehicles.length > 0 || activeRentals.length > 0) {
    lines.push('## Transfers');
    lines.push('');

    if (activeFlights.length > 0) {
      lines.push('### Flights');
      lines.push('');
      for (const f of activeFlights) {
        const dir = f.direction === 'outbound' ? 'Outbound' : 'Return';
        lines.push(`**${f.title}** (${dir})`);
        if (f.airline) lines.push(`- Airline: ${f.airline}`);
        if (f.departure_airport && f.arrival_airport) {
          lines.push(`- Route: ${f.departure_airport} → ${f.arrival_airport}`);
        }
        if (f.departure_time) lines.push(`- Departure: ${dayjs(f.departure_time).format('MMM D, YYYY HH:mm')}`);
        if (f.arrival_time) lines.push(`- Arrival: ${dayjs(f.arrival_time).format('MMM D, YYYY HH:mm')}`);
        if (f.flight_number) lines.push(`- Flight: ${f.flight_number}`);
        if (f.booking_reference) lines.push(`- Booking ref: ${f.booking_reference}`);
        if (f.price_per_person != null) lines.push(`- Price/person: ${formatCurrency(f.price_per_person, trip.base_currency)}`);
        if (f.external_url) lines.push(`- Link: ${f.external_url}`);
        lines.push('');
      }
    }

    if (activeVehicles.length > 0) {
      lines.push('### Vehicles');
      lines.push('');
      for (const v of activeVehicles) {
        const dir = v.direction === 'outbound' ? 'Outbound' : 'Return';
        lines.push(`- **${v.title}** (${dir})${v.notes ? ` — ${v.notes}` : ''}`);
      }
      lines.push('');
    }

    if (activeRentals.length > 0) {
      lines.push('### Rental Cars');
      lines.push('');
      for (const r of activeRentals) {
        lines.push(`**${r.title}**`);
        if (r.company) lines.push(`- Company: ${r.company}`);
        if (r.pickup_location && r.dropoff_location) {
          lines.push(`- Route: ${r.pickup_location} → ${r.dropoff_location}`);
        }
        if (r.pickup_date) lines.push(`- Pickup: ${dayjs(r.pickup_date).format('MMM D, YYYY')}`);
        if (r.dropoff_date) lines.push(`- Return: ${dayjs(r.dropoff_date).format('MMM D, YYYY')}`);
        if (r.booking_reference) lines.push(`- Booking ref: ${r.booking_reference}`);
        if (r.price_total != null) lines.push(`- Price total: ${formatCurrency(r.price_total, trip.base_currency)}`);
        lines.push('');
      }
    }
  }

  if (shoppingLists.length > 0) {
    lines.push('## Shopping Lists');
    lines.push('');
    for (const list of shoppingLists) {
      lines.push(`### ${list.title}`);
      lines.push('');
      const listItems = shoppingItems.filter((i) => i.shopping_list_id === list.id && !i.deleted_at);
      if (listItems.length === 0) {
        lines.push('_No items_');
      } else {
        for (const item of listItems) {
          const checked = item.status === 'bought' ? 'x' : ' ';
          const qty = item.quantity != null ? ` × ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : '';
          lines.push(`- [${checked}] ${item.title}${qty}`);
        }
      }
      lines.push('');
    }
  }

  if (notes.length > 0) {
    lines.push('## Notes');
    lines.push('');
    for (const note of notes) {
      lines.push(`### ${note.title}`);
      if (note.description) {
        lines.push('');
        lines.push(note.description);
      }
      lines.push('');
    }
  }

  if (includeExpenses && expenses) {
    lines.push('## Expenses');
    lines.push('');
    lines.push('| Member | Paid | Owes | Net |');
    lines.push('|--------|------|------|-----|');
    for (const b of expenses.balances) {
      const name = expenses.memberNames.get(b.user_id) ?? 'Unknown';
      const net = b.net_balance;
      const prefix = !isNegligible(net) && net > 0 ? '+' : '';
      lines.push(
        `| ${name} | ${formatCurrency(b.total_paid, expenses.currency)} | ${formatCurrency(b.total_owed, expenses.currency)} | ${prefix}${formatCurrency(net, expenses.currency)} |`,
      );
    }
    lines.push('');

    if (expenses.settlements.length === 0) {
      lines.push('**All settled up!** No payments needed.');
    } else {
      lines.push('### Settlements');
      lines.push('');
      for (const s of expenses.settlements) {
        const from = expenses.memberNames.get(s.from) ?? 'Unknown';
        const to = expenses.memberNames.get(s.to) ?? 'Unknown';
        lines.push(`- ${from} → ${to}: ${formatCurrency(s.amount, expenses.currency)}`);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Exported from [Vacationist](https://vacationist.app) on ${dayjs().format('MMM D, YYYY')}*`);

  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

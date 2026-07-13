import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'],
  { auth: { persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let userId: string;
  try {
    const body = await req.json();
    userId = body.user_id;
    if (!userId) throw new Error('missing user_id');
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Guard: skip if the user already has a trip (e.g. re-trigger after account link)
  const { count } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
    .is('deleted_at', null);
  if ((count ?? 0) > 0) {
    return new Response('Already has trips', { status: 200 });
  }

  // Dates: example trip starts ~3 months from now, lasts 7 days
  const start = new Date();
  start.setMonth(start.getMonth() + 3);
  start.setDate(1);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];

  // Helper: offset a date string by N days
  function dateOffset(base: string, days: number): string {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  try {
    // 1. Trip
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .insert({
        title: 'Barcelona Weekend 🇪🇸',
        description: 'An example trip to explore Vacationist. Edit or delete anything!',
        start_date: startStr,
        end_date: endStr,
        budget_per_person: 600,
        base_currency: 'EUR',
        timezone: 'Europe/Madrid',
        status: 'planning',
        created_by: userId,
      })
      .select('id')
      .single();
    if (tripErr || !trip) throw tripErr ?? new Error('no trip');

    const tripId = trip.id;

    // 2. Add user as organizer
    await supabase.from('trip_members').insert({
      trip_id: tripId,
      user_id: userId,
      role: 'organizer',
    });

    // 3. Activities
    const { data: activities } = await supabase
      .from('activities')
      .insert([
        {
          trip_id: tripId,
          title: 'Sagrada Família',
          description: 'Gaudí\'s iconic basilica — book tickets in advance!',
          category: 'Sightseeing',
          cost_estimate: 26,
          activity_date: dateOffset(startStr, 1),
          start_time: '10:00',
          end_time: '12:30',
          status: 'planned',
          voting_open: true,
          created_by: userId,
        },
        {
          trip_id: tripId,
          title: 'Barceloneta Beach',
          description: 'Relax on the beach and grab lunch at a chiringuito.',
          category: 'Beach',
          cost_estimate: 0,
          activity_date: dateOffset(startStr, 2),
          start_time: '11:00',
          end_time: '16:00',
          status: 'planned',
          voting_open: true,
          created_by: userId,
        },
        {
          trip_id: tripId,
          title: 'Park Güell',
          description: 'Colorful mosaic park with panoramic city views.',
          category: 'Sightseeing',
          cost_estimate: 10,
          activity_date: dateOffset(startStr, 3),
          start_time: '09:00',
          end_time: '11:00',
          status: 'planned',
          voting_open: true,
          created_by: userId,
        },
        {
          trip_id: tripId,
          title: 'La Boqueria Market',
          description: 'Famous market — try the fresh fruit and pintxos.',
          category: 'Food',
          cost_estimate: 15,
          activity_date: dateOffset(startStr, 0),
          start_time: '09:30',
          end_time: '11:00',
          status: 'planned',
          voting_open: true,
          created_by: userId,
        },
      ])
      .select('id, title');

    // 4. Activity note on the first activity
    if (activities && activities.length > 0) {
      await supabase.from('activity_notes').insert({
        activity_id: activities[0].id,
        trip_id: tripId,
        created_by: userId,
        content: 'Tip: the morning slot (10:00) has the shortest queues. Skip the audio guide — the app is better.',
      });
    }

    // 5. Accommodations
    await supabase.from('accommodations').insert([
      {
        trip_id: tripId,
        title: 'Hotel Arts Barcelona',
        description: '5-star beachfront hotel in the Olympic Port area.',
        price_total: 840,
        notes: 'Breakfast included. Check-in from 15:00.',
        status: 'suggested',
        voting_open: true,
        created_by: userId,
      },
      {
        trip_id: tripId,
        title: 'Airbnb in El Born',
        description: 'Cozy apartment in the trendy El Born neighbourhood.',
        price_total: 560,
        notes: 'Close to Picasso Museum. 4 bedrooms.',
        status: 'suggested',
        voting_open: true,
        created_by: userId,
      },
    ]);

    // 6. Transfer flights (outbound + inbound)
    await supabase.from('transfer_flights').insert([
      {
        trip_id: tripId,
        title: 'Flight to Barcelona',
        direction: 'outbound',
        airline: 'Vueling',
        departure_airport: 'BER',
        arrival_airport: 'BCN',
        departure_time: `${startStr}T06:30:00+02:00`,
        arrival_time: `${startStr}T09:10:00+02:00`,
        price_per_person: 89,
        status: 'suggested',
        voting_open: true,
        created_by: userId,
      },
      {
        trip_id: tripId,
        title: 'Return Flight Home',
        direction: 'return',
        airline: 'Vueling',
        departure_airport: 'BCN',
        arrival_airport: 'BER',
        departure_time: `${endStr}T18:45:00+02:00`,
        arrival_time: `${endStr}T21:20:00+02:00`,
        price_per_person: 94,
        status: 'suggested',
        voting_open: true,
        created_by: userId,
      },
    ]);

    // 7. Transfer vehicle (carpool from airport to hotel)
    const { data: vehicle } = await supabase
      .from('transfer_vehicles')
      .insert({
        trip_id: tripId,
        title: 'Carpool — Airport to Hotel',
        direction: 'outbound',
        notes: 'Fits 5 people. Meet at Arrivals exit B after luggage pickup.',
        created_by: userId,
      })
      .select('id')
      .single();

    if (vehicle) {
      await supabase.from('transfer_vehicle_passengers').insert({
        vehicle_id: vehicle.id,
        trip_id: tripId,
        user_id: userId,
        is_driver: true,
      });
    }

    // 8. Transfer rental (car for day trips)
    await supabase.from('transfer_rentals').insert({
      trip_id: tripId,
      title: 'Rental Car — Montserrat Day Trip',
      company: 'Europcar',
      pickup_location: 'BCN Airport Terminal 2',
      dropoff_location: 'BCN Airport Terminal 2',
      pickup_date: dateOffset(startStr, 2),
      dropoff_date: dateOffset(startStr, 3),
      price_total: 75,
      notes: 'Compact class. Booking includes GPS and full insurance.',
      created_by: userId,
    });

    // 9. Shopping list + items
    const { data: list } = await supabase
      .from('shopping_lists')
      .insert({
        trip_id: tripId,
        title: 'Groceries & Snacks',
        created_by: userId,
      })
      .select('id')
      .single();

    if (list) {
      await supabase.from('shopping_items').insert([
        { shopping_list_id: list.id, title: 'Sunscreen SPF 50', quantity: 2, unit: 'bottle', created_by: userId },
        { shopping_list_id: list.id, title: 'Reusable water bottles', quantity: 4, unit: 'pcs', created_by: userId },
        { shopping_list_id: list.id, title: 'Snacks for the flight', quantity: 1, unit: 'bag', created_by: userId },
      ]);
    }

    // 10. Recipe
    const { data: recipe } = await supabase
      .from('recipes')
      .insert({
        trip_id: tripId,
        title: 'Picnic Tortilla Española',
        description: 'Classic Spanish omelette — perfect for a beach picnic.',
        servings: 4,
        created_by: userId,
      })
      .select('id')
      .single();

    if (recipe) {
      await supabase.from('recipe_ingredients').insert([
        { recipe_id: recipe.id, title: 'Eggs', quantity: 6, unit: 'pcs' },
        { recipe_id: recipe.id, title: 'Potatoes', quantity: 500, unit: 'g' },
        { recipe_id: recipe.id, title: 'Olive oil', quantity: 100, unit: 'ml' },
        { recipe_id: recipe.id, title: 'Onion', quantity: 1, unit: 'pcs' },
        { recipe_id: recipe.id, title: 'Salt', quantity: null, unit: null },
      ]);
    }

    // 11. Expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .insert([
        {
          trip_id: tripId,
          title: 'Airport transfer',
          amount: 32,
          currency: 'EUR',
          related_type: 'transport',
          paid_by: userId,
          created_by: userId,
        },
        {
          trip_id: tripId,
          title: 'Group dinner — El Xampanyet',
          amount: 120,
          currency: 'EUR',
          related_type: 'manual',
          paid_by: userId,
          created_by: userId,
        },
        {
          trip_id: tripId,
          title: 'Sagrada Família tickets',
          amount: 52,
          currency: 'EUR',
          related_type: 'activity',
          paid_by: userId,
          created_by: userId,
        },
      ])
      .select('id, amount');

    // Add expense splits (just the creator for now — a solo example)
    if (expenses) {
      for (const exp of expenses) {
        await supabase.from('expense_splits').insert({
          expense_id: exp.id,
          user_id: userId,
          amount_owed: exp.amount,
          status: 'open',
        });
      }
    }

    // 12. Private packing items
    await supabase.from('packing_items').insert([
      { trip_id: tripId, user_id: userId, category: 'Documents', title: 'Passport',          is_packed: false },
      { trip_id: tripId, user_id: userId, category: 'Documents', title: 'Travel insurance',  is_packed: false },
      { trip_id: tripId, user_id: userId, category: 'Clothes',   title: 'Swimwear',          is_packed: false },
      { trip_id: tripId, user_id: userId, category: 'Clothes',   title: 'Light jacket',      is_packed: false },
      { trip_id: tripId, user_id: userId, category: 'Tech',      title: 'Phone charger',     is_packed: true  },
      { trip_id: tripId, user_id: userId, category: 'Tech',      title: 'EU travel adapter', is_packed: false },
      { trip_id: tripId, user_id: userId, category: 'Toiletries', title: 'Sunscreen SPF 50', is_packed: false },
    ]);

    // 13. Shared packing item (who_has — the most interesting type)
    await supabase.from('shared_packing_items').insert({
      trip_id: tripId,
      title: 'First-aid kit',
      item_type: 'who_has',
      notes: 'Does anyone have one to bring?',
      created_by: userId,
    });

    // 14. Lost & Found case
    await supabase.from('lost_found_cases').insert({
      trip_id: tripId,
      created_by: userId,
      case_type: 'lost_unknown',
      title: 'Blue water bottle',
      description: 'Left behind at La Boqueria — 1L Nalgene, blue with a sticker on it. If anyone picks it up please let us know!',
      is_resolved: false,
    });

    // 15. Trip note
    await supabase.from('trip_notes').insert({
      trip_id: tripId,
      created_by: userId,
      title: 'Welcome to your example trip!',
      description: 'This trip was created automatically so you can explore every feature of Vacationist. Feel free to edit, vote, add expenses, and invite friends. Delete this trip whenever you\'re ready.',
    });

    // 16. Trip chat messages
    await supabase.from('trip_messages').insert([
      {
        trip_id: tripId,
        created_by: userId,
        text: 'Welcome to the trip chat! Every trip has one — perfect for quick questions and updates without leaving the app.',
      },
      {
        trip_id: tripId,
        created_by: userId,
        text: 'Once your friends join via the invite link, they can chat here too. Try it out!',
      },
    ]);

    return new Response(JSON.stringify({ trip_id: tripId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-example-trip error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});

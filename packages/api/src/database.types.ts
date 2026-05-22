export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accommodation_votes: {
        Row: {
          accommodation_id: string
          created_at: string
          id: string
          user_id: string
          vote: string
        }
        Insert: {
          accommodation_id: string
          created_at?: string
          id?: string
          user_id: string
          vote: string
        }
        Update: {
          accommodation_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_votes_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodation_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          external_url: string | null
          id: string
          notes: string | null
          price_total: number | null
          status: string
          title: string
          trip_id: string
          updated_at: string
          voting_open: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          price_total?: number | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
          voting_open?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          price_total?: number | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
          voting_open?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_date: string | null
          category: string | null
          cost_estimate: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          end_time: string | null
          external_url: string | null
          id: string
          maps_url: string | null
          start_time: string | null
          status: string
          title: string
          trip_id: string
          updated_at: string
          voting_open: boolean
        }
        Insert: {
          activity_date?: string | null
          category?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          external_url?: string | null
          id?: string
          maps_url?: string | null
          start_time?: string | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
          voting_open?: boolean
        }
        Update: {
          activity_date?: string | null
          category?: string | null
          cost_estimate?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          end_time?: string | null
          external_url?: string | null
          id?: string
          maps_url?: string | null
          start_time?: string | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
          voting_open?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_votes: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          user_id: string
          vote: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          user_id: string
          vote: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_votes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount_owed: number
          expense_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_owed: number
          expense_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount_owed?: number
          expense_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          archived_at: string | null
          created_at: string
          created_by: string
          currency: string
          id: string
          paid_by: string
          related_id: string | null
          related_type: string
          split_method: string
          title: string
          trip_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          archived_at?: string | null
          created_at?: string
          created_by: string
          currency?: string
          id?: string
          paid_by: string
          related_id?: string | null
          related_type?: string
          split_method?: string
          title: string
          trip_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          archived_at?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          id?: string
          paid_by?: string
          related_id?: string | null
          related_type?: string
          split_method?: string
          title?: string
          trip_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_tokens: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          token: string
          trip_id: string
          updated_at: string
          use_count: number
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token: string
          trip_id: string
          updated_at?: string
          use_count?: number
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          token?: string
          trip_id?: string
          updated_at?: string
          use_count?: number
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_tokens_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      prework_preferences: {
        Row: {
          filters: Json
          id: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          filters?: Json
          id?: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          filters?: Json
          id?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prework_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prework_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          quantity: number | null
          recipe_id: string
          sort_order: number
          title: string
          unit: string | null
        }
        Insert: {
          id?: string
          quantity?: number | null
          recipe_id: string
          sort_order?: number
          title: string
          unit?: string | null
        }
        Update: {
          id?: string
          quantity?: number | null
          recipe_id?: string
          sort_order?: number
          title?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          servings: number
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          servings?: number
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          servings?: number
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          notes: string | null
          position: number
          quantity: number | null
          shopping_list_id: string
          source_ingredient_id: string | null
          source_recipe_id: string | null
          status: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          position?: number
          quantity?: number | null
          shopping_list_id: string
          source_ingredient_id?: string | null
          source_recipe_id?: string | null
          status?: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          position?: number
          quantity?: number | null
          shopping_list_id?: string
          source_ingredient_id?: string | null
          source_recipe_id?: string | null
          status?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_shopping_items_source_ingredient"
            columns: ["source_ingredient_id"]
            isOneToOne: false
            referencedRelation: "recipe_ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shopping_items_source_recipe"
            columns: ["source_recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_shopping_list_id_fkey"
            columns: ["shopping_list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          id: string
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_lists_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_flight_passengers: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_flight_passengers_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "transfer_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_flight_passengers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_flight_votes: {
        Row: {
          created_at: string
          flight_id: string
          id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_flight_votes_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "transfer_flights"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_flight_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_flights: {
        Row: {
          airline: string | null
          arrival_airport: string | null
          arrival_time: string | null
          booking_reference: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          departure_airport: string | null
          departure_time: string | null
          description: string | null
          direction: string
          external_url: string | null
          flight_number: string | null
          id: string
          notes: string | null
          price_per_person: number | null
          return_arrival_airport: string | null
          return_arrival_time: string | null
          return_departure_airport: string | null
          return_departure_time: string | null
          status: string
          title: string
          trip_id: string
          updated_at: string
          voting_open: boolean
        }
        Insert: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          booking_reference?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          departure_airport?: string | null
          departure_time?: string | null
          description?: string | null
          direction: string
          external_url?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          price_per_person?: number | null
          return_arrival_airport?: string | null
          return_arrival_time?: string | null
          return_departure_airport?: string | null
          return_departure_time?: string | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
          voting_open?: boolean
        }
        Update: {
          airline?: string | null
          arrival_airport?: string | null
          arrival_time?: string | null
          booking_reference?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          departure_airport?: string | null
          departure_time?: string | null
          description?: string | null
          direction?: string
          external_url?: string | null
          flight_number?: string | null
          id?: string
          notes?: string | null
          price_per_person?: number | null
          return_arrival_airport?: string | null
          return_arrival_time?: string | null
          return_departure_airport?: string | null
          return_departure_time?: string | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
          voting_open?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "transfer_flights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_flights_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_rentals: {
        Row: {
          booking_reference: string | null
          company: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          dropoff_date: string | null
          dropoff_location: string | null
          external_url: string | null
          id: string
          notes: string | null
          pickup_date: string | null
          pickup_location: string | null
          price_total: number | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          booking_reference?: string | null
          company?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          dropoff_date?: string | null
          dropoff_location?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          pickup_date?: string | null
          pickup_location?: string | null
          price_total?: number | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          booking_reference?: string | null
          company?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          dropoff_date?: string | null
          dropoff_location?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          pickup_date?: string | null
          pickup_location?: string | null
          price_total?: number | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_rentals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_rentals_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_vehicle_passengers: {
        Row: {
          created_at: string
          id: string
          is_driver: boolean
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_driver?: boolean
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_driver?: boolean
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_vehicle_passengers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_vehicle_passengers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transfer_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_vehicles: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          direction: string
          id: string
          notes: string | null
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          direction: string
          id?: string
          notes?: string | null
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          direction?: string
          id?: string
          notes?: string | null
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_vehicles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_vehicles_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role: string
          trip_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          base_currency: string
          budget_per_person: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          end_date: string
          id: string
          start_date: string
          status: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          budget_per_person?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          start_date: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          budget_per_person?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          start_date?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          is_guest: boolean
          locale: string
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          is_guest?: boolean
          locale?: string
          name: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_guest?: boolean
          locale?: string
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_expense: { Args: { p_expense_id: string }; Returns: undefined }
      book_transfer_flight: {
        Args: {
          p_booking_reference?: string
          p_flight_id: string
          p_flight_number?: string
        }
        Returns: undefined
      }
      close_accommodation_voting: {
        Args: { p_accommodation_id: string }
        Returns: undefined
      }
      close_activity_voting: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
      close_transfer_flight_voting: {
        Args: { p_flight_id: string }
        Returns: undefined
      }
      create_expense_with_splits: {
        Args: {
          p_amount: number
          p_currency: string
          p_paid_by: string
          p_related_id: string
          p_related_type: string
          p_split_method: string
          p_splits: Json
          p_title: string
          p_trip_id: string
        }
        Returns: string
      }
      delete_recipe: { Args: { p_recipe_id: string }; Returns: undefined }
      delete_shopping_list: { Args: { p_list_id: string }; Returns: undefined }
      get_recipe_linked_lists: {
        Args: { p_recipe_id: string }
        Returns: {
          shopping_list_id: string
        }[]
      }
      get_trip_balances: {
        Args: { p_trip_id: string }
        Returns: {
          net_balance: number
          total_owed: number
          total_paid: number
          user_id: string
        }[]
      }
      redeem_invite_token: { Args: { token_value: string }; Returns: string }
      reopen_accommodation_voting: {
        Args: { p_accommodation_id: string }
        Returns: undefined
      }
      reopen_activity_voting: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
      reopen_transfer_flight_voting: {
        Args: { p_flight_id: string }
        Returns: undefined
      }
      set_transfer_flight_passengers: {
        Args: { p_flight_id: string; p_user_ids: string[] }
        Returns: undefined
      }
      settle_expense_split: { Args: { p_split_id: string }; Returns: undefined }
      soft_delete_accommodation: {
        Args: { p_accommodation_id: string }
        Returns: undefined
      }
      soft_delete_activity: {
        Args: { p_activity_id: string }
        Returns: undefined
      }
      soft_delete_shopping_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      soft_delete_transfer_flight: {
        Args: { p_flight_id: string }
        Returns: undefined
      }
      soft_delete_transfer_rental: {
        Args: { p_rental_id: string }
        Returns: undefined
      }
      soft_delete_transfer_vehicle: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      soft_delete_trip: { Args: { p_trip_id: string }; Returns: undefined }
      unarchive_expense: { Args: { p_expense_id: string }; Returns: undefined }
      unsettle_expense_split: {
        Args: { p_split_id: string }
        Returns: undefined
      }
      update_expense_with_splits: {
        Args: {
          p_amount: number
          p_expense_id: string
          p_paid_by: string
          p_split_method: string
          p_splits: Json
          p_title: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

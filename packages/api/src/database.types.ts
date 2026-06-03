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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accommodation_votes: {
        Row: {
          accommodation_id: string
          created_at: string
          id: string
          trip_id: string | null
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          accommodation_id: string
          created_at?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          accommodation_id?: string
          created_at?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
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
            foreignKeyName: "accommodation_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          reservation_required: boolean
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
          reservation_required?: boolean
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
          reservation_required?: boolean
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
          trip_id: string | null
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
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
            foreignKeyName: "activity_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
      document_access_audit_log: {
        Row: {
          accessed_at: string
          document_type: string
          id: string
          member_id: string
          organizer_id: string
          trip_id: string
        }
        Insert: {
          accessed_at?: string
          document_type: string
          id?: string
          member_id: string
          organizer_id: string
          trip_id: string
        }
        Update: {
          accessed_at?: string
          document_type?: string
          id?: string
          member_id?: string
          organizer_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_audit_log_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_audit_log_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_audit_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_grants: {
        Row: {
          expires_at: string | null
          granted: boolean
          id: string
          request_id: string
          responded_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted: boolean
          id?: string
          request_id: string
          responded_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted?: boolean
          id?: string
          request_id?: string
          responded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_access_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_requests: {
        Row: {
          created_at: string
          duration_minutes: number
          id: string
          requested_by: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          duration_minutes: number
          id?: string
          requested_by: string
          trip_id: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          id?: string
          requested_by?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          trip_id: string | null
          user_id: string
        }
        Insert: {
          amount_owed: number
          expense_id: string
          id?: string
          status?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          amount_owed?: number
          expense_id?: string
          id?: string
          status?: string
          trip_id?: string | null
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
            foreignKeyName: "expense_splits_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
      notification_preferences: {
        Row: {
          expense_change: boolean
          id: string
          new_activity: boolean
          new_member: boolean
          reminder: boolean
          schedule_change: boolean
          trip_id: string
          user_id: string
          vote_update: boolean
        }
        Insert: {
          expense_change?: boolean
          id?: string
          new_activity?: boolean
          new_member?: boolean
          reminder?: boolean
          schedule_change?: boolean
          trip_id: string
          user_id: string
          vote_update?: boolean
        }
        Update: {
          expense_change?: boolean
          id?: string
          new_activity?: boolean
          new_member?: boolean
          reminder?: boolean
          schedule_change?: boolean
          trip_id?: string
          user_id?: string
          vote_update?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          push_sent_at: string | null
          related_id: string | null
          related_type: string | null
          title: string
          trip_id: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          push_sent_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title: string
          trip_id: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          push_sent_at?: string | null
          related_id?: string | null
          related_type?: string | null
          title?: string
          trip_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
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
          trip_id: string | null
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
          trip_id?: string | null
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
          trip_id?: string | null
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
          {
            foreignKeyName: "shopping_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          trip_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          trip_id?: string | null
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
            foreignKeyName: "transfer_flight_passengers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          trip_id: string | null
          updated_at: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          flight_id: string
          id?: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          flight_id?: string
          id?: string
          trip_id?: string | null
          updated_at?: string
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
            foreignKeyName: "transfer_flight_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          trip_id: string | null
          user_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_driver?: boolean
          trip_id?: string | null
          user_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_driver?: boolean
          trip_id?: string | null
          user_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_vehicle_passengers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
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
      trip_notes: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_done: boolean
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_done?: boolean
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_done?: boolean
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
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
          member_count: number
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
          member_count?: number
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
          member_count?: number
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
      user_push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          push_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          push_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          push_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_travel_documents: {
        Row: {
          created_at: string
          date_of_birth: string | null
          document_number: string
          document_type: string
          expiry_date: string | null
          full_legal_name: string
          id: string
          issuing_country: string | null
          nationality: string | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          document_number: string
          document_type: string
          expiry_date?: string | null
          full_legal_name: string
          id?: string
          issuing_country?: string | null
          nationality?: string | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          document_number?: string
          document_type?: string
          expiry_date?: string | null
          full_legal_name?: string
          id?: string
          issuing_country?: string | null
          nationality?: string | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_travel_documents_user_id_fkey"
            columns: ["user_id"]
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
      create_activity: {
        Args: {
          p_activity_date?: string
          p_category?: string
          p_cost_estimate?: number
          p_description?: string
          p_end_time?: string
          p_external_url?: string
          p_maps_url?: string
          p_start_time?: string
          p_title: string
          p_trip_id: string
        }
        Returns: string
      }
      create_document_access_request: {
        Args: { p_duration_minutes: number; p_trip_id: string }
        Returns: string
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
      delete_all_notifications: { Args: { p_trip_id?: string }; Returns: undefined }
      delete_push_token: { Args: { p_push_token: string }; Returns: undefined }
      delete_recipe: { Args: { p_recipe_id: string }; Returns: undefined }
      delete_shopping_list: { Args: { p_list_id: string }; Returns: undefined }
      delete_travel_document: {
        Args: { p_document_id: string }
        Returns: undefined
      }
      get_accessible_member_documents: {
        Args: { p_trip_id: string }
        Returns: {
          date_of_birth: string
          document_number: string
          document_type: string
          expiry_date: string
          full_legal_name: string
          grant_expires_at: string
          issuing_country: string
          nationality: string
          notes: string
          user_avatar: string
          user_id: string
          user_name: string
        }[]
      }
      get_my_active_grants: {
        Args: never
        Returns: {
          expires_at: string
          grant_id: string
          request_id: string
          requester_avatar: string
          requester_name: string
          trip_id: string
          trip_title: string
        }[]
      }
      get_my_pending_access_requests: {
        Args: never
        Returns: {
          created_at: string
          duration_minutes: number
          request_id: string
          requested_by: string
          requester_avatar: string
          requester_name: string
          trip_id: string
          trip_title: string
        }[]
      }
      get_my_travel_documents: {
        Args: never
        Returns: {
          created_at: string
          date_of_birth: string
          document_number: string
          document_type: string
          expiry_date: string
          full_legal_name: string
          id: string
          issuing_country: string
          nationality: string
          notes: string
          updated_at: string
        }[]
      }
      get_recipe_linked_lists: {
        Args: { p_recipe_id: string }
        Returns: {
          shopping_list_id: string
        }[]
      }
      get_shopping_lists_with_counts: {
        Args: { p_trip_id: string }
        Returns: {
          archived_at: string
          bought_count: number
          created_at: string
          created_by: string
          id: string
          item_count: number
          title: string
          trip_id: string
          updated_at: string
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
      get_unread_notification_count: {
        Args: { p_trip_id?: string }
        Returns: number
      }
      mark_all_notifications_read: {
        Args: { p_trip_id?: string }
        Returns: undefined
      }
      join_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      leave_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: undefined
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
      reset_all_prework_preferences: { Args: { p_trip_id: string }; Returns: undefined }
      respond_to_document_access_request: {
        Args: { p_granted: boolean; p_request_id: string }
        Returns: undefined
      }
      revoke_document_access: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      send_organizer_nudge: {
        Args: { p_body: string; p_title: string; p_trip_id: string }
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
      upsert_push_token: {
        Args: { p_platform: string; p_push_token: string }
        Returns: undefined
      }
      upsert_travel_document: {
        Args: {
          p_date_of_birth?: string
          p_document_number: string
          p_document_type: string
          p_expiry_date?: string
          p_full_legal_name: string
          p_issuing_country?: string
          p_nationality?: string
          p_notes?: string
        }
        Returns: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

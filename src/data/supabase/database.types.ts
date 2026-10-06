export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          created_at: string;
          id: string;
          location: string | null;
          name: string;
          name_key: string | null;
          notes: string | null;
          sector: string | null;
          updated_at: string;
          website: string | null;
          workspace_id: string;
        };
        Insert: {
          created_at: string;
          id: string;
          location?: string | null;
          name: string;
          name_key?: never;
          notes?: string | null;
          sector?: string | null;
          updated_at: string;
          website?: string | null;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          location?: string | null;
          name?: string;
          name_key?: never;
          notes?: string | null;
          sector?: string | null;
          updated_at?: string;
          website?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "companies_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      drafts: {
        Row: {
          approved_at: string | null;
          body: string;
          channel: string;
          created_at: string;
          discarded_at: string | null;
          id: string;
          opportunity_id: string | null;
          origin: string;
          person_id: string;
          sent_at: string | null;
          sent_interaction_id: string | null;
          sent_kind: string | null;
          status: string;
          subject: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          approved_at?: string | null;
          body: string;
          channel: string;
          created_at: string;
          discarded_at?: string | null;
          id: string;
          opportunity_id?: string | null;
          origin: string;
          person_id: string;
          sent_at?: string | null;
          sent_interaction_id?: string | null;
          sent_kind?: never;
          status: string;
          subject?: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          approved_at?: string | null;
          body?: string;
          channel?: string;
          created_at?: string;
          discarded_at?: string | null;
          id?: string;
          opportunity_id?: string | null;
          origin?: string;
          person_id?: string;
          sent_at?: string | null;
          sent_interaction_id?: string | null;
          sent_kind?: never;
          status?: string;
          subject?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drafts_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "drafts_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "drafts_sent_interaction_fkey";
            columns: ["workspace_id", "sent_interaction_id", "person_id", "sent_kind"];
            isOneToOne: false;
            referencedRelation: "interactions";
            referencedColumns: ["workspace_id", "id", "person_id", "kind"];
          },
          {
            foreignKeyName: "drafts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      gmail_connections: {
        Row: {
          connected_at: string;
          email_address: string;
          history_cursor: string | null;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          profile_id: string;
          scopes: string[];
          status: string;
          sync_started_at: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          connected_at: string;
          email_address: string;
          history_cursor?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          profile_id: string;
          scopes: string[];
          status: string;
          sync_started_at?: string | null;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          connected_at?: string;
          email_address?: string;
          history_cursor?: string | null;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          profile_id?: string;
          scopes?: string[];
          status?: string;
          sync_started_at?: string | null;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gmail_connections_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gmail_connections_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: true;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      gmail_messages: {
        Row: {
          direction: string;
          interaction_id: string;
          interaction_kind: string | null;
          person_id: string;
          provider_message_id: string;
          recorded_at: string;
          thread_id: string | null;
          workspace_id: string;
        };
        Insert: {
          direction: string;
          interaction_id: string;
          interaction_kind?: never;
          person_id: string;
          provider_message_id: string;
          recorded_at: string;
          thread_id?: string | null;
          workspace_id: string;
        };
        Update: {
          direction?: string;
          interaction_id?: string;
          interaction_kind?: never;
          person_id?: string;
          provider_message_id?: string;
          recorded_at?: string;
          thread_id?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gmail_messages_interaction_fkey";
            columns: ["workspace_id", "interaction_id", "person_id", "interaction_kind"];
            isOneToOne: false;
            referencedRelation: "interactions";
            referencedColumns: ["workspace_id", "id", "person_id", "kind"];
          },
          {
            foreignKeyName: "gmail_messages_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "gmail_messages_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      interactions: {
        Row: {
          body: string | null;
          channel: string | null;
          created_at: string;
          format: string | null;
          id: string;
          kind: string;
          occurred_at: string;
          opportunity_id: string | null;
          person_id: string;
          subject: string | null;
          summary: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          body?: string | null;
          channel?: string | null;
          created_at: string;
          format?: string | null;
          id: string;
          kind: string;
          occurred_at: string;
          opportunity_id?: string | null;
          person_id: string;
          subject?: string | null;
          summary: string;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          body?: string | null;
          channel?: string | null;
          created_at?: string;
          format?: string | null;
          id?: string;
          kind?: string;
          occurred_at?: string;
          opportunity_id?: string | null;
          person_id?: string;
          subject?: string | null;
          summary?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interactions_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interactions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      interpretation_facts: {
        Row: {
          fact_id: string;
          interpretation_id: string;
          position: number;
          workspace_id: string;
        };
        Insert: {
          fact_id: string;
          interpretation_id: string;
          position: number;
          workspace_id: string;
        };
        Update: {
          fact_id?: string;
          interpretation_id?: string;
          position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interpretation_facts_fact_fkey";
            columns: ["workspace_id", "fact_id"];
            isOneToOne: false;
            referencedRelation: "source_facts";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interpretation_facts_interpretation_fkey";
            columns: ["workspace_id", "interpretation_id"];
            isOneToOne: false;
            referencedRelation: "interpretations";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interpretation_facts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      interpretations: {
        Row: {
          company_id: string | null;
          created_at: string;
          generated_at: string;
          generated_by_kind: string;
          generated_by_name: string;
          id: string;
          kind: string;
          opportunity_id: string | null;
          person_id: string | null;
          review: string;
          subject_type: string;
          text: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at: string;
          generated_at: string;
          generated_by_kind: string;
          generated_by_name: string;
          id: string;
          kind: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          review: string;
          subject_type: string;
          text: string;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          generated_at?: string;
          generated_by_kind?: string;
          generated_by_name?: string;
          id?: string;
          kind?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          review?: string;
          subject_type?: string;
          text?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interpretations_company_fkey";
            columns: ["workspace_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interpretations_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interpretations_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "interpretations_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      next_actions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          dismissed_at: string | null;
          due_on: string;
          id: string;
          interaction_id: string | null;
          kind: string;
          opportunity_id: string | null;
          person_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at: string;
          dismissed_at?: string | null;
          due_on: string;
          id: string;
          interaction_id?: string | null;
          kind: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          status: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          dismissed_at?: string | null;
          due_on?: string;
          id?: string;
          interaction_id?: string | null;
          kind?: string;
          opportunity_id?: string | null;
          person_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "next_actions_interaction_fkey";
            columns: ["workspace_id", "interaction_id"];
            isOneToOne: false;
            referencedRelation: "interactions";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "next_actions_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "next_actions_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "next_actions_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          closed_reason: string | null;
          company_id: string;
          created_at: string;
          deadline: string | null;
          id: string;
          notes: string | null;
          priority: string | null;
          status: string;
          title: string;
          type: string | null;
          updated_at: string;
          url: string | null;
          workspace_id: string;
        };
        Insert: {
          closed_reason?: string | null;
          company_id: string;
          created_at: string;
          deadline?: string | null;
          id: string;
          notes?: string | null;
          priority?: string | null;
          status: string;
          title: string;
          type?: string | null;
          updated_at: string;
          url?: string | null;
          workspace_id: string;
        };
        Update: {
          closed_reason?: string | null;
          company_id?: string;
          created_at?: string;
          deadline?: string | null;
          id?: string;
          notes?: string | null;
          priority?: string | null;
          status?: string;
          title?: string;
          type?: string | null;
          updated_at?: string;
          url?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_company_fkey";
            columns: ["workspace_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunity_people: {
        Row: {
          opportunity_id: string;
          person_id: string;
          position: number;
          workspace_id: string;
        };
        Insert: {
          opportunity_id: string;
          person_id: string;
          position: number;
          workspace_id: string;
        };
        Update: {
          opportunity_id?: string;
          person_id?: string;
          position?: number;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opportunity_people_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "opportunity_people_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "opportunity_people_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          company_id: string | null;
          created_at: string;
          email: string | null;
          id: string;
          linkedin_url: string | null;
          location: string | null;
          name: string;
          notes: string | null;
          outreach_closed_at: string | null;
          outreach_closure_reason: string | null;
          preferred_channel: string | null;
          relationship_status: string;
          role: string | null;
          source_detail: string | null;
          source_kind: string;
          updated_at: string;
          why_relevant: string | null;
          workspace_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at: string;
          email?: string | null;
          id: string;
          linkedin_url?: string | null;
          location?: string | null;
          name: string;
          notes?: string | null;
          outreach_closed_at?: string | null;
          outreach_closure_reason?: string | null;
          preferred_channel?: string | null;
          relationship_status: string;
          role?: string | null;
          source_detail?: string | null;
          source_kind: string;
          updated_at: string;
          why_relevant?: string | null;
          workspace_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          linkedin_url?: string | null;
          location?: string | null;
          name?: string;
          notes?: string | null;
          outreach_closed_at?: string | null;
          outreach_closure_reason?: string | null;
          preferred_channel?: string | null;
          relationship_status?: string;
          role?: string | null;
          source_detail?: string | null;
          source_kind?: string;
          updated_at?: string;
          why_relevant?: string | null;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "people_company_fkey";
            columns: ["workspace_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "people_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          education_course: string | null;
          education_graduation_year: number | null;
          education_institution: string | null;
          email: string;
          goal_objective: string | null;
          goal_target_locations: string[] | null;
          goal_target_roles: string[] | null;
          goal_target_sectors: string[] | null;
          id: string;
          name: string;
          onboarding_completed_at: string | null;
          time_zone: string;
          updated_at: string;
        };
        Insert: {
          created_at: string;
          education_course?: string | null;
          education_graduation_year?: number | null;
          education_institution?: string | null;
          email: string;
          goal_objective?: string | null;
          goal_target_locations?: string[] | null;
          goal_target_roles?: string[] | null;
          goal_target_sectors?: string[] | null;
          id: string;
          name: string;
          onboarding_completed_at?: string | null;
          time_zone: string;
          updated_at: string;
        };
        Update: {
          created_at?: string;
          education_course?: string | null;
          education_graduation_year?: number | null;
          education_institution?: string | null;
          email?: string;
          goal_objective?: string | null;
          goal_target_locations?: string[] | null;
          goal_target_roles?: string[] | null;
          goal_target_sectors?: string[] | null;
          id?: string;
          name?: string;
          onboarding_completed_at?: string | null;
          time_zone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      source_facts: {
        Row: {
          company_id: string | null;
          created_at: string;
          id: string;
          observed_on: string | null;
          opportunity_id: string | null;
          person_id: string | null;
          provenance_detail: string | null;
          provenance_kind: string;
          provenance_url: string | null;
          statement: string;
          subject_type: string;
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at: string;
          id: string;
          observed_on?: string | null;
          opportunity_id?: string | null;
          person_id?: string | null;
          provenance_detail?: string | null;
          provenance_kind: string;
          provenance_url?: string | null;
          statement: string;
          subject_type: string;
          updated_at: string;
          workspace_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          id?: string;
          observed_on?: string | null;
          opportunity_id?: string | null;
          person_id?: string | null;
          provenance_detail?: string | null;
          provenance_kind?: string;
          provenance_url?: string | null;
          statement?: string;
          subject_type?: string;
          updated_at?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "source_facts_company_fkey";
            columns: ["workspace_id", "company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "source_facts_opportunity_fkey";
            columns: ["workspace_id", "opportunity_id"];
            isOneToOne: false;
            referencedRelation: "opportunities";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "source_facts_person_fkey";
            columns: ["workspace_id", "person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["workspace_id", "id"];
          },
          {
            foreignKeyName: "source_facts_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspace_members: {
        Row: {
          created_at: string;
          profile_id: string;
          role: string;
          workspace_id: string;
        };
        Insert: {
          created_at: string;
          profile_id: string;
          role?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          profile_id?: string;
          role?: string;
          workspace_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspace_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey";
            columns: ["workspace_id"];
            isOneToOne: false;
            referencedRelation: "workspaces";
            referencedColumns: ["id"];
          },
        ];
      };
      workspaces: {
        Row: {
          created_at: string;
          id: string;
          owner_id: string;
        };
        Insert: {
          created_at: string;
          id?: string;
          owner_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workspaces_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_draft: { Args: { p_at: string; p_expected: string; p_id: string }; Returns: Json };
      begin_gmail_sync: { Args: { p_min_interval_seconds: number }; Returns: Json };
      bootstrap_account: {
        Args: { p_at: string; p_name: string; p_time_zone: string };
        Returns: string;
      };
      complete_next_action: {
        Args: { p_at: string; p_expected: string; p_id: string };
        Returns: Json;
      };
      complete_onboarding: { Args: { p_at: string; p_records: Json }; Returns: undefined };
      connect_gmail: {
        Args: {
          p_at: string;
          p_email: string;
          p_history_cursor: string;
          p_key_id: string;
          p_scopes: string[];
          p_sealed_refresh_token: string;
        };
        Returns: Json;
      };
      create_draft: { Args: { p_draft: Json }; Returns: Json };
      disconnect_gmail: { Args: Record<PropertyKey, never>; Returns: Json };
      finish_gmail_sync: {
        Args: { p_connection: string; p_history_cursor: string; p_outcome: string };
        Returns: undefined;
      };
      mark_draft_sent: {
        Args: {
          p_at: string;
          p_expected: string;
          p_id: string;
          p_interaction_id: string;
          p_status_after: string;
          p_status_before: string;
          p_summary: string;
        };
        Returns: Json;
      };
      record_gmail_message: { Args: { p_message: Json }; Returns: Json };
      reschedule_next_action: {
        Args: { p_at: string; p_due_on: string; p_expected: string; p_id: string };
        Returns: Json;
      };
      revise_draft: {
        Args: { p_at: string; p_body: string; p_expected: string; p_id: string; p_subject: string };
        Returns: Json;
      };
      save_profile: {
        Args: {
          p_at: string;
          p_education: Json;
          p_expected: string;
          p_goals: Json;
          p_name: string;
          p_time_zone: string;
        };
        Returns: Json;
      };
      take_rate_limit: { Args: { p_bucket: string; p_key_hash: string }; Returns: boolean };
      undo_step: { Args: { p_step: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

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
      absences: {
        Row: {
          absence_date: string
          created_at: string
          employee_id: string
          id: string
          owner_id: string
          reason: string | null
        }
        Insert: {
          absence_date: string
          created_at?: string
          employee_id: string
          id?: string
          owner_id: string
          reason?: string | null
        }
        Update: {
          absence_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          owner_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          owner_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          owner_id: string
          payload?: Json
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          owner_id?: string
          payload?: Json
        }
        Relationships: []
      }
      agreements: {
        Row: {
          category: string | null
          city: string | null
          confirmed: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          params: Json
          source: Database["public"]["Enums"]["agreement_source"]
          state_uf: string | null
          union_name: string | null
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          category?: string | null
          city?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          params?: Json
          source?: Database["public"]["Enums"]["agreement_source"]
          state_uf?: string | null
          union_name?: string | null
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          category?: string | null
          city?: string | null
          confirmed?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          params?: Json
          source?: Database["public"]["Enums"]["agreement_source"]
          state_uf?: string | null
          union_name?: string | null
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      compliance_overrides: {
        Row: {
          created_at: string
          id: string
          justification: string
          owner_id: string
          rule_code: string
          shift_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          justification: string
          owner_id: string
          rule_code: string
          shift_id: string
        }
        Update: {
          created_at?: string
          id?: string
          justification?: string
          owner_id?: string
          rule_code?: string
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_overrides_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_profiles: {
        Row: {
          agreement_id: string | null
          created_at: string
          has_written_agreement: boolean
          id: string
          name: string
          owner_id: string
          params: Json
          regime: Database["public"]["Enums"]["work_regime"]
          updated_at: string
        }
        Insert: {
          agreement_id?: string | null
          created_at?: string
          has_written_agreement?: boolean
          id?: string
          name: string
          owner_id: string
          params?: Json
          regime?: Database["public"]["Enums"]["work_regime"]
          updated_at?: string
        }
        Update: {
          agreement_id?: string | null
          created_at?: string
          has_written_agreement?: boolean
          id?: string
          name?: string
          owner_id?: string
          params?: Json
          regime?: Database["public"]["Enums"]["work_regime"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_profiles_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_templates: {
        Row: {
          created_at: string
          end_time: string
          headcount: number
          id: string
          label: string | null
          owner_id: string
          sector_id: string | null
          sector_only: boolean
          start_time: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          headcount?: number
          id?: string
          label?: string | null
          owner_id: string
          sector_id?: string | null
          sector_only?: boolean
          start_time: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          headcount?: number
          id?: string
          label?: string | null
          owner_id?: string
          sector_id?: string | null
          sector_only?: boolean
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "demand_templates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_constraints: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string | null
          end_time: string | null
          id: string
          kind: Database["public"]["Enums"]["constraint_kind"]
          note: string | null
          owner_id: string
          start_date: string | null
          start_time: string | null
          weekday: number | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          kind: Database["public"]["Enums"]["constraint_kind"]
          note?: string | null
          owner_id: string
          start_date?: string | null
          start_time?: string | null
          weekday?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string | null
          end_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["constraint_kind"]
          note?: string | null
          owner_id?: string
          start_date?: string | null
          start_time?: string | null
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_constraints_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          compliance_profile_id: string | null
          created_at: string
          entry_time: string
          id: string
          journey_hours: number
          name: string
          owner_id: string
          role_profile: Database["public"]["Enums"]["role_profile"]
          sector_id: string | null
        }
        Insert: {
          compliance_profile_id?: string | null
          created_at?: string
          entry_time?: string
          id?: string
          journey_hours?: number
          name: string
          owner_id: string
          role_profile?: Database["public"]["Enums"]["role_profile"]
          sector_id?: string | null
        }
        Update: {
          compliance_profile_id?: string | null
          created_at?: string
          entry_time?: string
          id?: string
          journey_hours?: number
          name?: string
          owner_id?: string
          role_profile?: Database["public"]["Enums"]["role_profile"]
          sector_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_compliance_profile_id_fkey"
            columns: ["compliance_profile_id"]
            isOneToOne: false
            referencedRelation: "compliance_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          city: string | null
          created_at: string
          holiday_date: string
          id: string
          name: string
          owner_id: string
          scope: Database["public"]["Enums"]["holiday_scope"]
          state_uf: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          holiday_date: string
          id?: string
          name: string
          owner_id: string
          scope?: Database["public"]["Enums"]["holiday_scope"]
          state_uf?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          holiday_date?: string
          id?: string
          name?: string
          owner_id?: string
          scope?: Database["public"]["Enums"]["holiday_scope"]
          state_uf?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      schedule_shares: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          owner_id: string
          token: string
          week_start: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          token: string
          week_start: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          token?: string
          week_start?: string
        }
        Relationships: []
      }
      schedule_snapshots: {
        Row: {
          created_at: string
          id: string
          label: string
          owner_id: string
          payload: Json
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          owner_id: string
          payload?: Json
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          payload?: Json
          week_start?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          created_at: string
          employee_id: string | null
          end_time: string
          freelancer_label: string | null
          id: string
          is_extra: boolean
          is_freelancer: boolean
          owner_id: string
          sector_id: string | null
          shift_date: string
          start_time: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          end_time: string
          freelancer_label?: string | null
          id?: string
          is_extra?: boolean
          is_freelancer?: boolean
          owner_id: string
          sector_id?: string | null
          shift_date: string
          start_time: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          end_time?: string
          freelancer_label?: string | null
          id?: string
          is_extra?: boolean
          is_freelancer?: boolean
          owner_id?: string
          sector_id?: string | null
          shift_date?: string
          start_time?: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      agreement_source: "manual" | "ia"
      constraint_kind: "indisponivel_semanal" | "afastamento"
      holiday_scope: "nacional" | "estadual" | "municipal"
      role_profile:
        | "clt_regular"
        | "estagiario"
        | "clt_mulher"
        | "pj"
        | "escala_12x36"
      shift_status: "scheduled" | "absent" | "completed"
      work_regime:
        | "padrao_5x2"
        | "padrao_6x1"
        | "escala_12x36"
        | "escala_24x72"
        | "estagio"
        | "parcial"
        | "intermitente"
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
    Enums: {
      agreement_source: ["manual", "ia"],
      constraint_kind: ["indisponivel_semanal", "afastamento"],
      holiday_scope: ["nacional", "estadual", "municipal"],
      role_profile: [
        "clt_regular",
        "estagiario",
        "clt_mulher",
        "pj",
        "escala_12x36",
      ],
      shift_status: ["scheduled", "absent", "completed"],
      work_regime: [
        "padrao_5x2",
        "padrao_6x1",
        "escala_12x36",
        "escala_24x72",
        "estagio",
        "parcial",
        "intermitente",
      ],
    },
  },
} as const

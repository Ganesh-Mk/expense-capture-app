import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          grade: number
          role: 'employee' | 'admin'
          department: string
          employee_code: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          color: string
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expense_categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
      }
      expense_rules: {
        Row: {
          id: string
          grade: number
          category_id: string
          daily_limit: number
          per_expense_limit: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expense_rules']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expense_rules']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          currency: string
          description: string
          expense_date: string
          status: 'pending' | 'approved' | 'rejected' | 'flagged'
          rejection_reason: string | null
          receipt_url: string | null
          receipt_filename: string | null
          is_from_chat: boolean
          merchant_name: string | null
          location: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          role: 'user' | 'assistant'
          content: string
          message_type: 'text' | 'expense_parsed' | 'receipt_upload' | 'system'
          parsed_expense_id: string | null
          metadata: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['chat_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['chat_messages']['Insert']>
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row']
export type ExpenseRule = Database['public']['Tables']['expense_rules']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row']

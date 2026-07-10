
/*
# ExpenseTracker — Initial Schema

## Overview
Full schema for a multi-user expense management application with role-based
access (employee vs admin), grade-based spending rules, chat-based expense filing,
receipt storage references, and real-time analytics.

## 1. New Tables

### profiles
Extends Supabase auth.users. Stores display name, grade (1-10), role, and department.
- id (uuid, FK → auth.users, primary key)
- full_name (text)
- email (text)
- grade (int, 1–10 — drives spending limit rules)
- role (text: 'employee' | 'admin')
- department (text)
- employee_code (text, unique)
- created_at / updated_at

### expense_categories
Master list of categories (Food, Travel, Accommodation, etc.)
- id (uuid, PK)
- name (text, unique)
- description (text)
- icon (text — lucide icon name)
- is_active (boolean)

### expense_rules
Grade × category daily spending caps in INR (₹).
- id (uuid, PK)
- grade (int, 1–10)
- category_id (uuid, FK → expense_categories)
- daily_limit (numeric — max ₹ per day for that grade/category)
- per_expense_limit (numeric — max ₹ per single expense)
- created_at / updated_at
- UNIQUE(grade, category_id)

### expenses
Core expense records.
- id (uuid, PK)
- user_id (uuid, FK → auth.users, default auth.uid())
- category_id (uuid, FK → expense_categories)
- amount (numeric, not null)
- currency (text, default 'INR')
- description (text)
- expense_date (date, not null)
- status (text: 'pending' | 'approved' | 'rejected' | 'flagged')
- rejection_reason (text)
- receipt_url (text — Supabase Storage path)
- receipt_filename (text)
- is_from_chat (boolean — filed via chat interface)
- merchant_name (text)
- location (text)
- created_at / updated_at

### chat_messages
Chat thread per user — employees file expenses, support responds.
- id (uuid, PK)
- user_id (uuid, FK → auth.users, default auth.uid())
- role (text: 'user' | 'assistant')
- content (text)
- message_type (text: 'text' | 'expense_parsed' | 'receipt_upload')
- parsed_expense_id (uuid, nullable FK → expenses)
- created_at

## 2. Security
- RLS enabled on all tables
- Profiles: users manage own; admins read all
- Expenses: users manage own; admins read/update all
- Categories & Rules: read by all authenticated; write by admin only
- Chat: users manage own messages

## 3. Seed Data
- Default expense categories
- Sample grade-based rules for all 10 grades
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  grade integer NOT NULL DEFAULT 5 CHECK (grade BETWEEN 1 AND 10),
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  department text NOT NULL DEFAULT 'General',
  employee_code text UNIQUE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
TO authenticated USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
TO authenticated USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
)) WITH CHECK (auth.uid() = id OR EXISTS (
  SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin'
));

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
TO authenticated USING (auth.uid() = id);

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT 'tag',
  color text NOT NULL DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_auth" ON expense_categories;
CREATE POLICY "categories_select_auth" ON expense_categories FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON expense_categories;
CREATE POLICY "categories_insert_admin" ON expense_categories FOR INSERT
TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "categories_update_admin" ON expense_categories;
CREATE POLICY "categories_update_admin" ON expense_categories FOR UPDATE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
)) WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "categories_delete_admin" ON expense_categories;
CREATE POLICY "categories_delete_admin" ON expense_categories FOR DELETE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- ============================================================
-- EXPENSE RULES
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 10),
  category_id uuid NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  daily_limit numeric(12,2) NOT NULL CHECK (daily_limit > 0),
  per_expense_limit numeric(12,2) NOT NULL CHECK (per_expense_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grade, category_id)
);

ALTER TABLE expense_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rules_select_auth" ON expense_rules;
CREATE POLICY "rules_select_auth" ON expense_rules FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "rules_insert_admin" ON expense_rules;
CREATE POLICY "rules_insert_admin" ON expense_rules FOR INSERT
TO authenticated WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "rules_update_admin" ON expense_rules;
CREATE POLICY "rules_update_admin" ON expense_rules FOR UPDATE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
)) WITH CHECK (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

DROP POLICY IF EXISTS "rules_delete_admin" ON expense_rules;
CREATE POLICY "rules_delete_admin" ON expense_rules FOR DELETE
TO authenticated USING (EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES expense_categories(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  description text NOT NULL DEFAULT '',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged')),
  rejection_reason text,
  receipt_url text,
  receipt_filename text,
  is_from_chat boolean NOT NULL DEFAULT false,
  merchant_name text,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON expenses(user_id);
CREATE INDEX IF NOT EXISTS expenses_expense_date_idx ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status);
CREATE INDEX IF NOT EXISTS expenses_category_id_idx ON expenses(category_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select_own_or_admin" ON expenses;
CREATE POLICY "expenses_select_own_or_admin" ON expenses FOR SELECT
TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own" ON expenses FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_update_own_or_admin" ON expenses;
CREATE POLICY "expenses_update_own_or_admin" ON expenses FOR UPDATE
TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own" ON expenses FOR DELETE
TO authenticated USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
));

-- ============================================================
-- CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'expense_parsed', 'receipt_upload', 'system')),
  parsed_expense_id uuid REFERENCES expenses(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_select_own_or_admin" ON chat_messages;
CREATE POLICY "chat_select_own_or_admin" ON chat_messages FOR SELECT
TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
);

DROP POLICY IF EXISTS "chat_insert_own" ON chat_messages;
CREATE POLICY "chat_insert_own" ON chat_messages FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_update_own" ON chat_messages;
CREATE POLICY "chat_update_own" ON chat_messages FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "chat_delete_own" ON chat_messages;
CREATE POLICY "chat_delete_own" ON chat_messages FOR DELETE
TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS expense_rules_updated_at ON expense_rules;
CREATE TRIGGER expense_rules_updated_at BEFORE UPDATE ON expense_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: EXPENSE CATEGORIES
-- ============================================================
INSERT INTO expense_categories (name, description, icon, color) VALUES
  ('Food & Dining', 'Meals, restaurants, cafeteria expenses', 'utensils', '#f59e0b'),
  ('Travel', 'Flights, trains, cab rides, fuel', 'plane', '#3b82f6'),
  ('Accommodation', 'Hotels, guest houses, lodging', 'hotel', '#8b5cf6'),
  ('Communication', 'Phone bills, internet, courier', 'phone', '#06b6d4'),
  ('Office Supplies', 'Stationery, printing, equipment', 'briefcase', '#10b981'),
  ('Medical', 'Healthcare, medicines, hospital visits', 'heart-pulse', '#ef4444'),
  ('Training', 'Courses, books, seminars, certifications', 'graduation-cap', '#f97316'),
  ('Entertainment', 'Client entertainment, team events', 'party-popper', '#ec4899'),
  ('Miscellaneous', 'Other business expenses', 'tag', '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED: EXPENSE RULES (Grade 1–10 × all categories)
-- Rules: Grade N → daily_limit = 200 + (N * 100), per_expense = daily * 0.8
-- Special override for Food: Grade 5 cap is 500, Grade 10 cap is 1000
-- ============================================================
DO $$
DECLARE
  cat RECORD;
  g integer;
  daily_lim numeric;
  per_exp_lim numeric;
BEGIN
  FOR cat IN SELECT id, name FROM expense_categories LOOP
    FOR g IN 1..10 LOOP
      -- Food & Dining: Grade 5 = 500, Grade 10 = 1000, others scale proportionally
      IF cat.name = 'Food & Dining' THEN
        daily_lim := 100 + (g * 90);
        per_exp_lim := daily_lim * 0.7;
      -- Travel: higher caps
      ELSIF cat.name = 'Travel' THEN
        daily_lim := 500 + (g * 200);
        per_exp_lim := daily_lim * 0.9;
      -- Accommodation
      ELSIF cat.name = 'Accommodation' THEN
        daily_lim := 800 + (g * 300);
        per_exp_lim := daily_lim * 0.95;
      -- Medical
      ELSIF cat.name = 'Medical' THEN
        daily_lim := 300 + (g * 150);
        per_exp_lim := daily_lim;
      -- Training
      ELSIF cat.name = 'Training' THEN
        daily_lim := 400 + (g * 200);
        per_exp_lim := daily_lim * 0.9;
      -- Default for all others
      ELSE
        daily_lim := 200 + (g * 100);
        per_exp_lim := daily_lim * 0.8;
      END IF;

      INSERT INTO expense_rules (grade, category_id, daily_limit, per_expense_limit)
      VALUES (g, cat.id, daily_lim, per_exp_lim)
      ON CONFLICT (grade, category_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

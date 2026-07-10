import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
}

interface ValidationRequest {
  user_id: string
  category_id: string
  amount: number
  expense_date: string
  grade: number
}

interface ValidationResult {
  valid: boolean
  status: "pending" | "flagged" | "rejected"
  violations: string[]
  rule?: {
    daily_limit: number
    per_expense_limit: number
    daily_spent: number
    daily_remaining: number
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const body: ValidationRequest = await req.json()
    const { user_id, category_id, amount, expense_date, grade } = body

    if (!user_id || !category_id || !amount || !expense_date || !grade) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Fetch the rule for this grade + category
    const { data: rule, error: ruleError } = await supabase
      .from("expense_rules")
      .select("*")
      .eq("grade", grade)
      .eq("category_id", category_id)
      .maybeSingle()

    if (ruleError) throw ruleError

    const violations: string[] = []
    let status: "pending" | "flagged" | "rejected" = "pending"

    if (!rule) {
      // No rule = no cap, allow it
      return new Response(
        JSON.stringify({
          valid: true,
          status: "pending",
          violations: [],
          rule: null,
        } satisfies ValidationResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check per-expense limit
    if (amount > rule.per_expense_limit) {
      violations.push(
        `Amount ₹${amount.toFixed(2)} exceeds the per-expense limit of ₹${rule.per_expense_limit.toFixed(2)} for Grade ${grade}`
      )
      status = "flagged"
    }

    // Check daily cumulative limit
    const { data: todayExpenses, error: expErr } = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", user_id)
      .eq("category_id", category_id)
      .eq("expense_date", expense_date)
      .neq("status", "rejected")

    if (expErr) throw expErr

    const dailySpent = (todayExpenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
    const projectedDaily = dailySpent + amount

    if (projectedDaily > rule.daily_limit) {
      violations.push(
        `Total for this category today would be ₹${projectedDaily.toFixed(2)}, exceeding the daily limit of ₹${rule.daily_limit.toFixed(2)} for Grade ${grade}`
      )
      if (amount > rule.daily_limit) {
        status = "rejected"
      } else {
        status = "flagged"
      }
    }

    // Hard reject: amount is more than 3x the per_expense_limit
    if (amount > rule.per_expense_limit * 3) {
      status = "rejected"
    }

    return new Response(
      JSON.stringify({
        valid: violations.length === 0,
        status,
        violations,
        rule: {
          daily_limit: rule.daily_limit,
          per_expense_limit: rule.per_expense_limit,
          daily_spent: dailySpent,
          daily_remaining: Math.max(0, rule.daily_limit - dailySpent),
        },
      } satisfies ValidationResult),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

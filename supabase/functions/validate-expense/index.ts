import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
  "Access-Control-Max-Age": "86400",
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
  } | null
}

const buildResponse = (data: unknown, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  })
}

Deno.serve(async (req: Request) => {
  // Ensure OPTIONS requests always return HTTP 200 with CORS headers immediately
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders })
  }

  console.log(`[validate-expense] Received ${req.method} request`)

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[validate-expense] Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.")
      return buildResponse({ error: "Server configuration error: missing credentials" }, 500)
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authorization verification
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      console.warn("[validate-expense] Warning: Missing Authorization header")
      return buildResponse({ error: "Unauthorized: Missing Authorization header" }, 401)
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      console.error("[validate-expense] Auth verification failed:", authError?.message || "Invalid token")
      return buildResponse({ error: "Unauthorized: Invalid session or token" }, 401)
    }

    // Safely parse body
    let body: ValidationRequest
    try {
      body = await req.json()
    } catch (parseErr) {
      console.error("[validate-expense] JSON parse error:", (parseErr as Error).message)
      return buildResponse({ error: "Invalid JSON request body" }, 400)
    }

    const { user_id, category_id, amount, expense_date, grade } = body
    console.log(`[validate-expense] Validating for user: ${user_id}, category: ${category_id}, amount: ${amount}, date: ${expense_date}, grade: ${grade}`)

    // Missing field check
    if (!user_id || !category_id || amount === undefined || amount === null || !expense_date || grade === undefined || grade === null) {
      console.warn("[validate-expense] Warning: Missing required fields in body:", body)
      return buildResponse({ error: "Missing required fields: user_id, category_id, amount, expense_date, and grade are required." }, 400)
    }

    // Role & ownership check: standard employees can only validate their own expenses
    if (user.id !== user_id) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileErr || profile?.role !== "admin") {
        console.warn(`[validate-expense] Security Warning: User ${user.id} attempted to validate for user ${user_id}`)
        return buildResponse({ error: "Unauthorized: Cannot validate expense for another user" }, 403)
      }
    }

    // Fetch the rule for this grade + category
    const { data: rule, error: ruleError } = await supabase
      .from("expense_rules")
      .select("*")
      .eq("grade", grade)
      .eq("category_id", category_id)
      .maybeSingle()

    if (ruleError) {
      console.error("[validate-expense] Database error fetching rule:", ruleError.message)
      throw ruleError
    }

    const violations: string[] = []
    let status: "pending" | "flagged" | "rejected" = "pending"

    if (!rule) {
      console.log(`[validate-expense] No rule defined for grade ${grade} and category ${category_id}. Allowing expense.`)
      return buildResponse({
        valid: true,
        status: "pending",
        violations: [],
        rule: null,
      } satisfies ValidationResult)
    }

    const numAmount = Number(amount)
    const perExpenseLimit = Number(rule.per_expense_limit)
    const dailyLimit = Number(rule.daily_limit)

    // Check per-expense limit
    if (numAmount > perExpenseLimit) {
      violations.push(
        `Amount ₹${numAmount.toFixed(2)} exceeds the per-expense limit of ₹${perExpenseLimit.toFixed(2)} for Grade ${grade}`
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

    if (expErr) {
      console.error("[validate-expense] Database error fetching today's expenses:", expErr.message)
      throw expErr
    }

    const dailySpent = (todayExpenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0)
    const projectedDaily = dailySpent + numAmount

    if (projectedDaily > dailyLimit) {
      violations.push(
        `Total for this category today would be ₹${projectedDaily.toFixed(2)}, exceeding the daily limit of ₹${dailyLimit.toFixed(2)} for Grade ${grade}`
      )
      if (numAmount > dailyLimit) {
        status = "rejected"
      } else {
        status = "flagged"
      }
    }

    // Hard reject: amount is more than 3x the per_expense_limit
    if (numAmount > perExpenseLimit * 3) {
      violations.push(
        `Amount ₹${numAmount.toFixed(2)} is more than 3x the per-expense limit of ₹${perExpenseLimit.toFixed(2)} (Hard Limit Exceeded)`
      )
      status = "rejected"
    }

    const result: ValidationResult = {
      valid: violations.length === 0,
      status,
      violations,
      rule: {
        daily_limit: dailyLimit,
        per_expense_limit: perExpenseLimit,
        daily_spent: dailySpent,
        daily_remaining: Math.max(0, dailyLimit - dailySpent),
      },
    }

    console.log(`[validate-expense] Validation complete. Status: ${status}, violations: ${violations.length}`)
    return buildResponse(result)

  } catch (err) {
    console.error("[validate-expense] Unhandled exception occurred:", err)
    return buildResponse({ error: (err as Error).message || "An unexpected error occurred." }, 500)
  }
})

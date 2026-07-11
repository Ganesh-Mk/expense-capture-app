import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY
const password = 'password123'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
}

const employees = [
  { name: 'Aarav Mehta', email: 'aarav.mehta@expenseflow.test', grade: 3, department: 'Sales', code: 'EMP1001' },
  { name: 'Priya Nair', email: 'priya.nair@expenseflow.test', grade: 5, department: 'Engineering', code: 'EMP1002' },
  { name: 'Rohan Kapoor', email: 'rohan.kapoor@expenseflow.test', grade: 7, department: 'Operations', code: 'EMP1003' },
  { name: 'Sneha Iyer', email: 'sneha.iyer@expenseflow.test', grade: 8, department: 'Finance', code: 'EMP1004' },
  { name: 'Kabir Sharma', email: 'kabir.sharma@expenseflow.test', grade: 4, department: 'Marketing', code: 'EMP1005' },
  { name: 'Ananya Rao', email: 'ananya.rao@expenseflow.test', grade: 6, department: 'Product', code: 'EMP1006' },
  { name: 'Vikram Singh', email: 'vikram.singh@expenseflow.test', grade: 9, department: 'Management', code: 'EMP1007' },
  { name: 'Meera Joshi', email: 'meera.joshi@expenseflow.test', grade: 2, department: 'HR', code: 'EMP1008' },
]

const demoAdmin = {
  name: 'Admin',
  email: 'admin@expenseflow.test',
  grade: 10,
  department: 'Management',
  code: 'EMP9999',
  role: 'admin',
}

const defaultCategories = [
  { name: 'Food & Dining', description: 'Meals, restaurants, cafeteria expenses', icon: 'utensils', color: '#f59e0b', is_active: true },
  { name: 'Travel', description: 'Flights, trains, cab rides, fuel', icon: 'plane', color: '#3b82f6', is_active: true },
  { name: 'Accommodation', description: 'Hotels, guest houses, lodging', icon: 'hotel', color: '#8b5cf6', is_active: true },
  { name: 'Communication', description: 'Phone bills, internet, courier', icon: 'phone', color: '#06b6d4', is_active: true },
  { name: 'Office Supplies', description: 'Stationery, printing, equipment', icon: 'briefcase', color: '#10b981', is_active: true },
  { name: 'Medical', description: 'Healthcare, medicines, hospital visits', icon: 'heart-pulse', color: '#ef4444', is_active: true },
  { name: 'Training', description: 'Courses, books, seminars, certifications', icon: 'graduation-cap', color: '#f97316', is_active: true },
  { name: 'Entertainment', description: 'Client entertainment, team events', icon: 'party-popper', color: '#ec4899', is_active: true },
  { name: 'Miscellaneous', description: 'Other business expenses', icon: 'tag', color: '#6b7280', is_active: true },
]

const merchantByCategory = {
  'Food & Dining': ['Cafe Coffee Day', 'Zomato Business', 'Barbeque Nation', 'Office Cafeteria'],
  Travel: ['Uber India', 'IndiGo', 'Ola Cabs', 'IRCTC'],
  Accommodation: ['Taj Business Hotel', 'Lemon Tree', 'Ginger Hotels'],
  Communication: ['Airtel', 'Jio Fiber', 'Blue Dart'],
  'Office Supplies': ['Staples India', 'Printo', 'Amazon Business'],
  Medical: ['Apollo Pharmacy', 'Practo', 'Fortis Clinic'],
  Training: ['Coursera', 'Udemy Business', 'LinkedIn Learning'],
  Entertainment: ['PVR Cinemas', 'Team Dinner Venue', 'BookMyShow'],
  Miscellaneous: ['Local Vendor', 'Business Services', 'Misc Store'],
}

const descriptionsByCategory = {
  'Food & Dining': ['Client lunch', 'Team meal', 'Airport meal', 'Working dinner'],
  Travel: ['Client site cab', 'Airport transfer', 'Sales visit travel', 'Intercity train fare'],
  Accommodation: ['Business trip hotel', 'Client visit stay', 'Conference lodging'],
  Communication: ['Monthly phone bill', 'Internet reimbursement', 'Courier charges'],
  'Office Supplies': ['Printer cartridges', 'Notebook and stationery', 'Desk accessories'],
  Medical: ['Medicine reimbursement', 'Annual health checkup', 'Clinic consultation'],
  Training: ['Certification course', 'Workshop registration', 'Technical books'],
  Entertainment: ['Client entertainment', 'Team outing', 'Quarterly team event'],
  Miscellaneous: ['Parking charges', 'Business service fee', 'Small office purchase'],
}

const statusPlan = ['approved', 'approved', 'approved', 'pending', 'flagged', 'rejected']

function demoClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function pick(list, index) {
  return list[index % list.length]
}

function isoDateMonthsAgo(monthsAgo, dayOffset) {
  const date = new Date()
  date.setMonth(date.getMonth() - monthsAgo)
  date.setDate(Math.min(25, 4 + dayOffset))
  return date.toISOString().slice(0, 10)
}

function limitsFor(categoryName, grade) {
  let dailyLimit

  if (categoryName === 'Food & Dining') dailyLimit = 100 + grade * 90
  else if (categoryName === 'Travel') dailyLimit = 500 + grade * 200
  else if (categoryName === 'Accommodation') dailyLimit = 800 + grade * 300
  else if (categoryName === 'Medical') dailyLimit = 300 + grade * 150
  else if (categoryName === 'Training') dailyLimit = 400 + grade * 200
  else dailyLimit = 200 + grade * 100

  return {
    daily_limit: dailyLimit,
    per_expense_limit:
      categoryName === 'Medical'
        ? dailyLimit
        : Math.round(dailyLimit * (categoryName === 'Accommodation' ? 0.95 : categoryName === 'Travel' || categoryName === 'Training' ? 0.9 : categoryName === 'Food & Dining' ? 0.7 : 0.8)),
  }
}

async function ensureUser(employee) {
  const client = demoClient()
  let auth = await client.auth.signInWithPassword({
    email: employee.email,
    password,
  })

  if (auth.error && employee.code) {
    const adminClient = demoClient()
    const adminEmails = ['admin@expenseflow.test', 'demo.admin@expenseflow.test']
    for (const email of adminEmails) {
      const adminAuth = await adminClient.auth.signInWithPassword({ email, password })
      if (!adminAuth.error) break
    }

    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('email')
      .eq('employee_code', employee.code)
      .maybeSingle()

    if (existingProfile?.email && existingProfile.email !== employee.email) {
      auth = await client.auth.signInWithPassword({
        email: existingProfile.email,
        password,
      })
    }

    await adminClient.auth.signOut()
  }

  if (auth.error) {
    auth = await client.auth.signUp({
      email: employee.email,
      password,
    })
  }

  if (auth.error) {
    throw new Error(`${employee.email}: ${auth.error.message}`)
  }

  const user = auth.data.user
  if (!user) {
    throw new Error(`${employee.email}: sign up did not return a user`)
  }

  const { error: profileError } = await client.from('profiles').upsert({
    id: user.id,
    full_name: employee.name,
    email: employee.email,
    grade: employee.grade,
    role: employee.role ?? 'employee',
    department: employee.department,
    employee_code: employee.code,
  })

  if (profileError) {
    throw new Error(`${employee.email}: ${profileError.message}`)
  }

  return { client, user }
}

async function ensureCategoriesAndRules(client) {
  let { data: categories, error: selectError } = await client
    .from('expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (selectError) {
    throw new Error(selectError.message)
  }

  if (!categories?.length) {
    const { error: insertError } = await client
      .from('expense_categories')
      .upsert(defaultCategories, { onConflict: 'name' })

    if (insertError) {
      throw new Error(insertError.message)
    }

    const result = await client
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (result.error) {
      throw new Error(result.error.message)
    }

    categories = result.data ?? []
  }

  const { data: existingRules, error: rulesError } = await client
    .from('expense_rules')
    .select('id')
    .limit(1)

  if (rulesError) {
    throw new Error(rulesError.message)
  }

  if (!existingRules?.length) {
    const rules = categories.flatMap((category) =>
      Array.from({ length: 10 }, (_, index) => {
        const grade = index + 1
        return {
          grade,
          category_id: category.id,
          ...limitsFor(category.name, grade),
        }
      }),
    )

    const { error: insertRulesError } = await client
      .from('expense_rules')
      .upsert(rules, { onConflict: 'grade,category_id' })

    if (insertRulesError) {
      throw new Error(insertRulesError.message)
    }
  }

  return categories
}

async function main() {
  const { client: adminClient } = await ensureUser(demoAdmin)
  const categories = await ensureCategoriesAndRules(adminClient)

  let insertedExpenses = 0
  let insertedMessages = 0

  for (const [employeeIndex, employee] of employees.entries()) {
    const { client, user } = await ensureUser(employee)

    await client.from('chat_messages').delete().eq('user_id', user.id)
    await client.from('expenses').delete().eq('user_id', user.id)

    const expenses = Array.from({ length: 9 }, (_, expenseIndex) => {
      const category = categories[(employeeIndex + expenseIndex) % categories.length]
      const status = statusPlan[(employeeIndex + expenseIndex) % statusPlan.length]
      const baseAmount = 180 + employee.grade * 85 + expenseIndex * 115
      const amount = status === 'flagged' ? baseAmount + 1800 : baseAmount
      const categoryMerchants = merchantByCategory[category.name] ?? merchantByCategory.Miscellaneous
      const categoryDescriptions = descriptionsByCategory[category.name] ?? descriptionsByCategory.Miscellaneous

      return {
        user_id: user.id,
        category_id: category.id,
        amount,
        currency: 'INR',
        description: pick(categoryDescriptions, expenseIndex),
        expense_date: isoDateMonthsAgo(expenseIndex % 6, employeeIndex + expenseIndex),
        status,
        rejection_reason:
          status === 'rejected'
            ? pick(['Receipt unreadable', 'Personal expense', 'Policy limit exceeded'], expenseIndex)
            : null,
        receipt_url:
          expenseIndex % 3 === 0
            ? `https://example.com/receipts/${employee.code}-${expenseIndex + 1}.pdf`
            : null,
        receipt_filename:
          expenseIndex % 3 === 0 ? `${employee.code}-${expenseIndex + 1}.pdf` : null,
        is_from_chat: expenseIndex % 4 === 0,
        merchant_name: pick(categoryMerchants, employeeIndex + expenseIndex),
        location: pick(['Bengaluru', 'Mumbai', 'Delhi', 'Pune', 'Hyderabad', 'Chennai'], employeeIndex + expenseIndex),
      }
    })

    const { error: expenseError } = await client.from('expenses').insert(expenses)
    if (expenseError) {
      throw new Error(`${employee.email}: ${expenseError.message}`)
    }

    insertedExpenses += expenses.length

    const messages = [
      {
        user_id: user.id,
        role: 'user',
        content: 'Please file my airport cab receipt for reimbursement.',
        message_type: 'text',
        metadata: { seeded: true },
      },
      {
        user_id: user.id,
        role: 'assistant',
        content: 'I found the travel details and created a draft expense.',
        message_type: 'expense_parsed',
        metadata: { seeded: true },
      },
    ]

    const { error: messageError } = await client.from('chat_messages').insert(messages)
    if (messageError) {
      throw new Error(`${employee.email}: ${messageError.message}`)
    }

    insertedMessages += messages.length
    await client.auth.signOut()
  }

  console.log(`Seeded ${employees.length} employees`)
  console.log(`Inserted ${insertedExpenses} expenses`)
  console.log(`Inserted ${insertedMessages} chat messages`)
  console.log(`Shared password: ${password}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

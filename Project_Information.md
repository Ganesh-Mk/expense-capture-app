# ExpenseFlow - Complete Feature Walkthrough

## Project Overview

**ExpenseFlow** is a full-stack web application for capturing, validating, and managing employee expenses. Built with **React + TypeScript** frontend, **Supabase** backend, and **PostgreSQL** database.

**Problem Statement Solved:**
✅ Expense capture web app with React
✅ Frontend + backend validation with grade-based rules
✅ SQL database (PostgreSQL via Supabase)
✅ Receipt storage (Supabase Storage)
✅ Chat interface for expense filing & support
✅ Employee expense retrieval + Admin dashboard & analytics
✅ Native authentication + Role-based access control

---

## 1. ARCHITECTURE OVERVIEW

### Tech Stack

| Layer                    | Technology                                             |
| ------------------------ | ------------------------------------------------------ |
| **Frontend**       | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| **UI Components**  | Shadcn/ui (Radix UI primitives)                        |
| **Backend**        | Supabase (PostgreSQL + Edge Functions + Storage)       |
| **Database**       | PostgreSQL with Row-Level Security (RLS)               |
| **Authentication** | Supabase Auth (native email/password)                  |
| **Charts**         | Recharts                                               |
| **Forms**          | React Hook Form + Zod validation                       |

### Project Structure

```
src/
├── components/
│   ├── AppLayout.tsx          # Main layout with sidebar & header
│   ├── theme-provider.tsx      # Light/dark theme toggle
│   ├── ProtectedRoute.tsx       # Auth guard + role-based access
│   └── ui/                      # 30+ shadcn/ui components
├── context/
│   └── AuthContext.tsx         # Global auth state management
├── hooks/
│   └── use-mobile.ts           # Responsive design helper
├── lib/
│   ├── supabase.ts            # Client initialization + TypeScript types
│   └── utils.ts               # Utility functions
├── pages/
│   ├── auth/                  # Login, Register
│   ├── dashboard/             # Employee dashboard
│   ├── expenses/              # New Expense, My Expenses
│   ├── chat/                  # Chat Support
│   └── admin/                 # Admin: Employees, Expenses, Analytics
└── supabase/
    ├── functions/
    │   └── validate-expense/  # Edge Function for server-side validation
    └── migrations/            # SQL schema + RLS policies
```

---

## 2. AUTHENTICATION & AUTHORIZATION

### How It Works

**Native Email/Password Auth:**

- Uses Supabase Auth (built on PostgreSQL `auth.users` table)
- No OAuth, no external dependencies
- Users sign up with email + password + profile info (name, grade, department, role)

**File:** [src/context/AuthContext.tsx](src/context/AuthContext.tsx)

### Sign Up Flow

```typescript
async function signUp(
  email: string,
  password: string,
  fullName: string,
  grade: number, // 1-10 determines expense limits
  department: string, // "Engineering", "Sales", etc.
  role: "employee" | "admin", // Controls dashboard access
);
```

**What Happens:**

1. Supabase Auth creates user in `auth.users`
2. Trigger automatically creates profile in `profiles` table
3. Profile stores: full_name, email, grade, role, department, employee_code
4. AuthContext fetches profile and stores in React state

### Role-Based Access

| Route                       | Employee | Admin |
| --------------------------- | -------- | ----- |
| `/dashboard`              | ✅       | ✅    |
| `/expenses/new`           | ✅       | ✅    |
| `/expenses` (My Expenses) | ✅       | ✅    |
| `/chat`                   | ✅       | ✅    |
| `/admin/employees`        | ❌       | ✅    |
| `/admin/expenses`         | ❌       | ✅    |
| `/admin/analytics`        | ❌       | ✅    |

**ProtectedRoute Component:** [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)

- Checks if user is logged in
- For admin routes: checks `profile.role === 'admin'`
- Redirects to login if not authenticated

---

## 3. DATABASE SCHEMA & SECURITY

### Table Structure

#### **profiles** (extends Supabase auth.users)

```sql
id (uuid, PK → auth.users)
full_name, email
grade (1-10)        -- Determines spending limits
role ('employee' | 'admin')
department
employee_code (unique identifier like "EMP001")
avatar_url
created_at, updated_at
```

#### **expense_categories** (Master list)

```sql
id (uuid, PK)
name (unique): "Food & Dining", "Travel", "Accommodation", etc.
description
icon (lucide icon name)
color (hex code for UI)
is_active (boolean)
created_at
```

#### **expense_rules** (Grade-based limits)

```sql
id (uuid, PK)
grade (1-10)
category_id (FK → expense_categories)
daily_limit (₹ per day for this grade/category)
per_expense_limit (₹ max per single expense)
created_at, updated_at
UNIQUE(grade, category_id)  -- One rule per grade/category combo
```

**Example Rules Generated:**

- Grade 5, Food & Dining: daily_limit = ₹500, per_expense = ₹350
- Grade 10, Food & Dining: daily_limit = ₹1000, per_expense = ₹700
- Grade 5, Travel: daily_limit = ₹1500, per_expense = ₹1350
- Grade 10, Travel: daily_limit = ₹3500, per_expense = ₹3150

Algorithm: `daily_limit = 200 + (grade × 100)` with category-specific multipliers.

#### **expenses** (Core data)

```sql
id (uuid, PK)
user_id (uuid, FK → auth.users)
category_id (uuid, FK → expense_categories)
amount (numeric, must be > 0)
currency (default: 'INR')
description
expense_date (date of expense, not submission date)
status ('pending' | 'approved' | 'rejected' | 'flagged')
rejection_reason (text, only if rejected)
receipt_url (Supabase Storage URL)
receipt_filename
is_from_chat (boolean — true if filed via Chat)
merchant_name ("Swiggy", "OYO", etc.)
location ("Mumbai", "Delhi", etc.)
created_at, updated_at
Indexes: user_id, expense_date, status, category_id
```

#### **chat_messages** (Real-time chat thread)

```sql
id (uuid, PK)
user_id (uuid, FK → auth.users)
role ('user' | 'assistant')
content (message text)
message_type ('text' | 'expense_parsed' | 'receipt_upload' | 'system')
parsed_expense_id (FK → expenses, if expense was auto-created)
metadata (JSON for extra data)
created_at
Index: user_id
```

### Row-Level Security (RLS)

**All tables have RLS enabled.** Policies control who sees/modifies what:

| Table                   | SELECT                         | INSERT           | UPDATE                   | DELETE                   |
| ----------------------- | ------------------------------ | ---------------- | ------------------------ | ------------------------ |
| **profiles**      | User sees own + admin sees all | User creates own | User updates own + admin | User deletes own         |
| **expenses**      | User sees own + admin sees all | User inserts own | User updates own + admin | User deletes own + admin |
| **categories**    | All authenticated users        | Admin only       | Admin only               | Admin only               |
| **rules**         | All authenticated users        | Admin only       | Admin only               | Admin only               |
| **chat_messages** | User sees own                  | User inserts own | User updates own         | User deletes own         |

**Why RLS matters:**

- An employee cannot see another employee's expenses
- An employee cannot directly update expense status (admin-only)
- Chat messages are private per user
- Admin can see/modify everything

**File:** [supabase/migrations/20260710130617_001_initial_schema.sql](supabase/migrations/20260710130617_001_initial_schema.sql)

---

## 4. EXPENSE CREATION & VALIDATION

### Frontend Validation

**File:** [src/pages/expenses/NewExpensePage.tsx](src/pages/expenses/NewExpensePage.tsx)

**Step 1: Form Validation (Client-side)**

```typescript
function validateForm(data: FormData): boolean {
  - Category must be selected
  - Amount must be > 0 and < 999,999
  - Description must be ≥ 3 characters
  - Date must be provided
  - Returns errors object if validation fails
}
```

**Step 2: Real-time Policy Check (Server-side Edge Function)**

When user enters amount, category, or date:

- Debounced API call to `/functions/v1/validate-expense`
- Sends: `{ user_id, category_id, amount, expense_date, grade }`
- Backend returns: **validation status + daily limits + spending info**

```typescript
useEffect(() => {
  // Debounce 600ms to avoid spam
  validateTimeout = setTimeout(() => {
    runValidation(amount, categoryId, date);
  }, 600);
}, [watchAmount, watchCategory, watchDate]);
```

### Backend Validation (Edge Function)

**File:** [supabase/functions/validate-expense/index.ts](supabase/functions/validate-expense/index.ts)

**Process:**

1. Extract: user_id, category_id, amount, expense_date, grade from request
2. Fetch rule: `SELECT * FROM expense_rules WHERE grade = ? AND category_id = ?`
3. If no rule exists: ✅ Approve automatically (no cap)
4. Check violations:
   - **Per-expense limit**: `amount > rule.per_expense_limit` → Status: **FLAGGED**
   - **Daily limit**: Query all expenses for this user/category/date with status ≠ 'rejected'
   - If `dailySpent + amount > rule.daily_limit` → Status: **FLAGGED** or **REJECTED**
5. Return status + violations + rule details (daily_limit, daily_spent, daily_remaining)

**Statuses:**

- `pending`: Passes all checks, awaits admin review
- `flagged`: Exceeds limits but not critical, needs manager approval
- `rejected`: Critical violation, cannot be submitted

### Receipt Upload

```typescript
// User selects file (image or PDF, max 5 MB)
const file = e.target.files[0];

// Upload to Supabase Storage
const path = `receipts/${user.id}/${Date.now()}.ext`;
await supabase.storage.from("expense-receipts").upload(path, file);

// Get public URL and store in expense.receipt_url
const { publicUrl } = supabase.storage
  .from("expense-receipts")
  .getPublicUrl(path);
```

### Submission

```typescript
// Insert expense record
await supabase.from("expenses").insert({
  user_id,
  category_id,
  amount: parseFloat(data.amount),
  description,
  expense_date,
  merchant_name,
  location,
  status: validation?.status ?? "pending",
  receipt_url,
  receipt_filename,
  is_from_chat: false,
  currency: "INR",
});

// Navigate to My Expenses
navigate("/expenses");
```

---

## 5. EMPLOYEE EXPENSE RETRIEVAL (My Expenses Page)

**File:** [src/pages/expenses/MyExpensesPage.tsx](src/pages/expenses/MyExpensesPage.tsx)

### Features

- **View all personal expenses** sorted by newest first
- **Filter by status:** pending, approved, rejected, flagged
- **Search** by description or merchant name
- **Pagination:** Load more via infinite scroll
- **Status badges** with color coding
- **Receipt preview:** Click to view uploaded receipt
- **Re-download receipts:** Via Supabase Storage public URL
- **Expense cards** showing:
  - Amount, date, category, description
  - Merchant & location (if provided)
  - Status & rejection reason (if rejected)
  - Receipt thumbnail (if image)

### Query

```typescript
const { data } = await supabase
  .from("expenses")
  .select("*, expense_categories(*)") // Join with categories
  .eq("user_id", user.id) // Only own expenses (RLS enforced)
  .order("created_at", { ascending: false }) // Newest first
  .limit(20)
  .offset(page * 20);
```

### Status Colors

| Status   | Color             | Meaning                      |
| -------- | ----------------- | ---------------------------- |
| pending  | secondary (gray)  | Awaiting admin review        |
| approved | default (green)   | Approved & reimbursable      |
| rejected | destructive (red) | Rejected with reason         |
| flagged  | outline (orange)  | Flagged, needs clarification |

---

## 6. CHAT INTERFACE (Support & Auto-Filing)

**File:** [src/pages/chat/ChatPage.tsx](src/pages/chat/ChatPage.tsx)

### Purpose

- Employees can **naturally describe expenses** in chat
- Bot parses expense details using **basic NLP**
- Auto-creates expense if all fields extracted
- Provides **support/customer service** interface

### NLP Parsing Algorithm

```typescript
function parseExpenseFromText(text, categories) {
  // 1. Extract amount: "₹450", "Rs. 500", "1200 rupees"
  const amountMatch = /(?:rs\.?|₹|inr)?\s*(\d+(?:[,\d]*)?(?:\.\d{1,2})?)/i

  // 2. Extract category: Match keywords against message
  keywords = {
    'Food & Dining': ['food', 'lunch', 'restaurant', 'swiggy', 'zomato', ...],
    'Travel': ['cab', 'uber', 'ola', 'flight', 'train', ...],
    'Accommodation': ['hotel', 'stay', 'oyo', ...],
    ...
  }

  // 3. Extract description: First 100 chars of message

  // 4. Set date: Today

  return { amount, category, description, date }
}
```

### Example Conversations

```
User: "Paid ₹450 for lunch at Swiggy"
→ Bot detects: ₹450 + Food & Dining + "Paid ₹450 for lunch at Swiggy"
→ Auto-creates expense ✓

User: "₹1200 hotel booking in Mumbai"
→ Bot detects: ₹1200 + Accommodation + "₹1200 hotel booking in Mumbai"
→ Auto-creates expense ✓

User: "Got some groceries"
→ Bot can't detect amount → Asks for amount
→ Expense not created until amount provided

User: "₹300"
→ Bot can't detect category → Asks what it was for
→ Expense not created until category provided
```

### Features

- **Real-time message sync** via Supabase subscriptions
- **User vs Assistant** message differentiation
- **Typing indicator** while bot processes
- **Expense preview** when parsed: "✓ Expense recorded! ₹450 for Food & Dining on 11 Jul 2026"
- **Auto-redirect** to expense after creation
- **File upload placeholder** (for future receipt attachment)

### Message Types

| message_type       | Description               |
| ------------------ | ------------------------- |
| `text`           | Regular chat message      |
| `expense_parsed` | Bot auto-created expense  |
| `receipt_upload` | Receipt attached (future) |
| `system`         | System notifications      |

---

## 7. ADMIN FEATURES

### 7.1 Employee Management

**File:** [src/pages/admin/AdminEmployeesPage.tsx](src/pages/admin/AdminEmployeesPage.tsx)

**Features:**

- **List all employees** with stats:
  - Total expenses filed
  - Total amount spent
  - Department & grade
  - Employee code
- **Search** by name or employee code
- **Sort** by name, grade, or total amount
- **Pagination** of employee list
- **Click employee** to view all their expenses

**Query:**

```typescript
// Fetch all profiles
const profiles = await supabase.from("profiles").select("*").order("full_name");

// For each profile, calculate stats
const stats = await Promise.all(
  profiles.map(async (p) => {
    const expenses = await supabase
      .from("expenses")
      .select("amount")
      .eq("user_id", p.id)
      .neq("status", "rejected");

    return {
      ...p,
      expense_count: expenses.length,
      total_amount: sum(expenses.map((e) => e.amount)),
    };
  }),
);
```

### 7.2 Expense Approval/Rejection

**File:** [src/pages/admin/AdminExpensesPage.tsx](src/pages/admin/AdminExpensesPage.tsx)

**Features:**

- **View all expenses** across all employees
- **Filter by:**
  - Status (pending, approved, rejected, flagged)
  - Category
  - Employee name
- **Search** by description or merchant
- **Inline actions:**
  - **Approve:** Change status to `approved` (employee can now request reimbursement)
  - **Reject:** Change status to `rejected` + add rejection reason
  - **Flag review:** Mark for clarification
- **Expense detail modal** showing:
  - Full expense info (amount, date, category)
  - Employee details
  - Receipt preview (if image)
  - Current status
  - Audit trail (created_at, updated_at)

**Approval Flow:**

```typescript
async function approveExpense(expenseId) {
  const { error } = await supabase
    .from("expenses")
    .update({ status: "approved", updated_at: now() })
    .eq("id", expenseId);

  // RLS enforces: only admin can update
}

async function rejectExpense(expenseId, reason) {
  const { error } = await supabase
    .from("expenses")
    .update({
      status: "rejected",
      rejection_reason: reason,
      updated_at: now(),
    })
    .eq("id", expenseId);
}
```

### 7.3 Analytics Dashboard

**File:** [src/pages/admin/AdminAnalyticsPage.tsx](src/pages/admin/AdminAnalyticsPage.tsx)

**Visualizations:**

1. **Key Metrics Cards:**

   - Total expenses filed
   - Total amount spent (₹)
   - Average expense amount
   - Pending approval count
2. **Spend by Category (Bar Chart):**

   - X-axis: Category names
   - Y-axis: Total amount (₹)
   - Aggregates all expenses grouped by category
3. **Spend Trend (Line Chart):**

   - X-axis: Months (last 12)
   - Y-axis: Total amount per month (₹)
   - Shows spending patterns over time
4. **Expense Status Distribution:**

   - pending, approved, rejected, flagged counts
5. **Top Employees by Spend:**

   - Table: Employee name, total amount, expense count

**Query Example:**

```typescript
// Spend by category
const expenses = await supabase
  .from("expenses")
  .select("amount, expense_categories(name)")
  .neq("status", "rejected");

const byCategory = expenses.reduce((acc, e) => {
  const cat = e.expense_categories.name;
  acc[cat] = (acc[cat] || 0) + e.amount;
  return acc;
}, {});

// Convert to chart data: [{ category: "Food", amount: 5000 }, ...]
```

---

## 8. DASHBOARD (Employee View)

**File:** [src/pages/dashboard/DashboardPage.tsx](src/pages/dashboard/DashboardPage.tsx)

### Quick Stats Cards

- **Total expenses** filed
- **Pending approval** count
- **Approved** count
- **Rejected** count
- **Flagged** count
- **This month** total spending

### Recent Expenses Table

- Last 50 expenses sorted by date
- Columns: Date, Category, Amount, Description, Status
- Status badges with colors
- Click to view details

### Quick Actions

- "New Expense" button → Navigate to form
- "View All" link → My Expenses page
- "Chat Support" button → Chat page

---

## 9. UI/UX FEATURES

### Design System

- **Responsive:** Mobile, tablet, desktop
- **Dark/Light theme:** Toggle via button
- **Consistent components:** Shadcn/ui (Radix UI)
- **Icons:** Lucide React (40+ used)
- **Typography:** Tailwind CSS (scale: xs → 2xl)
- **Spacing:** Tailwind scale (0.5rem → 3rem)

### Key UI Components Used

| Component    | Purpose                           |
| ------------ | --------------------------------- |
| Card         | Data containers (expenses, stats) |
| Dialog       | Modals (approve/reject, details)  |
| Tabs         | Dashboard sections                |
| Badge        | Status labels                     |
| Button       | Actions                           |
| Input        | Text fields                       |
| NativeSelect | Category/filter dropdowns         |
| Textarea     | Description/rejection reason      |
| Alert        | Error/warning messages            |
| Table        | Expense/employee lists            |
| Skeleton     | Loading placeholders              |
| Avatar       | User profile pictures             |
| Empty State  | No data messaging                 |

### Responsive Sidebar

- **Desktop:** Fixed left sidebar (56 chars wide)
- **Mobile:** Drawer (toggles with menu icon)
- **Sticky header** with grade badge, role badge, notifications bell
- **Light theme** by default, toggle to dark

---

## 10. DATA FLOW & KEY Patterns

### Create Expense Flow

```
User Form Input
  ↓
Frontend Validation (validateForm)
  ↓
Real-time Server Validation (Edge Function)
  ↓ [Debounce 600ms]
Fetch Rule → Check Per-Expense → Check Daily → Set Status
  ↓
Display Validation Feedback & Daily Limits
  ↓
User Reviews → Submits Form
  ↓
Upload Receipt to Storage
  ↓
Insert Expense + Chat Message (is_from_chat=false)
  ↓
Redirect to My Expenses → Show Success Toast
```

### Chat → Auto-File Flow

```
User Types in Chat
  ↓
Parse Message (NLP: Extract amount, category, date)
  ↓
Check if Complete (amount + category required)
  ↓
If Complete:
  - Validate amount/category
  - Create expense record
  - Set is_from_chat=true
  - Insert chat message with type='expense_parsed'
  ↓
If Incomplete:
  - Insert chat message with type='text'
  - Bot reply: ask for missing info
```

### Approval Flow

```
Admin Views Expense (AdminExpensesPage)
  ↓
Filter/Search/Select Status
  ↓
Click Expense → Open Detail Modal
  ↓
Click "Approve" or "Reject"
  ↓
Update Status in DB (RLS: only admin allowed)
  ↓
Refresh Expense List
  ↓
Employee sees updated status in My Expenses next load
```

---

## 11. COMMON INTERVIEW QUESTIONS & ANSWERS

### Q: How do you handle grade-based spending limits?

**A:** We use a `expense_rules` table with unique(grade, category_id). When an expense is submitted:

1. **Frontend:** As user enters amount/category/date, we call `/functions/v1/validate-expense` (debounced)
2. **Backend:** Edge Function queries the rule for that grade+category
3. **Check violations:**
   - Per-expense: `amount > rule.per_expense_limit` → Flagged
   - Daily: Sum today's expenses + new amount, compare to `rule.daily_limit` → Flagged/Rejected
4. **Return status** (pending/flagged/rejected) + daily limits for UI display
5. **On submit:** Expense is created with the validated status

**Sample Data:**

- Grade 5, Food: daily ₹500, per-expense ₹350
- Grade 10, Food: daily ₹1000, per-expense ₹700
- Calculated: `daily = 200 + (grade × 100)`, category-specific multipliers apply

---

### Q: Why use Row-Level Security (RLS)?

**A:** RLS is a PostgreSQL feature that enforces security at the database level, not just application code:

1. **Data isolation:** Employee A cannot see/edit Employee B's expenses even if they bypass frontend code
2. **Admin privileges:** Admins can see all expenses via policy checks
3. **Audit trail:** Database logs who accessed/modified what
4. **Example policy:**
   ```sql
   CREATE POLICY "expenses_select_own_or_admin" ON expenses FOR SELECT
   USING (auth.uid() = user_id OR EXISTS (
     SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
   ))
   ```

   This means: User can select own expenses OR if they're admin, select any expense.

**Benefit:** If a malicious user tries to query expenses via API, the database automatically filters based on their role.

---

### Q: How does the chat NLP parsing work?

**A:** Simple keyword-matching + regex:

1. **Amount extraction:** Regex `/(?:rs\.?|₹|inr)?\s*(\d+(?:[,\d]*)?(?:\.\d{1,2})?)/i`

   - Matches: "₹450", "Rs. 500", "1200 rupees"
2. **Category extraction:** Keyword dictionary

   ```typescript
   keywords = {
     'Food & Dining': ['food', 'lunch', 'swiggy', 'zomato', ...],
     'Travel': ['cab', 'uber', 'flight', ...],
     ...
   }
   ```

   - For each category, loop through keywords
   - If text contains keyword (case-insensitive), match that category
3. **Description & date:** Take message text (first 100 chars), use today's date
4. **Validation:** Both amount AND category must exist to auto-file

   - If missing → Bot sends helpful message asking for missing info
5. **Create expense:** If complete, insert into DB with `is_from_chat=true`

**Limitations:** This is intentionally simple. For production, you'd use ML (spaCy, GPT-based) for better extraction.

---

### Q: How do you secure receipt uploads?

**A:**

1. **File validation (frontend):**

   - Max size: 5 MB
   - Allowed types: Images (JPG, PNG) + PDF
2. **Upload path:** `receipts/{user_id}/{timestamp}.ext`

   - Scoped to user directory
   - Timestamped to prevent collisions
3. **Storage bucket:**

   - Private by default
   - Only authenticated users can upload
   - URL is public once uploaded (for viewing in app)
4. **Database reference:**

   - Store `receipt_url` (public URL) in expense record
   - Store `receipt_filename` (original name) for reference
   - Link to expense via `id`
5. **RLS:** Only user/admin can see receipt URL via expense query

---

### Q: What's the difference between frontend and backend validation?

**A:**

| Aspect                     | Frontend                        | Backend                            |
| -------------------------- | ------------------------------- | ---------------------------------- |
| **Where**            | Browser (React)                 | Server (Edge Function)             |
| **Purpose**          | UX feedback                     | Security enforcing                 |
| **What checks**      | Required fields, format, length | Business logic (rules, limits)     |
| **Can be bypassed?** | Yes (dev tools, API calls)      | No (database + RLS)                |
| **Example**          | Amount must be > 0              | Amount must not exceed daily limit |

**Best practice:** Never trust frontend validation alone. Always validate on backend.

---

### Q: How does real-time chat work?

**A:** Using Supabase Realtime subscriptions:

```typescript
const channel = supabase
  .channel(`user_${user.id}`)
  .on(
    "postgres_changes",
    { event: "*", schema: "public", table: "chat_messages" },
    (payload) => {
      // New message arrived
      setMessages((prev) => [...prev, payload.new]);
      scrollToBottom();
    },
  )
  .subscribe();
```

**Flow:**

1. User types message → Insert into `chat_messages`
2. Supabase broadcasts change to all subscribed clients
3. React updates UI immediately (no polling)
4. If bot parses expense → Also inserts expense + system message
5. All clients see updates in real-time

---

### Q: How do you handle pagination in My Expenses?

**A:**

```typescript
const [page, setPage] = useState(0);

async function loadMore() {
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)
    .offset(page * 20); // Skip first 20, then next 20, etc.

  setExpenses((prev) => [...prev, ...data]); // Append, don't replace
  setPage((prev) => prev + 1);
}
```

**Infinite scroll:** Show "Load More" button at bottom, fetch next 20 on click.

---

### Q: How do you prevent unauthorized expense modifications?

**A:**

1. **RLS Policy:** Only user or admin can UPDATE their own expenses

   ```sql
   CREATE POLICY "expenses_update_own_or_admin" ON expenses FOR UPDATE
   USING (auth.uid() = user_id OR IS_ADMIN)
   WITH CHECK (auth.uid() = user_id OR IS_ADMIN)
   ```
2. **Frontend:** Only admin sees approve/reject buttons in UI
3. **Backend:** Validate auth.uid() before any update query
4. **Status validation:** Only allow specific transitions:

   - pending → approved/rejected/flagged
   - flagged → approved/rejected
   - Cannot change status if already rejected

**Result:** Even if malicious code calls API, database rejects unauthorized updates.

---

### Q: How would you add budget forecasting?

**A:**

1. **New table:** `budget_forecast` (grade, category, month, projected_amount)
2. **Calculate:** At month-end, sum all non-rejected expenses by category
3. **Compare:** Actual vs. budgeted
4. **Alert:** If trending over budget, send notification
5. **Report:** Admin dashboard shows forecast vs. actual charts

**Implementation:** Stored procedure or Cron job to run monthly aggregations.

---

### Q: How do you handle concurrent expense submissions?

**A:**

1. **Database constraints:**

   - Amount > 0
   - category_id must exist (FK constraint)
   - user_id must exist (FK constraint)
2. **Atomic transactions:** Each INSERT is a single transaction

   - Either succeeds fully or rolls back
   - No partial updates
3. **Indexes:** On user_id, expense_date, status for fast queries

   - Prevents table scans during high load
4. **Connection pooling:** Supabase handles connection management

   - Reuses connections, reduces overhead
5. **Rate limiting:** (Not implemented yet, but would add)

   - Limit expenses per user per minute
   - Prevent spam submissions

---

### Q: What's a limitation of the current NLP parsing?

**A:**

1. **No context understanding:** Can't distinguish between "₹50 for coffee" vs "₹50 _saved_ for coffee"
2. **No ML training:** Just keyword matching, not intent analysis
3. **Ambiguous categories:** "office supplies" could match multiple keywords
4. **No correction loop:** If bot misses category, user must retype
5. **Hardcoded keywords:** Doesn't learn new merchant names

**Solution for production:** Use GPT API or fine-tuned LLM for semantic understanding.

---

## 12. KEY DECISION RATIONALES

| Decision           | Why                                                                             |
| ------------------ | ------------------------------------------------------------------------------- |
| Use Supabase       | Built-in auth, DB, storage, real-time, edge functions. No extra backend needed. |
| PostgreSQL         | Mature, reliable, native RLS, JSON support. Industry standard.                  |
| React + TypeScript | Type safety, component reusability, large ecosystem.                            |
| RLS for security   | Database-level enforcement, no way to bypass from client.                       |
| Edge Functions     | Server-side validation without separate server infrastructure.                  |
| Shadcn/ui          | Accessible (Radix UI), highly customizable, Tailwind-first.                     |
| Grade 1-10 model   | Simple 10-tier system matches corporate structure (Levels 1-10 hierarchy).      |

---

## 13. HOW TO EXPLAIN THIS IN AN INTERVIEW

### Narrative Flow

1. **Start with problem:** "Built a full-stack expense app to handle grade-based spending limits and multi-user expense management."
2. **Discuss architecture:**

   - React frontend with TypeScript
   - Supabase backend (PostgreSQL + Edge Functions)
   - Row-Level Security for data isolation
3. **Dive into key features:**

   - Grade-based validation rules
   - Real-time chat with NLP parsing
   - Admin approval workflow
   - Analytics dashboard
4. **Explain security:**

   - RLS policies prevent unauthorized access
   - Backend validation enforces business logic
   - Frontend validation improves UX
5. **Discuss trade-offs:**

   - Simple NLP vs. ML-based parsing
   - Denormalization vs. normalization (spent today calculated on-the-fly vs. cached)
6. **What you learned:**

   - Row-Level Security design
   - Real-time subscriptions
   - Grade-based access patterns
   - Serverless architecture benefits

### Code to Highlight During Interview

1. **Validation logic:** [supabase/functions/validate-expense/index.ts](supabase/functions/validate-expense/index.ts) — Show business logic
2. **RLS policies:** [supabase/migrations/20260710130617_001_initial_schema.sql](supabase/migrations/20260710130617_001_initial_schema.sql) — Show security
3. **Chat NLP:** [src/pages/chat/ChatPage.tsx](src/pages/chat/ChatPage.tsx#L10) — Show simplicity + effectiveness
4. **Admin approval:** [src/pages/admin/AdminExpensesPage.tsx](src/pages/admin/AdminExpensesPage.tsx#L60) — Show workflow
5. **Real-time:** [src/pages/chat/ChatPage.tsx](src/pages/chat/ChatPage.tsx#L90) — Show Supabase subscriptions

---

## 14. QUICK REFERENCE: Major Components

| File                                                                                                                  | Purpose           | Key Logic                                         |
| --------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| [src/context/AuthContext.tsx](src/context/AuthContext.tsx)                                                             | Global auth state | Sign in/up, profile fetch, session management     |
| [src/components/ProtectedRoute.tsx](src/components/ProtectedRoute.tsx)                                                 | Route guards      | Check auth + role-based access                    |
| [src/pages/expenses/NewExpensePage.tsx](src/pages/expenses/NewExpensePage.tsx)                                         | Expense form      | Frontend validation + real-time server validation |
| [supabase/functions/validate-expense/index.ts](supabase/functions/validate-expense/index.ts)                           | Business logic    | Rule checks, daily limits, status assignment      |
| [src/pages/expenses/MyExpensesPage.tsx](src/pages/expenses/MyExpensesPage.tsx)                                         | Expense list      | Query own expenses, filters, search               |
| [src/pages/chat/ChatPage.tsx](src/pages/chat/ChatPage.tsx)                                                             | Chat interface    | NLP parsing, auto-file, real-time sync            |
| [src/pages/admin/AdminEmployeesPage.tsx](src/pages/admin/AdminEmployeesPage.tsx)                                       | Employee list     | Admin view, stats aggregation                     |
| [src/pages/admin/AdminExpensesPage.tsx](src/pages/admin/AdminExpensesPage.tsx)                                         | Expense approval  | Admin review, approve/reject workflow             |
| [src/pages/admin/AdminAnalyticsPage.tsx](src/pages/admin/AdminAnalyticsPage.tsx)                                       | Analytics         | Charts, trends, aggregations                      |
| [supabase/migrations/20260710130617_001_initial_schema.sql](supabase/migrations/20260710130617_001_initial_schema.sql) | Database schema   | Tables, RLS, seed data, rules                     |

---

## 15. FUTURE ENHANCEMENTS (If Asked)

1. **Notifications:** Expense approved → Email/SMS to employee
2. **Budget forecasting:** Predict month-end spend based on trends
3. **Duplicate detection:** Alert if similar expense filed twice
4. **Export:** Download expense reports as PDF/CSV
5. **Approval workflow:** Multi-level (manager → department head → finance)
6. **Bulk operations:** Approve/reject multiple expenses at once
7. **Audit logs:** Track all status changes with timestamps
8. **Mobile app:** React Native or Flutter version
9. **ML categorization:** Auto-assign category from receipt image
10. **Integration:** Sync with accounting software (Xero, QuickBooks)

---

**Good luck with your interview! Remember to explain not just what the app does, but _why_ each decision was made. Interviewers value architectural thinking more than feature count.**

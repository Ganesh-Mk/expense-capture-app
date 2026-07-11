# ExpenseFlow

ExpenseFlow is a React + Supabase expense capture app with employee expense submission, admin review, grade-based policy limits, and seeded showcase data.

## Stack

- React 19
- Vite
- TypeScript
- Supabase Auth, Database, Storage, and Edge Functions
- shadcn/ui
- Tailwind CSS

## Setup

Install dependencies:

```bash
npm install
```

Create `.env` with:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Run the app:

```bash
npm run dev
```

Build:

```bash
npm run build
```

## Demo Data

Seed categories, grade rules, users, expenses, and chat messages:

```bash
node scripts/seed-demo-data.mjs
```

The seed creates:

- 1 admin user
- 8 employee users
- 9 expense categories
- grade-based category limits
- 72 expenses across `approved`, `pending`, `flagged`, and `rejected`
- sample merchants, locations, receipt links, rejection reasons, and chat messages

All seeded accounts use:

```text
password123
```

Admin login:

```text
admin@expenseflow.test
password123
```

Sample employee logins:

```text
rohan.kapoor@expenseflow.test
kabir.sharma@expenseflow.test
priya.nair@expenseflow.test
password123
```

## Routes

Employee:

- `/dashboard`
- `/expenses/new`
- `/expenses`
- `/chat`

Admin:

- `/admin/employees`
- `/admin/expenses`
- `/admin/analytics`
- `/admin/rules`

## Expense Status

Expense status is stored in the `expenses.status` column.

- `pending`: within policy and waiting for review
- `approved`: approved by admin
- `rejected`: rejected by admin or blocked by policy
- `flagged`: submitted but needs review because it is outside normal policy limits

The flagged pill on the admin expenses table appears when:

```ts
expense.status === "flagged"
```

New expenses are flagged automatically by the `validate-expense` Supabase Edge Function when an expense exceeds per-expense or daily limits but is not severe enough to reject.

## Admin Review

Admins can review all employee expenses at `/admin/expenses`.

Pending and flagged expenses show action buttons:

- approve: changes status to `approved`
- reject: opens a reason dialog and changes status to `rejected`

## Rules & Limits

Admins can manage grade/category limits at `/admin/rules`.

Each rule controls:

- daily limit
- per-expense limit

These rules are used by the expense validation flow to decide whether a submitted expense should be pending, flagged, or rejected.

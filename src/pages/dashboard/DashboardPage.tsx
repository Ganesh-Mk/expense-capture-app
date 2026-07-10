import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import {
  PlusCircle, TrendingUp, Receipt, Clock, CheckCircle,
  AlertTriangle, ArrowRight
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseCategory } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from '@/components/ui/chart'
import {
  BarChart, Bar, XAxis, CartesianGrid
} from 'recharts'

type ExpenseWithCategory = Expense & { expense_categories: ExpenseCategory }

interface Stats {
  total: number
  pending: number
  approved: number
  rejected: number
  flagged: number
  thisMonth: number
}

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#f97316', '#06b6d4', '#8b5cf6']

export default function DashboardPage() {
  const { profile } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, rejected: 0, flagged: 0, thisMonth: 0 })

  useEffect(() => {
    if (!profile) return

    supabase
      .from('expenses')
      .select('*, expense_categories(*)')
      .order('expense_date', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const list = (data as ExpenseWithCategory[]) ?? []
        setExpenses(list)

        const now = new Date()
        const monthStart = startOfMonth(now)
        const monthEnd = endOfMonth(now)

        setStats({
          total: list.length,
          pending: list.filter(e => e.status === 'pending').length,
          approved: list.filter(e => e.status === 'approved').length,
          rejected: list.filter(e => e.status === 'rejected').length,
          flagged: list.filter(e => e.status === 'flagged').length,
          thisMonth: list
            .filter(e => {
              const d = new Date(e.expense_date)
              return d >= monthStart && d <= monthEnd
            })
            .reduce((sum, e) => sum + Number(e.amount), 0),
        })
        setLoading(false)
      })
  }, [profile])

  // Monthly spend data for bar chart (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i)
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const amount = expenses
      .filter(e => {
        const d = new Date(e.expense_date)
        return d >= start && d <= end && e.status !== 'rejected'
      })
      .reduce((sum, e) => sum + Number(e.amount), 0)
    return { month: format(date, 'MMM'), amount }
  })

  // Category breakdown for pie chart
  const categoryData = Object.values(
    expenses.reduce<Record<string, { name: string; value: number }>>((acc, e) => {
      const key = e.category_id
      if (!acc[key]) acc[key] = { name: e.expense_categories?.name ?? 'Other', value: 0 }
      acc[key].value += Number(e.amount)
      return acc
    }, {})
  ).sort((a, b) => b.value - a.value).slice(0, 6)

  const statCards = [
    { label: 'Total Expenses', value: stats.total, icon: Receipt, color: 'text-blue-600' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-amber-600' },
    { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Flagged', value: stats.flagged, icon: AlertTriangle, color: 'text-orange-600' },
  ]

  const recentExpenses = expenses.slice(0, 5)

  return (
    <div className="p-4 md:p-6">
      {/* Welcome */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">
            Welcome back, {profile?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-xs text-muted-foreground">
            {profile?.department} · Grade {profile?.grade} · {profile?.employee_code}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link to="/expenses/new">
            <PlusCircle className="size-3.5" />
            New Expense
          </Link>
        </Button>
      </div>

      {/* This month summary */}
      <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Spend this month</p>
            {loading ? (
              <Skeleton className="mt-1 h-6 w-24" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                ₹{stats.thisMonth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
          <TrendingUp className="size-5 text-muted-foreground" />
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="gap-0 py-0">
            <CardContent className="flex items-center gap-3 px-4 py-3">
              <Icon className={cn('size-4 shrink-0', color)} />
              <div>
                <p className="text-[10px] text-muted-foreground">{label}</p>
                {loading
                  ? <Skeleton className="mt-0.5 h-5 w-8" />
                  : <p className="text-lg font-semibold">{value}</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly spend chart */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Monthly Spend</CardTitle>
            <CardDescription className="text-xs">Last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <ChartContainer config={{ amount: { label: 'Amount', color: 'var(--chart-1)' } }} className="h-40">
              <BarChart data={monthlyData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount']} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">By Category</CardTitle>
            <CardDescription className="text-xs">All time spend distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-4 px-5 py-4">
            <div className="flex-1">
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              ) : categoryData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center pt-4">No data yet</p>
              ) : (
                <div className="space-y-2">
                  {categoryData.map((c, i) => {
                    const total = categoryData.reduce((s, x) => s + x.value, 0)
                    const pct = total > 0 ? Math.round((c.value / total) * 100) : 0
                    return (
                      <div key={c.name} className="flex flex-col gap-0.5">
                        <div className="flex justify-between">
                          <span className="text-xs truncate">{c.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" style={{ '--tw-ring-color': COLORS[i % COLORS.length] } as React.CSSProperties} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent expenses */}
        <Card className="gap-0 py-0 md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between border-b px-5 py-4">
            <div>
              <CardTitle className="text-sm">Recent Expenses</CardTitle>
              <CardDescription className="text-xs">Your latest submissions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/expenses">
                View all <ArrowRight className="size-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="divide-y">
                {[1,2,3].map(i => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="size-8 rounded-md" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-3 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentExpenses.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Receipt className="size-8 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">No expenses yet</p>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/expenses/new">Submit your first expense</Link>
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {recentExpenses.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted">
                      <Receipt className="size-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{e.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {e.expense_categories?.name} · {format(new Date(e.expense_date), 'dd MMM')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tabular-nums">
                        ₹{Number(e.amount).toLocaleString('en-IN')}
                      </span>
                      <Badge
                        variant={
                          e.status === 'approved' ? 'default' :
                          e.status === 'rejected' ? 'destructive' :
                          e.status === 'flagged' ? 'outline' : 'secondary'
                        }
                        className="text-[10px] capitalize"
                      >
                        {e.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

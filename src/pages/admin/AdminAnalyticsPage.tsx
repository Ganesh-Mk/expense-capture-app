import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths, eachMonthOfInterval } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseCategory, Profile } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from '@/components/ui/chart'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { TrendingUp, Users, Receipt, IndianRupee } from 'lucide-react'

type FullExpense = Expense & { expense_categories: ExpenseCategory; profiles: Profile }

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#ec4899', '#f97316', '#06b6d4', '#8b5cf6']

export default function AdminAnalyticsPage() {
  const [expenses, setExpenses] = useState<FullExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState('6')

  useEffect(() => {
    supabase
      .from('expenses')
      .select('*, expense_categories(*), profiles(*)')
      .neq('status', 'rejected')
      .order('expense_date', { ascending: true })
      .then(({ data }) => {
        setExpenses((data as FullExpense[]) ?? [])
        setLoading(false)
      })
  }, [])

  const months = parseInt(range)
  const now = new Date()
  const rangeStart = startOfMonth(subMonths(now, months - 1))
  const rangeEnd = endOfMonth(now)

  const inRange = expenses.filter(e => {
    const d = new Date(e.expense_date)
    return d >= rangeStart && d <= rangeEnd
  })

  const totalAmount = inRange.reduce((s, e) => s + Number(e.amount), 0)
  const uniqueEmployees = new Set(inRange.map(e => e.user_id)).size
  const avgPerEmployee = uniqueEmployees > 0 ? totalAmount / uniqueEmployees : 0

  // Monthly trend
  const monthlyTrend = eachMonthOfInterval({ start: rangeStart, end: rangeEnd }).map(date => {
    const start = startOfMonth(date)
    const end = endOfMonth(date)
    const monthExpenses = inRange.filter(e => {
      const d = new Date(e.expense_date)
      return d >= start && d <= end
    })
    return {
      month: format(date, 'MMM yy'),
      amount: monthExpenses.reduce((s, e) => s + Number(e.amount), 0),
      count: monthExpenses.length,
    }
  })

  // By category
  const byCategory = Object.values(
    inRange.reduce<Record<string, { name: string; amount: number; count: number }>>((acc, e) => {
      const key = e.category_id
      if (!acc[key]) acc[key] = { name: e.expense_categories?.name ?? 'Other', amount: 0, count: 0 }
      acc[key].amount += Number(e.amount)
      acc[key].count++
      return acc
    }, {})
  ).sort((a, b) => b.amount - a.amount)

  // By grade
  const byGrade = Object.values(
    inRange.reduce<Record<number, { grade: number; amount: number; count: number }>>((acc, e) => {
      const g = e.profiles?.grade ?? 0
      if (!acc[g]) acc[g] = { grade: g, amount: 0, count: 0 }
      acc[g].amount += Number(e.amount)
      acc[g].count++
      return acc
    }, {})
  ).sort((a, b) => a.grade - b.grade)

  // By department
  const byDepartment = Object.values(
    inRange.reduce<Record<string, { dept: string; amount: number; count: number }>>((acc, e) => {
      const d = e.profiles?.department ?? 'Other'
      if (!acc[d]) acc[d] = { dept: d, amount: 0, count: 0 }
      acc[d].amount += Number(e.amount)
      acc[d].count++
      return acc
    }, {})
  ).sort((a, b) => b.amount - a.amount).slice(0, 8)

  // Status distribution
  const allInRange = expenses.filter(e => {
    const d = new Date(e.expense_date)
    return d >= rangeStart && d <= rangeEnd
  })
  const statusDist = [
    { name: 'Approved', value: allInRange.filter(e => e.status === 'approved').length },
    { name: 'Pending', value: allInRange.filter(e => e.status === 'pending').length },
    { name: 'Flagged', value: allInRange.filter(e => e.status === 'flagged').length },
    { name: 'Rejected', value: allInRange.filter(e => e.status === 'rejected').length },
  ].filter(s => s.value > 0)

  const statCards = [
    { label: 'Total Spend', value: `₹${(totalAmount / 100000).toFixed(1)}L`, icon: IndianRupee, note: 'All approved + pending' },
    { label: 'Total Expenses', value: inRange.length.toString(), icon: Receipt, note: 'In selected period' },
    { label: 'Active Employees', value: uniqueEmployees.toString(), icon: Users, note: 'With ≥1 expense' },
    { label: 'Avg per Employee', value: `₹${Math.round(avgPerEmployee).toLocaleString('en-IN')}`, icon: TrendingUp, note: 'In selected period' },
  ]

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">Analytics</h1>
          <p className="text-xs text-muted-foreground">Expense analysis and insights</p>
        </div>
        <NativeSelect
          value={range}
          onChange={e => setRange(e.target.value)}
          className="w-36 text-xs"
          size="sm"
        >
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
        </NativeSelect>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, note }) => (
          <Card key={label} className="gap-0 py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-start justify-between">
                <p className="text-[10px] text-muted-foreground">{label}</p>
                <Icon className="size-3.5 text-muted-foreground" />
              </div>
              {loading ? (
                <Skeleton className="mt-1 h-6 w-20" />
              ) : (
                <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
              )}
              <p className="text-[10px] text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Trend */}
        <Card className="gap-0 py-0 md:col-span-2">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Monthly Spend Trend</CardTitle>
            <CardDescription className="text-xs">Total expense amount by month</CardDescription>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <ChartContainer
              config={{ amount: { label: 'Amount (₹)', color: 'var(--chart-1)' }, count: { label: 'Count', color: 'var(--chart-2)' } }}
              className="h-52"
            >
              <BarChart data={monthlyTrend}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis tickLine={false} axisLine={false} className="text-xs" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => name === 'amount' ? [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount'] : [v, 'Expenses']} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={3} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* By Category */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Spend by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <div className="space-y-2.5">
              {loading ? (
                [1,2,3,4].map(i => <Skeleton key={i} className="h-5 w-full" />)
              ) : byCategory.slice(0, 7).map((c, i) => {
                const pct = totalAmount > 0 ? (c.amount / totalAmount) * 100 : 0
                return (
                  <div key={c.name} className="flex items-center gap-2">
                    <div className="size-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate text-xs">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{pct.toFixed(1)}%</span>
                    <span className="text-xs font-medium tabular-nums">₹{(c.amount/1000).toFixed(0)}k</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* By Department */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Spend by Department</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <div className="space-y-2.5">
              {loading ? (
                [1,2,3,4].map(i => <Skeleton key={i} className="h-5 w-full" />)
              ) : byDepartment.map((d, i) => {
                const max = byDepartment[0]?.amount ?? 1
                const pct = (d.amount / max) * 100
                return (
                  <div key={d.dept} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs">{d.dept}</span>
                    <div className="flex-1 rounded-full bg-muted h-1.5">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                    <span className="text-xs font-medium tabular-nums whitespace-nowrap">₹{(d.amount/1000).toFixed(0)}k</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* By Grade */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Spend by Grade</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <ChartContainer config={{ amount: { label: 'Amount', color: 'var(--chart-3)' } }} className="h-40">
              <BarChart data={byGrade} layout="vertical">
                <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickLine={false} axisLine={false} className="text-xs" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="grade" type="category" tickLine={false} axisLine={false} className="text-xs" tickFormatter={v => `G${v}`} width={28} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Amount']} />} />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={2} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="text-sm">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4 px-5 py-4">
            <div className="flex-1">
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {statusDist.map((s, i) => {
                    const total = statusDist.reduce((sum, x) => sum + x.value, 0)
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
                    return (
                      <div key={s.name} className="flex items-center gap-2">
                        <div className="size-2 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 text-xs">{s.name}</span>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                        <span className="text-xs font-medium tabular-nums">{s.value}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

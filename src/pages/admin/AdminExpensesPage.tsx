import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import {
  Search, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, RefreshCw, ReceiptText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseCategory, Profile } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from '@/components/ui/empty'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

type FullExpense = Expense & {
  expense_categories: ExpenseCategory
  profiles: Profile
}

const STATUS_COLORS = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  flagged: 'outline',
} as const

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<FullExpense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [selected, setSelected] = useState<FullExpense | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    supabase.from('expense_categories').select('*').order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (categoryFilter) query = query.eq('category_id', categoryFilter)

    const [{ data: expenseData }, { data: profileData }, { data: categoryData }] = await Promise.all([
      query,
      supabase.from('profiles').select('*'),
      supabase.from('expense_categories').select('*'),
    ])

    const profilesById = new Map((profileData ?? []).map(profile => [profile.id, profile]))
    const categoriesById = new Map((categoryData ?? []).map(category => [category.id, category]))

    setExpenses(
      ((expenseData ?? []) as Expense[])
        .map(expense => {
          const profile = profilesById.get(expense.user_id)
          const category = categoriesById.get(expense.category_id)

          if (!profile || !category) return null
          return {
            ...expense,
            profiles: profile,
            expense_categories: category,
          }
        })
        .filter((expense): expense is FullExpense => Boolean(expense))
    )
    setLoading(false)
  }, [statusFilter, categoryFilter])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function updateStatus(id: string, status: 'approved' | 'rejected', reason?: string) {
    setActionLoading(true)
    await supabase.from('expenses').update({
      status,
      rejection_reason: reason || null,
    }).eq('id', id)
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, status, rejection_reason: reason || null } : e))
    setSelected(null)
    setRejectionReason('')
    setActionLoading(false)
  }

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase()
    return !q ||
      e.description.toLowerCase().includes(q) ||
      e.profiles?.full_name?.toLowerCase().includes(q) ||
      e.profiles?.employee_code?.toLowerCase().includes(q) ||
      e.expense_categories?.name.toLowerCase().includes(q)
  })

  const totalPending = filtered.filter(e => e.status === 'pending').length
  const totalFlagged = filtered.filter(e => e.status === 'flagged').length

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">All Expenses</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} records ·
            {totalPending > 0 && <span className="text-amber-600"> {totalPending} pending</span>}
            {totalFlagged > 0 && <span className="text-orange-600"> · {totalFlagged} flagged</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchExpenses}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-3.5 text-muted-foreground" />
          <Input placeholder="Search by employee, description…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
        <NativeSelect size="sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-8 w-32 text-xs">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="flagged">Flagged</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </NativeSelect>
        <NativeSelect size="sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 w-44 text-xs">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Employee</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-right text-xs">Amount</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Receipt</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Empty className="border-0 py-10">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><ReceiptText /></EmptyMedia>
                      <EmptyTitle>No expenses found</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(expense => (
                <TableRow key={expense.id} className={expense.status === 'flagged' ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px]">
                          {expense.profiles?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium leading-none">{expense.profiles?.full_name ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground">G{expense.profiles?.grade} · {expense.profiles?.employee_code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(expense.expense_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-xs">{expense.expense_categories?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-[140px]">
                    <p className="truncate text-xs">{expense.description}</p>
                    {expense.merchant_name && <p className="text-[10px] text-muted-foreground">{expense.merchant_name}</p>}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[expense.status]} className="text-[10px] capitalize">
                      {expense.status === 'flagged' && <AlertTriangle className="mr-1 size-2.5" />}
                      {expense.status}
                    </Badge>
                    {expense.rejection_reason && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground truncate max-w-[120px]">{expense.rejection_reason}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.receipt_url ? (
                      <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon-xs"><ExternalLink className="size-3" /></Button>
                      </a>
                    ) : <span className="text-[10px] text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {(expense.status === 'pending' || expense.status === 'flagged') ? (
                      <div className="flex gap-1">
                        <Button
                          size="icon-xs"
                          variant="outline"
                          className="text-emerald-600 hover:text-emerald-700 border-emerald-200"
                          onClick={() => updateStatus(expense.id, 'approved')}
                          title="Approve"
                        >
                          <CheckCircle2 className="size-3" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          className="text-destructive hover:text-destructive border-destructive/30"
                          onClick={() => setSelected(expense)}
                          title="Reject"
                        >
                          <XCircle className="size-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground capitalize">{expense.status}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setRejectionReason('') }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejecting ₹{selected && Number(selected.amount).toLocaleString('en-IN')} from {selected?.profiles?.full_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Rejection reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Amount exceeds policy limit, receipt missing…"
              rows={3}
              className="resize-none text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setSelected(null); setRejectionReason('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!rejectionReason.trim() || actionLoading}
              onClick={() => selected && updateStatus(selected.id, 'rejected', rejectionReason)}
            >
              <XCircle className="size-3.5" />
              Reject Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

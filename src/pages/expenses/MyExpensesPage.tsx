import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Plus, Search, Trash2,
  ExternalLink, ReceiptText, RefreshCw
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Expense, ExpenseCategory } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

const STATUS_COLORS = {
  pending: 'secondary',
  approved: 'default',
  rejected: 'destructive',
  flagged: 'outline',
} as const

type ExpenseWithCategory = Expense & { expense_categories: ExpenseCategory }

export default function MyExpensesPage() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const fetchExpenses = useCallback(async () => {
    if (!user) return
    setLoading(true)
    let query = supabase
      .from('expenses')
      .select('*, expense_categories(*)')
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (statusFilter) query = query.eq('status', statusFilter)
    if (categoryFilter) query = query.eq('category_id', categoryFilter)

    const { data } = await query
    setExpenses((data as ExpenseWithCategory[]) ?? [])
    setLoading(false)
  }, [user, statusFilter, categoryFilter])

  useEffect(() => {
    supabase.from('expense_categories').select('*').order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const filtered = expenses.filter(e => {
    const q = search.toLowerCase()
    return !q || e.description.toLowerCase().includes(q) ||
      e.merchant_name?.toLowerCase().includes(q) ||
      e.expense_categories?.name.toLowerCase().includes(q)
  })

  const totalAmount = filtered.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">My Expenses</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} records · ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchExpenses}>
            <RefreshCw className="size-3.5" />
          </Button>
          <Button size="sm" asChild>
            <Link to="/expenses/new">
              <Plus className="size-3.5" />
              New Expense
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search expenses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <NativeSelect
          size="sm"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-8 w-32 text-xs"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="flagged">Flagged</option>
          <option value="rejected">Rejected</option>
        </NativeSelect>
        <NativeSelect
          size="sm"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-8 w-40 text-xs"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-xs">Description</TableHead>
              <TableHead className="text-xs">Merchant</TableHead>
              <TableHead className="text-right text-xs">Amount</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Receipt</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
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
                      <EmptyMedia variant="icon">
                        <ReceiptText />
                      </EmptyMedia>
                      <EmptyTitle>No expenses found</EmptyTitle>
                      <EmptyDescription>
                        {search || statusFilter || categoryFilter
                          ? 'Try adjusting your filters'
                          : 'Submit your first expense to get started'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(expense => (
                <TableRow key={expense.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(expense.expense_date), 'dd MMM yyyy')}
                  </TableCell>
                  <TableCell className="text-xs">{expense.expense_categories?.name ?? '—'}</TableCell>
                  <TableCell className="max-w-[160px]">
                    <p className="truncate text-xs">{expense.description}</p>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{expense.merchant_name ?? '—'}</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    ₹{Number(expense.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_COLORS[expense.status]} className="text-[10px] capitalize">
                      {expense.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {expense.receipt_url ? (
                      <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon-xs">
                          <ExternalLink className="size-3" />
                        </Button>
                      </a>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {expense.status === 'pending' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-xs" className="text-destructive hover:text-destructive">
                            <Trash2 className="size-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                            <AlertDialogDescription className="text-xs">
                              This will permanently remove this expense record.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteExpense(expense.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

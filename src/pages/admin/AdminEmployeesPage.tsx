import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, RefreshCw, Users } from 'lucide-react'
import { Empty, EmptyHeader, EmptyTitle, EmptyMedia } from '@/components/ui/empty'
import { format } from 'date-fns'

interface EmployeeWithStats extends Profile {
  expense_count: number
  total_amount: number
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function fetchEmployees() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').order('full_name')

    if (!profiles) { setLoading(false); return }

    const withStats = await Promise.all(
      profiles.map(async (p) => {
        const { data } = await supabase
          .from('expenses')
          .select('amount')
          .eq('user_id', p.id)
          .neq('status', 'rejected')
        const total = (data ?? []).reduce((s, e) => s + Number(e.amount), 0)
        return { ...p, expense_count: data?.length ?? 0, total_amount: total }
      })
    )

    setEmployees(withStats)
    setLoading(false)
  }

  useEffect(() => { fetchEmployees() }, [])

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return !q ||
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employee_code?.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
  })

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">Employees</h1>
          <p className="text-xs text-muted-foreground">{filtered.length} registered users</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEmployees}>
          <RefreshCw className="size-3.5" />
          Refresh
        </Button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employees…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Employee</TableHead>
              <TableHead className="text-xs">Code</TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs">Grade</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-right text-xs">Expenses</TableHead>
              <TableHead className="text-right text-xs">Total Spend</TableHead>
              <TableHead className="text-xs">Joined</TableHead>
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
                      <EmptyMedia variant="icon"><Users /></EmptyMedia>
                      <EmptyTitle>No employees found</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(emp => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px]">
                          {emp.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-xs font-medium leading-none">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground">{emp.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{emp.employee_code ?? '—'}</TableCell>
                  <TableCell className="text-xs">{emp.department}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">G{emp.grade}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={emp.role === 'admin' ? 'default' : 'secondary'}
                      className="text-[10px] capitalize"
                    >
                      {emp.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">{emp.expense_count}</TableCell>
                  <TableCell className="text-right text-xs font-medium tabular-nums">
                    ₹{emp.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(emp.created_at), 'dd MMM yyyy')}
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

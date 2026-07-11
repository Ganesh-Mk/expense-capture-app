import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCw, Save, Sliders } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ExpenseCategory, ExpenseRule } from '@/lib/supabase'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'

type RuleDraft = {
  daily_limit: string
  per_expense_limit: string
}

type RuleRow = ExpenseRule & {
  category: ExpenseCategory
}

const GRADES = Array.from({ length: 10 }, (_, index) => index + 1)

function formatMoney(value: number) {
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function AdminRulesPage() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [rules, setRules] = useState<ExpenseRule[]>([])
  const [selectedGrade, setSelectedGrade] = useState(5)
  const [drafts, setDrafts] = useState<Record<string, RuleDraft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function fetchRules() {
    setLoading(true)
    setError('')

    const [categoriesResult, rulesResult] = await Promise.all([
      supabase
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('expense_rules')
        .select('*')
        .order('grade', { ascending: true }),
    ])

    if (categoriesResult.error || rulesResult.error) {
      setError(
        categoriesResult.error?.message ??
          rulesResult.error?.message ??
          'Unable to load rules',
      )
      setLoading(false)
      return
    }

    setCategories(categoriesResult.data ?? [])
    setRules(rulesResult.data ?? [])
    setDrafts({})
    setLoading(false)
  }

  useEffect(() => {
    fetchRules()
  }, [])

  const rows = useMemo<RuleRow[]>(() => {
    return categories
      .map((category) => {
        const rule = rules.find(
          (item) =>
            item.grade === selectedGrade && item.category_id === category.id,
        )

        return rule ? { ...rule, category } : null
      })
      .filter((row): row is RuleRow => Boolean(row))
  }, [categories, rules, selectedGrade])

  const changedCount = Object.keys(drafts).length

  function updateDraft(rule: ExpenseRule, field: keyof RuleDraft, value: string) {
    setError('')
    setDrafts((current) => {
      const existing = current[rule.id] ?? {
        daily_limit: String(Number(rule.daily_limit)),
        per_expense_limit: String(Number(rule.per_expense_limit)),
      }

      const nextDraft = { ...existing, [field]: value }
      const unchanged =
        Number(nextDraft.daily_limit) === Number(rule.daily_limit) &&
        Number(nextDraft.per_expense_limit) === Number(rule.per_expense_limit)

      if (unchanged) {
        const { [rule.id]: _removed, ...rest } = current
        return rest
      }

      return { ...current, [rule.id]: nextDraft }
    })
  }

  async function saveChanges() {
    setError('')

    const updates = Object.entries(drafts).map(([id, draft]) => ({
      id,
      daily_limit: Number(draft.daily_limit),
      per_expense_limit: Number(draft.per_expense_limit),
    }))

    const invalid = updates.find(
      (item) =>
        !Number.isFinite(item.daily_limit) ||
        !Number.isFinite(item.per_expense_limit) ||
        item.daily_limit <= 0 ||
        item.per_expense_limit <= 0 ||
        item.per_expense_limit > item.daily_limit,
    )

    if (invalid) {
      setError('Limits must be greater than zero, and per-expense cannot exceed daily.')
      return
    }

    setSaving(true)

    const results = await Promise.all(
      updates.map((item) =>
        supabase
          .from('expense_rules')
          .update({
            daily_limit: item.daily_limit,
            per_expense_limit: item.per_expense_limit,
          })
          .eq('id', item.id)
          .select()
          .single(),
      ),
    )

    const failed = results.find((result) => result.error)
    if (failed?.error) {
      setError(failed.error.message)
      setSaving(false)
      return
    }

    const updatedRules = results
      .map((result) => result.data)
      .filter((rule): rule is ExpenseRule => Boolean(rule))

    setRules((current) =>
      current.map((rule) => {
        const updated = updatedRules.find((item) => item.id === rule.id)
        return updated ?? rule
      }),
    )
    setDrafts({})
    setSaving(false)
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-base font-semibold">Rules & Limits</h1>
          <p className="text-xs text-muted-foreground">
            Manage category limits for each employee grade
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRules} disabled={loading || saving}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={saveChanges} disabled={changedCount === 0 || saving}>
            <Save className="size-3.5" />
            Save{changedCount > 0 ? ` (${changedCount})` : ''}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {GRADES.map((grade) => (
          <Button
            key={grade}
            variant={grade === selectedGrade ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => setSelectedGrade(grade)}
          >
            G{grade}
          </Button>
        ))}
      </div>

      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-right text-xs">Daily Limit</TableHead>
              <TableHead className="text-right text-xs">Per Expense</TableHead>
              <TableHead className="text-xs">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 7 }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 4 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <Empty className="border-0 py-10">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Sliders />
                      </EmptyMedia>
                      <EmptyTitle>No rules found for Grade {selectedGrade}</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((rule) => {
                const draft = drafts[rule.id]
                const dailyValue = draft?.daily_limit ?? String(Number(rule.daily_limit))
                const perExpenseValue =
                  draft?.per_expense_limit ?? String(Number(rule.per_expense_limit))

                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="text-xs font-medium leading-none">
                          {rule.category.name}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Current: {formatMoney(rule.daily_limit)} daily ·{' '}
                          {formatMoney(rule.per_expense_limit)} per expense
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="w-36">
                      <Input
                        type="number"
                        min={1}
                        value={dailyValue}
                        onChange={(event) =>
                          updateDraft(rule, 'daily_limit', event.target.value)
                        }
                        className="h-8 text-right text-xs"
                      />
                    </TableCell>
                    <TableCell className="w-36">
                      <Input
                        type="number"
                        min={1}
                        value={perExpenseValue}
                        onChange={(event) =>
                          updateDraft(rule, 'per_expense_limit', event.target.value)
                        }
                        className="h-8 text-right text-xs"
                      />
                    </TableCell>
                    <TableCell>
                      {draft ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Edited
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Saved
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

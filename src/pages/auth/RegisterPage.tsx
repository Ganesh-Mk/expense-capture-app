import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { UserPlus, ReceiptText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NativeSelect } from '@/components/ui/native-select'

interface FormData {
  full_name: string
  email: string
  password: string
  grade: string
  department: string
  role: 'employee' | 'admin'
}

const DEPARTMENTS = ['Engineering', 'Finance', 'Sales', 'Marketing', 'HR', 'Operations', 'Legal', 'Product', 'Design', 'Management']

export default function RegisterPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})

  const { register, handleSubmit } = useForm<FormData>({
    defaultValues: { grade: '5', role: 'employee', department: 'Engineering' },
  })

  function validate(data: FormData): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!data.full_name || data.full_name.length < 2) errs.full_name = 'Enter your full name'
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errs.email = 'Enter a valid email address'
    if (!data.password || data.password.length < 6) errs.password = 'Password must be at least 6 characters'
    if (!data.department || data.department.length < 2) errs.department = 'Enter your department'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function onSubmit(data: FormData) {
    if (!validate(data)) return
    setApiError(null)
    const { error } = await signUp(
      data.email, data.password, data.full_name,
      parseInt(data.grade, 10), data.department, data.role
    )
    if (error) setApiError(error)
    else navigate('/dashboard')
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ExpenseFlow</h1>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle className="text-base">New employee registration</CardTitle>
            <CardDescription className="text-xs">Fill in your details to get started</CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {apiError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{apiError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="full_name" className="text-xs font-medium">Full name</Label>
                <Input id="full_name" placeholder="Rajesh Kumar" aria-invalid={!!errors.full_name} {...register('full_name')} />
                {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                <Input id="email" type="email" placeholder="you@company.com" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="grade" className="text-xs font-medium">Grade (1–10)</Label>
                  <NativeSelect id="grade" {...register('grade')}>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i + 1} value={String(i + 1)}>Grade {i + 1}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role" className="text-xs font-medium">Role</Label>
                  <NativeSelect id="role" {...register('role')}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </NativeSelect>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="department" className="text-xs font-medium">Department</Label>
                <NativeSelect id="department" aria-invalid={!!errors.department} {...register('department')}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </NativeSelect>
              </div>

              <Button type="submit" className="mt-1 w-full">
                <UserPlus className="size-4" />
                Create account
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-foreground underline underline-offset-4 hover:text-primary">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

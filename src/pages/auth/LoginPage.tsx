import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, LogIn, ReceiptText } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setApiError(null)
    const { error } = await signIn(data.email, data.password)
    if (error) {
      setApiError(error)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ReceiptText className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">ExpenseFlow</h1>
          <p className="text-sm text-muted-foreground">Enterprise Expense Management</p>
        </div>

        <Card className="gap-0 py-0">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle className="text-base">Sign in to your account</CardTitle>
            <CardDescription className="text-xs">Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {apiError && (
                <Alert variant="destructive">
                  <AlertDescription className="text-xs">{apiError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-invalid={!!errors.password}
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button type="submit" disabled={isSubmitting} className="mt-1 w-full">
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-foreground underline underline-offset-4 hover:text-primary">
                Register
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Spinner } from '@/components/ui/spinner'

interface ProtectedRouteProps {
  requireAdmin?: boolean
}

export function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (requireAdmin && profile.role !== 'admin') return <Navigate to="/dashboard" replace />

  return <Outlet />
}

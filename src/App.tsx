import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import AppLayout from '@/components/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import NewExpensePage from '@/pages/expenses/NewExpensePage'
import MyExpensesPage from '@/pages/expenses/MyExpensesPage'
import ChatPage from '@/pages/chat/ChatPage'
import AdminExpensesPage from '@/pages/admin/AdminExpensesPage'
import AdminEmployeesPage from '@/pages/admin/AdminEmployeesPage'
import AdminAnalyticsPage from '@/pages/admin/AdminAnalyticsPage'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/expenses/new" element={<NewExpensePage />} />
              <Route path="/expenses" element={<MyExpensesPage />} />
              <Route path="/chat" element={<ChatPage />} />

              {/* Admin only */}
              <Route element={<ProtectedRoute requireAdmin />}>
                <Route path="/admin/expenses" element={<AdminExpensesPage />} />
                <Route path="/admin/employees" element={<AdminEmployeesPage />} />
                <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-right" />
    </AuthProvider>
  )
}

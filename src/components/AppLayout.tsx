import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ReceiptText, LayoutDashboard, PlusCircle, MessageSquare,
  Users, BarChart3, LogOut, Settings, ChevronDown, Bell, Menu, X
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const employeeNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/expenses/new', label: 'New Expense', icon: PlusCircle },
  { to: '/expenses', label: 'My Expenses', icon: ReceiptText },
  { to: '/chat', label: 'Chat Support', icon: MessageSquare },
]

const adminNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/employees', label: 'Employees', icon: Users },
  { to: '/admin/expenses', label: 'All Expenses', icon: ReceiptText },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/expenses/new', label: 'New Expense', icon: PlusCircle },
  { to: '/expenses', label: 'My Expenses', icon: ReceiptText },
  { to: '/chat', label: 'Chat Support', icon: MessageSquare },
]

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <NavLink
      to={to}
      end={to === '/dashboard'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )
      }
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </NavLink>
  )
}

export default function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems = profile?.role === 'admin' ? adminNav : employeeNav

  const initials = profile?.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? 'U'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-svh bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-56 shrink-0 border-r bg-card/50 md:flex md:flex-col">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 border-b px-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ReceiptText className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ExpenseFlow</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {profile?.role === 'admin' && (
            <>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
              {adminNav.slice(0, 4).map(item => (
                <NavItem key={item.to} {...item} />
              ))}
              <Separator className="my-2" />
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Personal</p>
              {adminNav.slice(4).map(item => (
                <NavItem key={item.to} {...item} />
              ))}
            </>
          )}
          {profile?.role !== 'admin' && navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left hover:bg-accent transition-colors">
                <Avatar size="sm">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{profile?.full_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{profile?.employee_code}</p>
                </div>
                <ChevronDown className="size-3 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="text-xs">
                <div>{profile?.full_name}</div>
                <div className="font-normal text-muted-foreground">{profile?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 size-3.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                <LogOut className="mr-2 size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-56 border-r bg-card flex flex-col transition-transform md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ReceiptText className="size-4" />
            </div>
            <span className="text-sm font-semibold">ExpenseFlow</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navItems.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>
        <div className="border-t p-3">
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="w-full justify-start text-destructive hover:text-destructive">
            <LogOut className="mr-2 size-3.5" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileOpen(true)}>
            <Menu className="size-4" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="hidden text-[10px] sm:flex">
              Grade {profile?.grade}
            </Badge>
            <Badge
              variant={profile?.role === 'admin' ? 'default' : 'secondary'}
              className="text-[10px] capitalize"
            >
              {profile?.role}
            </Badge>
            <Button variant="ghost" size="icon-sm">
              <Bell className="size-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

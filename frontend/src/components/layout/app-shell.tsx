import { BarChart3, History, PanelTop } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

const links = [
  { to: '/', label: '分析', icon: BarChart3, end: true },
  { to: '/history', label: '历史记录', icon: History, end: false },
]

type AppShellProps = {
  onLogout: () => void
}

export function AppShell({ onLogout }: AppShellProps) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/80 bg-white/75 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary">
              <PanelTop className="h-6 w-6" />
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.28em] text-muted-foreground">
                StockAI
              </p>
              <h1 className="text-lg font-semibold text-foreground">
                AI股票分析助手
              </h1>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout}>
            退出
          </Button>
        </div>
        <div className="mx-auto flex max-w-7xl gap-2 px-4 pb-4 sm:px-6 lg:px-8">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-foreground text-white'
                    : 'bg-white/80 text-muted-foreground hover:bg-white hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}

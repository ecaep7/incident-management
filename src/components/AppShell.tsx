'use client'

import { usePathname } from 'next/navigation'
import { useProfile } from '@/lib/useProfile'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/AppSidebar'
import { Separator } from '@/components/ui/separator'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile, loading } = useProfile()

  if (pathname === '/login') return <>{children}</>
  if (loading) return <div className="flex min-h-screen items-center justify-center">Đang tải...</div>

  return (
    <SidebarProvider>
      <AppSidebar profile={profile} />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
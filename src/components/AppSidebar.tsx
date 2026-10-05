'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from '@/components/ui/sidebar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ModeToggle } from '@/components/mode-toggle'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, AlertTriangle, Ticket, UserPlus, ClipboardList, ChevronUp, KeyRound, LogOut, Inbox, Server } from 'lucide-react'

export function AppSidebar({ profile }: { profile: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const role = profile?.role?.role_name

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, show: true },
    { href: '/work-queue', label: 'Việc cần xử lý', icon: Inbox, show: role === 'Admin' },
    { href: '/incidents', label: 'Hàng chờ cảnh báo', icon: AlertTriangle, show: role === 'Admin' },
    { href: '/tickets', label: 'Ticket', icon: Ticket, show: role === 'Admin' || role === 'Viewer' },
    { href: '/devices', label: 'Thiết bị', icon: Server, show: role === 'Admin' || role === 'Viewer' },
    { href: '/my-tasks', label: 'Việc của tôi', icon: ClipboardList, show: role === 'Handler' },
    { href: '/admin/create-user', label: 'Tạo tài khoản', icon: UserPlus, show: role === 'Admin' },
  ]

  return (
    <Sidebar variant="floating">
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 font-bold text-sidebar-foreground">
            AT
          </div>
          <span className="text-base font-semibold text-sidebar-foreground">Quản lý Sự cố ATTT</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.filter((i) => i.show).map((item) => (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} className="w-full">
                     <SidebarMenuButton isActive={pathname === item.href}>
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

<SidebarFooter className="gap-2 px-2 pb-4">
  <ModeToggle />
  <DropdownMenu>
    <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent">
      <div className="flex flex-1 flex-col text-left leading-tight">
        <span className="truncate font-medium">{profile?.full_name}</span>
        <span className="truncate text-xs opacity-60">{role}</span>
      </div>
      <ChevronUp className="ml-auto h-4 w-4 shrink-0" />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="top" className="w-56">
      <DropdownMenuItem>
        <Link href="/change-password" className="flex w-full items-center">
         <KeyRound className="mr-2 h-4 w-4" />Đổi mật khẩu
         </Link>
</DropdownMenuItem>
      <DropdownMenuItem onClick={handleLogout}>
        <LogOut className="mr-2 h-4 w-4" />Đăng xuất
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</SidebarFooter>
    </Sidebar>
  )
}
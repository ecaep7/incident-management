'use client'

import { useTheme } from 'next-themes'
import { Switch } from '@/components/ui/switch'
import { Moon, Sun } from 'lucide-react'

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="flex items-center gap-2 px-2 text-sidebar-foreground">
      <Sun className="h-4 w-4 opacity-70" />
      <Switch checked={isDark} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
      <Moon className="h-4 w-4 opacity-70" />
    </div>
  )
}
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export function Navbar({ profile }: { profile: any }) {
  const router = useRouter()
  const role = profile?.role?.role_name
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px', borderBottom: '1px solid #ddd' }}>
      <div style={{ display: 'flex', gap: 20 }}>
        <Link href="/dashboard">Dashboard</Link>
        {role === 'Admin' && <Link href="/incidents">Hàng chờ cảnh báo</Link>}
        {role === 'Admin' && <Link href="/tickets">Ticket</Link>}
        {role === 'Admin' && <Link href="/admin/create-user">Tạo tài khoản</Link>}
        {role === 'Handler' && <Link href="/my-tasks">Việc của tôi</Link>}
        {role === 'Viewer' && <Link href="/tickets">Ticket</Link>}
      </div>

      <div ref={menuRef} style={{ position: 'relative' }}>
        <button onClick={() => setMenuOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {profile?.full_name} · {role} <span style={{ fontSize: 10 }}>▼</span>
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 4,
            background: 'white', border: '1px solid #ddd', borderRadius: 4,
            minWidth: 160, display: 'flex', flexDirection: 'column', zIndex: 10,
          }}>
            <Link href="/change-password" onClick={() => setMenuOpen(false)} style={{ padding: '10px 16px' }}>Đổi mật khẩu</Link>
            <button onClick={handleLogout} style={{ padding: '10px 16px', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}>Đăng xuất</button>
          </div>
        )}
      </div>
    </nav>
  )
}
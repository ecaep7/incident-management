'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from './supabase'

// Thong tin nguoi dang nhap (ho ten, vai tro, phong ban) dung chung cho TOAN BO ung dung.
//
// Truoc day moi trang tu goi useProfile() -> moi lan chuyen trang lai mat 2 luot goi mang
// (kiem tra phien dang nhap + doc bang user) roi moi bat dau tai du lieu cua trang.
// Nay ProfileProvider (dat trong AppShell) chi tai 1 lan khi mo ung dung va giu lai;
// cac trang goi useProfile() chi doc gia tri co san, khong goi mang nua.
// Tu dong tai lai khi dang nhap / dang xuat / doi mat khau (su kien cua Supabase Auth).

type ProfileState = { profile: any; loading: boolean }

const ProfileContext = createContext<ProfileState>({ profile: null, loading: true })

const PUBLIC_PATHS = ['/login']

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ProfileState>({ profile: null, loading: true })
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        setState({ profile: null, loading: false })
        return
      }
      const { data, error } = await supabase
        .from('user')
        .select('user_id, full_name, email, role(role_name), department(dep_name, dep_id)')
        .eq('user_id', user.id)
        .single()
      if (cancelled) return
      setState({ profile: error ? null : data, loading: false })
    }

    load()

    // Chi tai lai khi trang thai dang nhap thay doi (khong tai lai khi chuyen trang)
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setState({ profile: null, loading: false })
      // setTimeout: Supabase khuyen khong goi API ngay trong callback (tranh bi treo)
      else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') setTimeout(load, 0)
    })

    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  // Chua dang nhap ma vao trang can dang nhap -> chuyen ve /login
  useEffect(() => {
    if (!state.loading && !state.profile && !PUBLIC_PATHS.includes(pathname)) router.push('/login')
  }, [state.loading, state.profile, pathname, router])

  return <ProfileContext.Provider value={state}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  return useContext(ProfileContext)
}

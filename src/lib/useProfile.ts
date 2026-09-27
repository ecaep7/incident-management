'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'

export function useProfile() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error } = await supabase
        .from('user')
        .select('user_id, full_name, email, role(role_name), department(dep_name, dep_id)')
        .eq('user_id', user.id)
        .single()

      if (!error) setProfile(data)
      setLoading(false)
    }
    load()
  }, [router])

  return { profile, loading }
}
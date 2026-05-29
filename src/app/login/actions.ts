'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function signInWithOtp(formData: FormData) {
  const email = formData.get('email') as string
  if (!email) {
    return { error: 'メールアドレスを入力してください。' }
  }

  const supabase = await createClient()
  
  // Dynamic extraction of the current request origin
  const headerList = await headers()
  const origin = headerList.get('origin') ?? 'http://localhost:3000'

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Magic Link sending error:', error)
    return { error: 'ログインメールの送信に失敗しました。' }
  }

  return { success: true }
}

export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Logout error:', error)
  }
  redirect('/')
}

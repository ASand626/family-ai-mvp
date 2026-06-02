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

export async function verifyOtpCode(formData: FormData) {
  const email = formData.get('email') as string
  const token = formData.get('token') as string
  if (!email || !token) {
    return { error: 'メールアドレスと認証コードを入力してください。' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'magiclink',
  })

  if (error) {
    console.error('OTP Verification error:', error)
    return { error: '認証コードが正しくないか、有効期限が切れています。' }
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

export async function signInAnonymouslyAction() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInAnonymously()
  
  if (error) {
    console.error('Anonymous sign-in error:', error)
    redirect('/login?error=guest_failed')
  }

  redirect('/chat')
}

export async function linkEmailToAnonymous(email: string) {
  if (!email) {
    return { error: 'メールアドレスを入力してください。' }
  }

  const supabase = await createClient()
  
  // Try to update the user with the new email.
  // This triggers email confirmation flow.
  const { error } = await supabase.auth.updateUser({
    email,
  })

  if (error) {
    console.error('Link email error:', error)
    return { error: error.message || '認証メールの送信に失敗しました。' }
  }

  return { success: true }
}

export async function verifyAndLinkOtp(email: string, token: string) {
  if (!email || !token) {
    return { error: 'メールアドレスと認証コードを入力してください。' }
  }

  const supabase = await createClient()

  // First try verifyOtp with type 'signup' (linking style)
  let result = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  // Fallback to 'email_change'
  if (result.error) {
    console.warn("verifyOtp with type 'signup' failed, trying 'email_change':", result.error.message)
    result = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email_change',
    })
  }

  if (result.error) {
    console.error('Promotion OTP Verification error:', result.error)
    return { error: '認証コードが正しくないか、有効期限が切れています。' }
  }

  return { success: true }
}



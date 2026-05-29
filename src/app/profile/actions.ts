'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'

export async function getProfile() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインしていません。', data: null }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('family_summary, concerns')
    .eq('user_id', user.id)
    .single()

  // PGRST116 is Supabase code for 0 rows returned, which is expected for new users
  if (error && error.code !== 'PGRST116') {
    console.error('Fetch profile error:', error)
    return { error: 'プロフィールの取得に失敗しました。', data: null }
  }

  return { data: data || { family_summary: '', concerns: '' }, error: null }
}

export async function saveProfile(formData: FormData) {
  const familySummary = formData.get('family_summary') as string
  const concerns = formData.get('concerns') as string

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインしていません。' }
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        family_summary: familySummary || '',
        concerns: concerns || '',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )

  if (error) {
    console.error('Save profile error:', error)
    return { error: 'プロフィールの保存に失敗しました。' }
  }

  revalidatePath('/profile')
  revalidatePath('/')
  return { success: true }
}

export async function getFamilyMembers() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインしていません。', data: [] }
  }

  const { data, error } = await supabase
    .from('family_members')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Fetch family members error:', error)
    return { error: '家族メンバー情報の取得に失敗しました。', data: [] }
  }

  return { data: data || [], error: null }
}

export async function saveFamilyMembers(members: any[]) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'ログインしていません。' }
  }

  try {
    // 1. Get current member IDs from database to find out which ones were deleted
    const { data: currentDbMembers, error: fetchError } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', user.id)

    if (fetchError) throw fetchError

    // 2. Filter input members to separate updates/inserts and find deleted ones
    const inputIds = members.filter(m => m.id).map(m => m.id)
    const deleteIds = currentDbMembers
      ?.filter(m => !inputIds.includes(m.id))
      .map(m => m.id) || []

    // 3. Execute deletes if there are any
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('family_members')
        .delete()
        .in('id', deleteIds)
      
      if (deleteError) throw deleteError
    }

    // 4. Prepare upsert data
    const upsertData = members.map(m => ({
      id: m.id || crypto.randomUUID(), // Generate UUIDv4 for new members to avoid null constraint errors
      user_id: user.id,
      role: m.role,
      nickname: m.nickname || '',
      birthdate: m.birthdate || null,
      occupation: m.occupation || null,
      recent_concern: m.recent_concern || null,
      school_status: m.school_status || null,
      interests: m.interests || [],
      concerns: m.concerns || []
    }))

    // 5. Execute upsert if there are members to save
    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('family_members')
        .upsert(upsertData, { onConflict: 'id' })

      if (upsertError) throw upsertError
    }

    revalidatePath('/profile')
    revalidatePath('/')
    return { success: true }
  } catch (err: any) {
    console.error('Save family members error:', err)
    return { error: '家族メンバー情報の保存に失敗しました。もう一度お試しいただくか、時間をおいて再度実行してください。' }
  }
}

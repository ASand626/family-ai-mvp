import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function DELETE(request: Request) {
  try {
    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Session verification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Delete the chat session
    // Since we set "ON DELETE CASCADE" on conversations.session_id,
    // deleting the session will automatically delete all associated messages.
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id) // Ensure users can only delete their own sessions

    if (error) {
      console.error('Failed to delete chat session:', error)
      return NextResponse.json({ error: 'Failed to delete chat session' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Sessions DELETE Route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { formatProfileForAI } from '@/utils/profileFormatter'

export async function POST(request: Request) {
  try {
    const { message } = await request.json()
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Session verification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Save the user's message to Supabase conversations table
    const { error: userMsgError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        role: 'user',
        content: message,
      })

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError)
      return NextResponse.json({ error: 'Failed to save conversation history' }, { status: 500 })
    }

    // 3. Fetch family profile and family members in parallel for high performance
    const [profileResult, membersResult] = await Promise.all([
      supabase.from('profiles').select('family_summary, concerns').eq('user_id', user.id).maybeSingle(),
      supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    ])

    const profile = profileResult.data
    const members = membersResult.data || []

    const formattedProfileString = formatProfileForAI(profile, members)

    // 4. Fetch recent conversation history (limit to 20 most recent messages)
    const { data: rawHistory } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }) // chronological order
      .limit(20)

    const history = rawHistory || []

    // 5. Build system prompt reflecting rules from docs/ai_behavior.md
    const systemPrompt = `あなたは家庭の悩みに寄り添い、整理を支援する優秀で温厚なAIパートナーです。
回答する際は、以下の行動指針（docs/ai_behavior.mdのルール）を厳格に守ってください：

1. 原因を断定しない：
   悩みの原因を決めつけず、「〜かもしれません」「〜という可能性もあります」といった丁寧な表現を心がけてください。
2. 仮説型で話す：
   一つの正解を押しつけず、仮説としていくつかの異なる視点やアイデアを提示してください。
3. 否定しない：
   相談者の気持ちや行動を一切否定せず、まずは温かく受け止めて寄り添ってください。
4. 一般論と家庭事情を分ける：
   「一般的にはこう言われますが、〇〇さんのご家庭の場合は〜」というように、相談者の個別の状況にフォーカスして話してください。
5. 小さな改善提案をする：
   大きすぎる目標ではなく、「今日からできる小さな一歩」や「少しだけ試せること」を具体的に提案してください。
6. 過剰共感しない：
   不自然なほど過剰な同調は避け、落ち着いていて温かみのある、信頼できるトーンを維持してください。
7. 医療診断しない：
   うつ病や発達障害などの医療的・専門的な診断や断定は絶対に避け、必要に応じて専門機関への相談を促してください。

【相談者の家庭プロフィール】
${formattedProfileString}

上記のプロフィール情報を前提知識として、相談者に寄り添った対話を行ってください。毎回プロフィールについてゼロから説明させることなく、これまでの文脈を深く理解している親しい伴走者として振る舞ってください。`

    // 6. Format conversation history for Anthropic API
    // Anthropic API expects messages in the form of { role: 'user' | 'assistant', content: string }
    // It must alternate between 'user' and 'assistant', starting with 'user'
    const formattedMessages = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // If the history is empty or does not end with 'user''s latest input, we ensure it's correct.
    // In our logic, we just saved the user's latest input, so the last element will always be the 'user' role.
    if (formattedMessages.length === 0) {
      formattedMessages.push({
        role: 'user',
        content: message,
      })
    }

    // 7. Initialize Anthropic SDK and create request
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: formattedMessages,
    })

    // Extract reply text from the blocks
    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')

    // 8. Save the AI's reply to Supabase conversations table
    const { error: assistantMsgError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        role: 'assistant',
        content: reply,
      })

    if (assistantMsgError) {
      console.error('Failed to save assistant reply:', assistantMsgError)
      // Even if saving failed, we still return the response to the user so UX doesn't break
    }

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('API Chat Route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

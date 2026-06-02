import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { formatProfileForAI } from '@/utils/profileFormatter'

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Secure route: Check authorization
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Guest/Anonymous User check
    if (user.is_anonymous) {
      return NextResponse.json({ isGuest: true })
    }

    // 3. Resolve JST date (Japan Standard Time, UTC+9)
    const options = { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' } as const
    const formatter = new Intl.DateTimeFormat('ja-JP', options)
    const parts = formatter.formatToParts(new Date())
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    const day = parts.find(p => p.type === 'day')?.value
    const jstDateStr = `${year}-${month}-${day}` // Format: YYYY-MM-DD

    // 4. Check if message already exists for today
    const { data: existingMsg, error: fetchMsgError } = await supabase
      .from('daily_messages')
      .select('message')
      .eq('user_id', user.id)
      .eq('date', jstDateStr)
      .maybeSingle()

    if (fetchMsgError) {
      console.error('Fetch daily message error:', fetchMsgError)
    }

    if (existingMsg?.message) {
      return NextResponse.json({ message: existingMsg.message, date: jstDateStr })
    }

    // 5. Query family profile and family members
    const [profileResult, membersResult] = await Promise.all([
      supabase.from('profiles').select('family_summary, concerns').eq('user_id', user.id).maybeSingle(),
      supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    ])

    const profile = profileResult.data
    const members = membersResult.data || []
    const formattedProfileString = formatProfileForAI(profile, members)

    // 6. Query recent conversation history (latest 30 messages)
    const { data: rawHistory, error: historyError } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (historyError) {
      console.error('Fetch conversation history error:', historyError)
    }

    // Reverse history so it's in chronological order
    const history = rawHistory ? [...rawHistory].reverse() : []
    const formattedHistory = history
      .map((msg) => `${msg.role === 'user' ? '相談者' : 'AI'}: ${msg.content}`)
      .join('\n')

    // 7. Instantiate Anthropic SDK
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    // 8. Construct system instructions aligning with docs/ai_behavior.md
    const systemPrompt = `あなたは子育てや家庭の悩みを持つ親（相談者）を温かく見守り、日々の努力を認めて前向きな言葉を贈るAIパートナーです。
相談者がホーム画面を開いたときに表示される「きょうのメッセージ」（応援、がんばりの肯定、温かい励まし、前向きな一言）を1点だけ生成してください。

【厳格な制約事項】
1. 必ず「1文（50文字〜100文字程度）」の自然で温かい日本語で生成してください。
2. マークダウンの太字（**）や見出し記号（#）、箇条書き（-）、絵文字、挨拶（「おはようございます」など）は絶対に入れないでください。
3. 相談者の「家庭プロフィール」や「最近の相談履歴」（もしある場合）を踏まえ、相談者の置かれた状況や関心事にそっと寄り添ったメッセージにしてください。
4. 何かのアドバイスや解決策の提案、原因の断定、正解の押し付けは避け、日頃のがんばりをねぎらい、優しく肯定することに焦点を当ててください。
5. 相談履歴やプロフィール情報が空または少ない場合は、家族を支える人全般への温かいねぎらいや前向きなメッセージを生成してください。

【相談者の家庭プロフィール】
${formattedProfileString}

【最近の相談履歴（時系列順）】
${formattedHistory || '（まだ相談履歴はありません）'}

余計な挨拶や説明は一切省き、メッセージの本文のみを出力してください。`

    // 9. Generate message via Anthropic
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: '今日の私への一言メッセージを生成してください。' }]
    })

    const generatedMessage = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
      .replace(/[「」"']/g, '') // remove extra quotes if any

    if (!generatedMessage) {
      throw new Error('Claude generated an empty message')
    }

    // 10. Cache the generated message in the database (upsert to prevent duplicates)
    const { error: insertError } = await supabase
      .from('daily_messages')
      .upsert({
        user_id: user.id,
        date: jstDateStr,
        message: generatedMessage
      }, { onConflict: 'user_id,date' })

    if (insertError) {
      console.error('Failed to save daily message:', insertError)
      // We continue and return the generated message even if DB insert fails to maintain UX.
    }

    return NextResponse.json({ message: generatedMessage, date: jstDateStr })
  } catch (error: any) {
    console.error('Daily message API route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}

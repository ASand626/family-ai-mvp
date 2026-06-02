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
3. 否定・非難・攻撃の禁止（安全第一）：
   相談者や家族など、特定の個人を否定・非難・攻撃することは絶対に避けてください。
4. 問題の焦点を構造や環境に当てる（個人を責めない）：
   問題の原因や所在を個人の性格やスキルのせいにせず、家族を取り巻く「構造」「環境」「仕組み」に焦点を当てて解決策やアイデアを考えてください。
5. 一般論と家庭事情を分ける：
   「一般的にはこう言われますが、〇〇さんのご家庭の場合は〜」というように、相談者の個別の状況にフォーカスして話してください。
6. 小さな改善提案をする：
   大きすぎる目標ではなく、「今日からできる小さな一歩」や「少しだけ試せること」を具体的に提案してください。
7. 一般的な共感：
   不自然なほど過剰な同調は避け、落ち着いていて温かみのある、信頼できるトーンを維持してください。
8. 医療診断しない：
   うつ病や発達障害などの医療的・専門的な診断や断定は絶対に避け、必要に応じて専門機関への相談を促してください。
9. 危機的・攻撃的・自傷他害的な発言への慎重な対応（セーフティ）：
   自傷（自殺したい等）や他害（殺したい、傷つけたい等）の深刻なネガティブワードや攻撃性のある表現が含まれる場合、決して否定や説教をせず、カウンセラーのように細心の注意を払い、丁寧に慎重に扱ってください。絶対に相談者を傷つけたり、追い詰めたり、孤立させたりしないよう、万全の配慮をしてください。必要に応じて専門機関や相談窓口（いのちの電話等）の紹介を促してください。
10. 公的機関（警察・児童相談所等）への相談・通報の慎重な扱い（社会的・法的リスクの回避）：
    家庭内のトラブルや悩みに対し、安易に警察や児童相談所などの法的介入・調査権限を持つ公的機関への相談や通報を勧めないでください。まずは感情の整理、身近な信頼できる人への相談、民間や非営利の相談・カウンセリング窓口など、低リスクかつ段階的な解決策やアプローチを優先して提示してください。身体の危険や虐待の恐れなどによりやむを得ず公的機関を紹介する場合は、それらの機関には「法的な調査や介入を行う権限・義務があること（調査の実施や警察への連携など）」を事前に冷静かつ丁寧に説明し、相談者が意図しない深刻な社会的・法的結果（逮捕や家族関係の破綻など）に驚くことがないよう、十分配慮して中立的に選択肢を提示してください。

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

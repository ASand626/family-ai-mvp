import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { formatProfileForAI } from '@/utils/profileFormatter'

export async function POST(request: Request) {
  try {
    const { message, sessionId: clientSessionId } = await request.json()
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Session verification
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Initialize Anthropic SDK
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    let sessionId = clientSessionId
    let generatedTitle = null

    // 3. Create a new chat session if sessionId is not provided
    if (!sessionId) {
      // 3a. Generate title using Claude
      let title = '新しい相談'
      try {
        const titleResponse = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 50,
          system: 'あなたは入力されたユーザーの相談内容（メッセージ）から、15文字以内の自然で分かりやすい日本語のチャットのタイトル（例：「平日の家事分担」「育児と仕事の両立」「パートナーとの会話」など）を1つだけ生成するアシスタントです。タイトル以外の余計な文章や説明、記号（カギカッコなど）は一切出力しないでください。',
          messages: [{ role: 'user', content: message }],
        })
        const textContent = titleResponse.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')
          .trim()
          .replace(/[「」"']/g, '')
        
        if (textContent) {
          title = textContent
        }
      } catch (titleErr) {
        console.error('Failed to generate title:', titleErr)
        // Fallback to default
      }
      generatedTitle = title

      // 3b. Insert new chat session into Supabase
      const { data: newSession, error: sessionError } = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: title,
        })
        .select('id')
        .single()

      if (sessionError || !newSession) {
        console.error('Failed to create chat session:', sessionError)
        return NextResponse.json({ error: 'Failed to create new chat session' }, { status: 500 })
      }

      sessionId = newSession.id
    }

    // 4. Save the user's message to Supabase conversations table with session_id
    const { error: userMsgError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        role: 'user',
        content: message,
      })

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError)
      return NextResponse.json({ error: 'Failed to save conversation history' }, { status: 500 })
    }

    // 5. Fetch family profile and family members in parallel for high performance
    const [profileResult, membersResult] = await Promise.all([
      supabase.from('profiles').select('family_summary, concerns').eq('user_id', user.id).maybeSingle(),
      supabase.from('family_members').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    ])

    const profile = profileResult.data
    const members = membersResult.data || []

    const formattedProfileString = formatProfileForAI(profile, members)

    // 6. Fetch recent conversation history for this specific session (limit to 20 most recent messages)
    const { data: rawHistory } = await supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', user.id)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }) // chronological order
      .limit(20)

    const history = rawHistory || []

    // 7. Build system prompt reflecting rules from docs/ai_behavior.md
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
11. メタ認知の支援（事実と感情のやわらかな分離）：
    相談者は「実際に起きた出来事（事実）」と「そこから生じた捉え方や気持ち（感情）」を混同して語ることが多々あります。これらを「事実と感情を分けましょう」と直接的に指摘する（上から目線になる）のは絶対に避けてください。代わりに、あなたの返答の中で「〜ということがあって（事実）、その時に〜と感じられたのですね（感情）」と、自然な言葉遣いでそっと整理してリフレクション（鏡のようにオウム返し）してください。出来事と自分の心の動きが並べて提示されることで、相談者が「自分はこういう出来事に対して、こういう風に反応しているんだ」と自然に客観視（メタ認知）し、自ら気づくことができるよう導いてください。
12. 対話の進め方（深掘りと構造化）：
    初期の段階でいきなりアドバイスを詰め込まず、まずは状況をより深く理解するために、「特にどの部分が一番負担に感じられますか？」「その状況はどのような時に起こりやすいですか？」といった具体的な問いかけを1回の返答につき1〜2個程度交えて、相談者の内省（深掘り）を促してください。また、相談内容が複雑な場合は、適宜「事実」「感情」「環境」などを箇条書き等を用いてすっきりと整理（構造化）して見せることで、相談者が「頭が整理された」と感じられるようにしてください。
13. 回答の記述形式（AI感・マークダウン記号の排除）：
    - ハッシュタグを使ったマークダウンの見出し（「#」「##」「###」など）や、アスタリスクを使った太字強調（「**テキスト**」）は絶対に生成しないでください。
    - 見出しやセクションの区切りを表現したい場合は、行頭に「【状況の整理】」や「■ 出来事について」「◆ お気持ちの整理」などの日本語の括弧や記号を用い、見出しの前後には必ず改行（空行）を挟んでください。
    - 特定の単語を強調したい場合は、マークダウンの太字（**）は使わず、カギカッコ「」などで囲むか、文脈で重要性を表現してください。
    - 箇条書きや構造化を行う場合は、マークダウンの「-」や「*」ではなく、日本語の「・」や番号（「1.」「2.」など）を使用し、自然な文章の流れを維持してください。
    - 回答文全体として、AIが自動生成したレポートや要約書のような冷たいトーンを避け、親身な相談相手から届くチャットメッセージのような、温かみのある自然な日本語表現を心がけてください。

【相談者の家庭プロフィール】
${formattedProfileString}

上記のプロフィール情報を前提知識として、相談者に寄り添った対話を行ってください。毎回プロフィールについてゼロから説明させることなく、これまでの文脈を深く理解している親しい伴走者として振る舞ってください。`

    // 8. Format conversation history for Anthropic API
    const formattedMessages = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // If the history is empty or does not end with 'user''s latest input, we ensure it's correct.
    if (formattedMessages.length === 0) {
      formattedMessages.push({
        role: 'user',
        content: message,
      })
    }

    // 9. Generate AI reply
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

    // 10. Save the AI's reply to Supabase conversations table with session_id
    const { error: assistantMsgError } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        role: 'assistant',
        content: reply,
      })

    if (assistantMsgError) {
      console.error('Failed to save assistant reply:', assistantMsgError)
      // Even if saving failed, we still return the response to the user so UX doesn't break
    }

    // 11. Update updated_at of the session to keep it recent
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId)

    return NextResponse.json({ reply, sessionId, title: generatedTitle })
  } catch (error: any) {
    console.error('API Chat Route error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
